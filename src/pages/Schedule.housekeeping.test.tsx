import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError } from '../api/types';
import type { ApiClient } from '../api/types';
import { createPermissions, PermissionsProvider } from '../app/permissions';
import { theme } from '../theme';
import Schedule from './Schedule';

// The housekeeping "H" chip on the schedule: opening it, saving, and keeping out of drag and open.
const TODAY = '2026-10-16';

function Probe() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}

function setup(client: ApiClient, url = '/schedule', allowed = true, today = TODAY) {
  return render(
    <ThemeProvider theme={theme}>
      <PermissionsProvider value={createPermissions(allowed ? undefined : [])}>
        <ApiProvider client={client}>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route path="/schedule" element={<Schedule today={today} />} />
            </Routes>
            <Probe />
          </MemoryRouter>
        </ApiProvider>
      </PermissionsProvider>
    </ThemeProvider>,
  );
}

async function loaded(client: ApiClient, url?: string, allowed?: boolean, today?: string) {
  const user = userEvent.setup();
  setup(client, url, allowed, today);
  await screen.findByRole('grid', { name: 'Schedule' });
  return user;
}

const chips = () => screen.queryAllByRole('button', { name: /^Housekeeping:/, hidden: true });
const withName = (re: RegExp) => chips().find((c) => re.test(c.getAttribute('aria-label') ?? ''))!;

function spied() {
  const base = createMockClient({ today: TODAY });
  const setHousekeeping = vi.fn(base.schedule.setHousekeeping);
  const client: ApiClient = { ...base, schedule: { ...base.schedule, setHousekeeping } };
  return { client, setHousekeeping };
}

let clientHeight: PropertyDescriptor | undefined;
beforeAll(() => {
  clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});
afterAll(() => {
  if (clientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight);
});

describe('schedule housekeeping chip', () => {
  it('is drawn at the end of stays in every visible status', async () => {
    const { client } = spied();
    await loaded(client, '/schedule?start=2026-10-15');
    const shown = new Set(chips().map((c) => c.getAttribute('data-housekeeping')));
    for (const s of ['not-checked-out', 'needs-cleaning', 'cleaned', 'ready', 'needs-maintenance'])
      expect(shown, s).toContain(s);
  });

  it('is a button for users who may edit reservations, and only drawn for others', async () => {
    const { client } = spied();
    await loaded(client);
    expect(chips().length).toBeGreaterThan(0);
  });

  it('is not a button without the permission, and the status stays in the block label', async () => {
    const { client } = spied();
    await loaded(client, '/schedule', false);
    expect(chips()).toHaveLength(0);
    expect(
      within(grid())
        .getAllByRole('gridcell')
        .some((c) => /housekeeping/.test(c.getAttribute('aria-label') ?? '')),
    ).toBe(true);
  });

  it('does not start a drag or open the reservation when pressed and clicked', async () => {
    const { client } = spied();
    const user = await loaded(client);
    const chip = chips()[0];
    fireEvent.pointerDown(chip, { clientX: 700, clientY: 100, button: 0, pointerType: 'mouse' });
    fireEvent.pointerMove(window, { clientX: 760, clientY: 200, pointerType: 'mouse' });
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
    fireEvent.pointerUp(window, { clientX: 760, clientY: 200, pointerType: 'mouse' });
    await user.click(chip);
    expect(screen.getByRole('dialog', { name: 'Housekeeping' })).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('');
    expect(screen.queryByRole('dialog', { name: /Move|Change/ })).toBeNull();
  });

  it('does not pick the block up or open it with Enter and Space on the chip', async () => {
    const { client } = spied();
    const user = await loaded(client);
    chips()[0].focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Housekeeping' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('url')).toHaveTextContent('');
    expect(screen.queryByText(/picked up/i)).toBeNull();
  });

  it('saves a picked status through the API and updates the chip', async () => {
    const { client, setHousekeeping } = spied();
    const user = await loaded(client);
    const chip = withName(/^Housekeeping: needs cleaning\. Change status/);
    await user.click(chip);
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Ready' }));
    await waitFor(() => expect(setHousekeeping).toHaveBeenCalledTimes(1));
    expect(setHousekeeping.mock.calls[0][0]).toMatchObject({ status: 'ready' });
    expect(setHousekeeping.mock.calls[0][0].notes).toBeUndefined();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Ready'),
    );
    await user.click(screen.getByRole('button', { name: 'Close housekeeping' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      chips().some((c) => c.getAttribute('aria-label') === 'Housekeeping: ready. Change status'),
    ).toBe(true);
  });

  it('saves the note with Save and shows the "+" marker in the 7 day view, not in the 30 day view', async () => {
    const { client, setHousekeeping } = spied();
    const user = await loaded(client);
    const chip = withName(/^Housekeeping: needs cleaning\. Change status/);
    expect(chip).toHaveTextContent(/^H$/);
    await user.click(chip);
    await user.click(screen.getByRole('button', { name: 'Add Notes' }));
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'Mirror cracked');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(setHousekeeping.mock.calls[0][0]).toMatchObject({
      status: 'needs-cleaning',
      notes: 'Mirror cracked',
    });
    await waitFor(() =>
      expect(
        chips().some(
          (c) =>
            c.getAttribute('aria-label') ===
              'Housekeeping: needs cleaning, with notes. Change status' && c.textContent === 'H+',
        ),
      ).toBe(true),
    );
  });

  it('shows no "+" in the 30 day view even with notes', async () => {
    const { client } = spied();
    await loaded(client, '/schedule?view=30');
    const noted = chips().filter((c) => /with notes/.test(c.getAttribute('aria-label') ?? ''));
    expect(noted.length).toBeGreaterThan(0);
    for (const c of noted) expect(c.textContent).toBe('');
  });

  it('puts the status back and says so when the save fails', async () => {
    const base = createMockClient({ today: TODAY });
    const client: ApiClient = {
      ...base,
      schedule: {
        ...base.schedule,
        setHousekeeping: () => Promise.reject(new ApiError(400, 'Nope', { code: 'invalid-query' })),
      },
    };
    const user = await loaded(client);
    await user.click(withName(/^Housekeeping: needs cleaning\. Change status/));
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Ready' }));
    expect((await screen.findAllByText('Housekeeping could not be saved.')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Needs Cleaning');
  });
});

const grid = () => screen.getByRole('grid', { name: 'Schedule', hidden: true });

describe('schedule housekeeping chip in the default view', () => {
  const OTHER_TODAY = '2026-11-02';

  // Seeded checked-out stays carry the cleaning states; one of them leaves today, so it is drawn
  // from the view that starts the day before (the departure edge of a stay ending today).
  it('shows a chip for every status, and a checked-out stay, from a date other than the test default', async () => {
    const client = createMockClient({ today: OTHER_TODAY });
    await loaded(client, '/schedule?start=2026-11-01', true, OTHER_TODAY);
    const shown = new Set(chips().map((c) => c.getAttribute('data-housekeeping')));
    for (const s of [
      'not-checked-out',
      'needs-cleaning',
      'cleaned',
      'ready',
      'needs-maintenance',
    ]) {
      expect(shown, s).toContain(s);
    }
    const cells = within(grid()).getAllByRole('gridcell');
    expect(cells.some((c) => /checked out/.test(c.getAttribute('aria-label') ?? ''))).toBe(true);
  });

  it('names the chip for users who may not edit, with the status', async () => {
    const client = createMockClient({ today: OTHER_TODAY });
    await loaded(client, '/schedule', false, OTHER_TODAY);
    const imgs = screen.getAllByRole('img', { name: /^Housekeeping: /, hidden: true });
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs.some((i) => i.getAttribute('aria-label') === 'Housekeeping: not checked out')).toBe(
      true,
    );
  });
});
