import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError } from '../api/types';
import type { ApiClient } from '../api/types';
import { GrantedAccess } from '../app/testing';
import { theme } from '../theme';
import Schedule from './Schedule';

const TODAY = '2026-10-16';
// A week with no seeded stay or closure, so what these tests create never meets the seed data.
const EMPTY_WEEK = '/schedule?start=2026-12-01';

function Probe() {
  const { pathname, search } = useLocation();
  return <output data-testid="url">{pathname + search}</output>;
}

function setup(
  url: string,
  client: ApiClient,
  granted?: Parameters<typeof GrantedAccess>[0]['granted'],
) {
  return render(
    <ThemeProvider theme={theme}>
      <GrantedAccess granted={granted}>
        <ApiProvider client={client}>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route path="/schedule" element={<Schedule today={TODAY} />} />
            </Routes>
            <Probe />
          </MemoryRouter>
        </ApiProvider>
      </GrantedAccess>
    </ThemeProvider>,
  );
}

const url = () => screen.getByTestId('url').textContent;
const grid = () => screen.getByRole('grid', { name: 'Schedule', hidden: true });
const cell = (text: RegExp) =>
  within(grid())
    .getAllByRole('gridcell', { hidden: true })
    .find((c) => text.test(c.getAttribute('aria-label') ?? ''));

async function loaded(
  path: string,
  client = createMockClient({ today: TODAY }),
  granted?: Parameters<typeof setup>[2],
) {
  const user = userEvent.setup();
  setup(path, client, granted);
  await screen.findByRole('grid', { name: 'Schedule', hidden: true });
  return { user, client };
}

const dialog = (name: RegExp | string) => screen.findByRole('dialog', { name });
const setDate = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});

describe('New Room Closure tab', () => {
  it('is addressable by URL and starts from the clicked room and day, ending one night later', async () => {
    await loaded(`${EMPTY_WEEK}&panel=new&tab=closure&room=rm-203&arrival=2026-12-02`);
    const panel = await dialog('New Room Closure');
    expect(within(panel).getByRole('tab', { name: 'New Room Closure' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(panel).getByRole('combobox', { name: /Room/ })).toHaveValue('Room 203');
    expect(within(panel).getByLabelText(/Closure Start/)).toHaveValue('2026-12-02');
    expect(within(panel).getByLabelText(/Closure End/)).toHaveValue('2026-12-03');
    expect(within(panel).getByText('0/50')).toBeInTheDocument();
  });

  it('switching tabs keeps the URL in step', async () => {
    const { user } = await loaded(`${EMPTY_WEEK}&panel=new&room=rm-203&arrival=2026-12-02`);
    const panel = await dialog('New Reservation');
    await user.click(within(panel).getByRole('tab', { name: 'New Room Closure' }));
    expect(url()).toContain('tab=closure');
    await user.click(within(panel).getByRole('tab', { name: 'New Reservation' }));
    expect(url()).not.toContain('tab=closure');
  });

  it('saves a closure, closes the panel and shows the block without a reload', async () => {
    const { user } = await loaded(
      `${EMPTY_WEEK}&panel=new&tab=closure&room=rm-203&arrival=2026-12-02`,
    );
    const panel = await dialog('New Room Closure');
    await user.type(within(panel).getByRole('textbox', { name: 'Description' }), 'Pipe repair');
    await user.click(within(panel).getByRole('button', { name: 'Save Closure' }));
    await waitFor(() => expect(cell(/Closure, Pipe repair, Room 203/)).toBeDefined());
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Closure/ })).not.toBeInTheDocument(),
    );
    expect(url()).toBe(EMPTY_WEEK);
    expect((await screen.findAllByText('Closure created.')).length).toBeGreaterThan(0);
  });

  it('cuts a long description after 20 characters on a short closure; the full text is the name', async () => {
    const { user } = await loaded(
      `${EMPTY_WEEK}&panel=new&tab=closure&room=rm-204&arrival=2026-12-02`,
    );
    const panel = await dialog('New Room Closure');
    await user.type(
      within(panel).getByRole('textbox', { name: 'Description' }),
      'Maintenance: Carpet replacement',
    );
    await user.click(within(panel).getByRole('button', { name: 'Save Closure' }));
    await waitFor(() =>
      expect(cell(/Closure, Maintenance: Carpet replacement, Room 204/)).toBeDefined(),
    );
    expect(within(cell(/Room 204/)!).getByText('Maintenance: Carpet…')).toBeInTheDocument();
  });

  it('stops 50 characters in the description', async () => {
    const { user } = await loaded(
      `${EMPTY_WEEK}&panel=new&tab=closure&room=rm-203&arrival=2026-12-02`,
    );
    const panel = await dialog('New Room Closure');
    const field = within(panel).getByRole('textbox', { name: 'Description' });
    await user.type(field, 'x'.repeat(60));
    expect(field).toHaveValue('x'.repeat(50));
    expect(within(panel).getByText('50/50')).toBeInTheDocument();
  });

  it('shows a conflict on the Room field, tied to it, and does not save', async () => {
    const client = createMockClient({ today: TODAY });
    const create = vi.spyOn(client.schedule, 'createClosure');
    const { user } = await loaded(
      '/schedule?panel=new&tab=closure&room=rm-208&arrival=2026-10-18',
      client,
    );
    const panel = await dialog('New Room Closure'); // 208 has the closure "Reserved: Fixed Loss"
    const room = within(panel).getByRole('combobox', { name: /Room/ });
    expect(room).toBeInvalid();
    const error = within(panel).getByText(/Room 208 is already closed on those dates\./);
    expect(room.getAttribute('aria-describedby')).toContain(error.id);
    await user.click(within(panel).getByRole('button', { name: 'Save Closure' }));
    expect(create).not.toHaveBeenCalled();
    expect(panel).toBeVisible();
  });

  it('names the reservation that is in the way', async () => {
    await loaded('/schedule?panel=new&tab=closure&room=rm-202&arrival=2026-10-17');
    const panel = await dialog('New Room Closure');
    expect(
      within(panel).getByText(/Room 202 has reservation GR-\d+ on those dates\./),
    ).toBeInTheDocument();
  });

  it('shows the server refusal (422) on the Room field and keeps what was typed', async () => {
    const client = createMockClient({ today: TODAY });
    vi.spyOn(client.schedule, 'createClosure').mockRejectedValue(
      new ApiError(422, 'conflict', { code: 'closure-conflict' }),
    );
    const { user } = await loaded(
      `${EMPTY_WEEK}&panel=new&tab=closure&room=rm-203&arrival=2026-12-02`,
      client,
    );
    const panel = await dialog('New Room Closure');
    await user.type(within(panel).getByRole('textbox', { name: 'Description' }), 'Paint');
    await user.click(within(panel).getByRole('button', { name: 'Save Closure' }));
    const error = await within(panel).findByText(
      'The room has a reservation or a closure on those dates.',
    );
    expect(within(panel).getByRole('combobox', { name: /Room/ })).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(error.id),
    );
    expect(within(panel).getByRole('textbox', { name: 'Description' })).toHaveValue('Paint');
  });

  it('asks for the end after the start', async () => {
    const { user } = await loaded(
      `${EMPTY_WEEK}&panel=new&tab=closure&room=rm-203&arrival=2026-12-02`,
    );
    const panel = await dialog('New Room Closure');
    setDate(/Closure End/, '2026-12-02');
    await user.click(within(panel).getByRole('button', { name: 'Save Closure' }));
    expect(
      await within(panel).findByText('The end date must be after the start date.'),
    ).toBeInTheDocument();
    expect(within(panel).getByLabelText(/Closure End/)).toBeInvalid();
    await waitFor(() => expect(within(panel).getByLabelText(/Closure End/)).toHaveFocus());
  });

  it('needs a room', async () => {
    const { user } = await loaded(`${EMPTY_WEEK}&panel=new&tab=closure&arrival=2026-12-02`);
    const panel = await dialog('New Room Closure');
    await user.click(within(panel).getByRole('button', { name: 'Save Closure' }));
    expect(await within(panel).findByText('Choose a room.')).toBeInTheDocument();
  });

  it('Cancel closes the panel and saves nothing', async () => {
    const client = createMockClient({ today: TODAY });
    const create = vi.spyOn(client.schedule, 'createClosure');
    const { user } = await loaded(
      `${EMPTY_WEEK}&panel=new&tab=closure&room=rm-203&arrival=2026-12-02`,
      client,
    );
    const panel = await dialog('New Room Closure');
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(url()).toBe(EMPTY_WEEK));
    expect(create).not.toHaveBeenCalled();
  });

  it('is read-only without the edit permission', async () => {
    await loaded(
      `${EMPTY_WEEK}&panel=new&tab=closure&room=rm-203&arrival=2026-12-02`,
      undefined,
      [],
    );
    const panel = await dialog('New Room Closure');
    expect(
      within(panel).getByText('You do not have permission to create closures.'),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Save Closure' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('Closure details panel', () => {
  it('opens from a link with the room in the title and the closure filled in', async () => {
    await loaded('/schedule?closure=cl-2');
    const panel = await dialog('Room 102 Closure');
    expect(within(panel).getByRole('heading', { name: 'Room 102 Closure' })).toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Maintenance: Carpet replacement',
    );
    expect(within(panel).getByLabelText(/Closure Start/)).toHaveValue(TODAY);
  });

  it('says so when the closure is not in the loaded dates', async () => {
    await loaded('/schedule?closure=nope');
    const panel = await dialog('Closure');
    expect(await within(panel).findByText(/removed or is outside the dates/)).toBeInTheDocument();
  });

  it('opens with a click on the block and moves focus into the panel', async () => {
    const { user } = await loaded('/schedule');
    await user.click(
      screen.getByRole('gridcell', { name: /Closure, Reserved: Fixed Loss, Room 208/ }),
    );
    const panel = await dialog('Room 208 Closure');
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
  });

  it('saves a changed description and end date and the grid shows them', async () => {
    const { user } = await loaded('/schedule?closure=cl-2');
    const panel = await dialog('Room 102 Closure');
    const description = within(panel).getByRole('textbox', { name: 'Description' });
    await user.clear(description);
    await user.type(description, 'New carpet');
    setDate(/Closure End/, '2026-10-20');
    await user.click(within(panel).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(cell(/Closure, New carpet, Room 102/)).toBeDefined());
    expect(cell(/Closure, New carpet, Room 102/)!.getAttribute('aria-label')).toMatch(/10\/20/);
    await waitFor(() => expect(url()).toBe('/schedule'));
    expect((await screen.findAllByText('Closure saved.')).length).toBeGreaterThan(0);
  });

  it('refuses dates that run into another closure, on the dates, without calling the API', async () => {
    const client = createMockClient({ today: TODAY });
    await client.schedule.createClosure({
      roomId: 'rm-102',
      startDate: '2026-10-21',
      endDate: '2026-10-23',
      description: 'Next',
      requestId: 'seed-next-closure',
    });
    const update = vi.spyOn(client.schedule, 'updateClosure');
    const { user } = await loaded('/schedule?closure=cl-2', client);
    const panel = await dialog('Room 102 Closure');
    setDate(/Closure End/, '2026-10-22');
    const message = await within(panel).findByText('Room 102 is already closed on those dates.');
    expect(
      within(panel)
        .getByLabelText(/Closure Start/)
        .getAttribute('aria-describedby'),
    ).toContain(message.id);
    await user.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(update).not.toHaveBeenCalled();
    await waitFor(() => expect(within(panel).getByLabelText(/Closure Start/)).toHaveFocus());
  });

  it('removes only after a confirmation; No keeps the closure and the panel', async () => {
    const { user } = await loaded('/schedule?closure=cl-2');
    const panel = await dialog('Room 102 Closure');
    await user.click(within(panel).getByRole('button', { name: 'Remove closure' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(
      within(confirm).getByText(/Are you sure you want to remove Room 102 Closure\?/),
    ).toBeInTheDocument();
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'No' })).toHaveFocus());
    await user.click(within(confirm).getByRole('button', { name: 'No' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(url()).toBe('/schedule?closure=cl-2');
    expect(cell(/Closure, Maintenance/)).toBeDefined();
    await waitFor(() =>
      expect(within(panel).getByRole('button', { name: 'Remove closure' })).toHaveFocus(),
    );

    await user.click(within(panel).getByRole('button', { name: 'Remove closure' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    );
    await waitFor(() => expect(cell(/Closure, Maintenance/)).toBeUndefined());
    await waitFor(() => expect(url()).toBe('/schedule'));
    expect((await screen.findAllByText('Room 102 Closure removed.')).length).toBeGreaterThan(0);
  });

  it('duplicates into the New Room Closure tab, filled in', async () => {
    const { user } = await loaded('/schedule?closure=cl-4');
    const panel = await dialog('Room 302 Closure');
    await user.click(within(panel).getByRole('button', { name: 'Duplicate' }));
    const next = await dialog('New Room Closure');
    expect(url()).toContain('tab=closure');
    expect(within(next).getByRole('combobox', { name: /Room/ })).toHaveValue('Room 302');
    expect(within(next).getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Member event hold',
    );
    // Same dates as the original: the copy collides with it until the dates change.
    expect(
      within(next).getByText(/Room 302 is already closed on those dates\./),
    ).toBeInTheDocument();
  });

  it('keeps the form and says so when the removal cannot be confirmed', async () => {
    const client = createMockClient({ today: TODAY });
    vi.spyOn(client.schedule, 'deleteClosure').mockRejectedValue(new ApiError(500, 'boom'));
    const { user } = await loaded('/schedule?closure=cl-2', client);
    const panel = await dialog('Room 102 Closure');
    await user.click(within(panel).getByRole('button', { name: 'Remove closure' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    );
    expect(await within(panel).findByText(/could not be removed/)).toBeInTheDocument();
    await act(async () => undefined);
    expect(url()).toBe('/schedule?closure=cl-2');
  });

  it('is read-only without the edit permission', async () => {
    await loaded('/schedule?closure=cl-2', undefined, []);
    const panel = await dialog('Room 102 Closure');
    expect(
      within(panel).getByText('You do not have permission to change closures.'),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Remove closure' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(panel).getByRole('textbox', { name: 'Description' })).toBeDisabled();
  });
});
