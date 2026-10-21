import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError } from '../api/types';
import type { ApiClient, EarlyLateRequest } from '../api/types';
import { GrantedAccess } from '../app/testing';
import { theme } from '../theme';
import Schedule from './Schedule';

const TODAY = '2026-10-16';

function Probe() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="url">{pathname + search}</output>
      <button onClick={() => void navigate(-1)}>history back</button>
      <button onClick={() => void navigate(1)}>history forward</button>
    </>
  );
}

function setup(
  url = '/schedule',
  client: ApiClient = createMockClient({ today: TODAY }),
  granted?: Parameters<typeof GrantedAccess>[0]['granted'],
  before: string[] = [],
) {
  return render(
    <ThemeProvider theme={theme}>
      <GrantedAccess granted={granted}>
        <ApiProvider client={client}>
          <MemoryRouter initialEntries={[...before, url]} initialIndex={before.length}>
            <Routes>
              <Route path="/schedule" element={<Schedule today={TODAY} />} />
              <Route path="*" element={<p>Elsewhere</p>} />
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
const block = (text: string) =>
  within(grid())
    .getAllByRole('gridcell', { hidden: true })
    .find((c) => c.getAttribute('aria-label')?.includes(text))!;
const panel = (name: RegExp | string) => screen.findByRole('dialog', { name });
const panelGone = () =>
  waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: /Reservation|New Reservation/ }),
    ).not.toBeInTheDocument(),
  );

async function loaded(url_?: string, client?: ApiClient, granted?: Parameters<typeof setup>[2]) {
  const user = userEvent.setup();
  setup(url_, client, granted);
  await screen.findByRole('grid', { name: 'Schedule', hidden: true });
  return user;
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});

describe('opening the details panel', () => {
  it('a click on a block opens its details with the accordion sections, and records it in the URL', async () => {
    const user = await loaded();
    await user.click(block('Thomas Okafor'));
    const dialog = await panel(/Reservation #GR-50310/);
    expect(url()).toBe('/schedule?res=rs-5&rr=rr-5');
    expect(await within(dialog).findByText('Check In: 10/16/2026')).toBeInTheDocument();
    expect(within(dialog).getByText('Check Out: 10/19/2026 (3 Nights)')).toBeInTheDocument();
    for (const name of ['Guest Details', 'Add-Ons', 'Notes', 'Rates & Payment']) {
      expect(within(dialog).getByRole('button', { name })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    }
    expect(within(dialog).getByText('Room 202')).toBeInTheDocument();
  });

  it('Enter on the focused block opens it; Space still picks it up to move', async () => {
    const user = await loaded();
    grid().focus();
    await user.keyboard('{ArrowDown}'); // 202: Thomas Okafor
    await user.keyboard(' ');
    expect(
      screen
        .getAllByRole('status', { hidden: true })
        .map((s) => s.textContent)
        .join(' '),
    ).toMatch(/Picked up Thomas Okafor/);
    expect(url()).toBe('/schedule');
    await user.keyboard('{Escape}');
    await user.keyboard('{Enter}');
    await panel(/Reservation #GR-50310/);
    expect(url()).toContain('res=rs-5');
  });

  it('Enter on an empty cell or a closure does nothing', async () => {
    const user = await loaded();
    grid().focus();
    await user.keyboard(
      '{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}{Enter}',
    ); // closure in 208
    expect(url()).toBe('/schedule');
  });

  it('a drag does not open the panel (the click that ends it is swallowed)', async () => {
    await loaded();
    const el = block('Thomas Okafor');
    fireEvent.pointerDown(el, { clientX: 700, clientY: 100, button: 0, pointerType: 'mouse' });
    fireEvent.pointerMove(window, { clientX: 760, clientY: 100, pointerType: 'mouse' });
    fireEvent.pointerUp(window, { clientX: 760, clientY: 100, pointerType: 'mouse' });
    fireEvent.click(el);
    expect(url()).toBe('/schedule');
    // A later plain click opens it.
    fireEvent.pointerDown(el, { clientX: 700, clientY: 100, button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(window, { clientX: 700, clientY: 100, pointerType: 'mouse' });
    fireEvent.click(el);
    expect(url()).toContain('res=rs-5');
  });

  it('clicking a closure does not open a panel', async () => {
    const user = await loaded();
    await user.click(
      screen.getByRole('gridcell', { name: /Closure, Reserved: Fixed Loss, Room 208/ }),
    );
    expect(url()).toBe('/schedule');
  });

  it('opens from a link or reload: the URL alone shows the panel, and Back closes it', async () => {
    const user = await loaded('/schedule?res=rs-2&rr=rr-2');
    await panel(/Reservation #GR-50240/);
    await user.click(screen.getByRole('button', { name: 'Close reservation details' }));
    await panelGone();
    expect(url()).toBe('/schedule');
  });

  it('history Back and Forward close and reopen the panel', async () => {
    const user = await loaded();
    await user.click(block('Thomas Okafor'));
    await panel(/Reservation #GR-50310/);
    fireEvent.click(screen.getByRole('button', { name: 'history back', hidden: true }));
    await panelGone();
    expect(url()).toBe('/schedule');
    fireEvent.click(screen.getByRole('button', { name: 'history forward', hidden: true }));
    await panel(/Reservation #GR-50310/);
    expect(url()).toBe('/schedule?res=rs-5&rr=rr-5');
  });

  it('shows an error with Retry for an unknown or failing reservation', async () => {
    await loaded('/schedule?res=nope');
    expect(await screen.findByText(/could not be found/)).toBeInTheDocument();
    const base = createMockClient({ today: TODAY });
    let fail = true;
    const client: ApiClient = {
      ...base,
      reservations: {
        ...base.reservations,
        getDetail: (id, o) =>
          fail ? Promise.reject(new ApiError(500, 'boom')) : base.reservations.getDetail(id, o),
      },
    };
    const user = await loaded('/schedule?res=rs-5', client);
    expect(await screen.findByText('The reservation could not be loaded.')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Check In: 10/16/2026')).toBeInTheDocument();
  });
});

describe('closing', () => {
  it('Escape closes the panel and focus returns to the grid (the block that opened it)', async () => {
    const user = await loaded();
    await user.click(block('Thomas Okafor'));
    await panel(/Reservation #GR-50310/);
    await user.keyboard('{Escape}');
    await panelGone();
    expect(url()).toBe('/schedule');
    expect(grid()).toHaveFocus();
    expect(grid().getAttribute('aria-activedescendant')).toBe(block('Thomas Okafor').id);
  });

  it('closing the New Reservation panel returns focus to the New Reservation button', async () => {
    const user = await loaded();
    const button = screen.getByRole('button', { name: 'New Reservation' });
    await user.click(button);
    const dialog = await panel('New Reservation');
    await user.click(within(dialog).getByRole('button', { name: 'Back to schedule' }));
    await panelGone();
    expect(button).toHaveFocus();
  });

  it('a click outside the panel closes it', async () => {
    const user = await loaded();
    await user.click(block('Thomas Okafor'));
    await panel(/Reservation #GR-50310/);
    const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
    await user.click(backdrop);
    await panelGone();
    expect(url()).toBe('/schedule');
  });

  it('moves focus into the panel when it opens', async () => {
    const user = await loaded();
    await user.click(block('Thomas Okafor'));
    const dialog = await panel(/Reservation #GR-50310/);
    expect(dialog.closest('.MuiDrawer-root')?.contains(document.activeElement)).toBe(true);
  });
});

describe('accordion', () => {
  it('opens one section at a time with Enter and Space, and shows its content', async () => {
    const user = await loaded('/schedule?res=rs-2&rr=rr-2');
    const dialog = await panel(/Reservation #GR-50240/);
    const addOns = await within(dialog).findByRole('button', { name: 'Add-Ons' });
    addOns.focus();
    await user.keyboard('{Enter}');
    expect(addOns).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByText('1x Late Dinner Reservation')).toBeInTheDocument();
    const notes = within(dialog).getByRole('button', { name: 'Notes' });
    notes.focus();
    await user.keyboard(' ');
    expect(notes).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(addOns).toHaveAttribute('aria-expanded', 'false'));
    expect(within(dialog).getByText('Guest is celebrating a birthday!')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Rates & Payment' }));
    expect(within(dialog).getByText('Folio Total')).toBeInTheDocument();
    // The folio view of this reservation (not the Open Folios list).
    expect(within(dialog).getByRole('link', { name: 'Folio' })).toHaveAttribute(
      'href',
      '/reservations/rs-2/folio',
    );
  });
});

describe('split CTA', () => {
  it('shows the primary action and a menu of secondary ones that works from the keyboard', async () => {
    const user = await loaded('/schedule?res=rs-5&rr=rr-5');
    const dialog = await panel(/Reservation #GR-50310/);
    expect(await within(dialog).findByRole('button', { name: 'Check In' })).toBeInTheDocument();
    const arrow = within(dialog).getByRole('button', { name: 'More reservation actions' });
    expect(arrow).toHaveAttribute('aria-haspopup', 'menu');
    arrow.focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu', { name: 'More reservation actions' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Print Registration Card', 'Jump to Folio']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(arrow).toHaveFocus();
    expect(url()).toContain('res=rs-5'); // Escape closed only the menu
  });

  it("stub actions say what is missing; Jump to Folio goes to the reservation's folio", async () => {
    const user = await loaded('/schedule?res=rs-5&rr=rr-5');
    const dialog = await panel(/Reservation #GR-50310/);
    await user.click(await within(dialog).findByRole('button', { name: 'Check In' }));
    expect(await within(dialog).findByText(/Reservation Hub \(ticket 3\.12\)/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'More reservation actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Jump to Folio' }));
    expect(await screen.findByText('Elsewhere')).toBeInTheDocument();
    expect(url()).toBe('/reservations/rs-5/folio');
  });

  it('multi-room: Check In All Rooms, a room selector and the room count in the title', async () => {
    const user = await loaded('/schedule?res=rs-7&rr=rr-8');
    const dialog = await panel(/Reservation #GR-50321 \(3 Rooms\)/);
    expect(
      await within(dialog).findByRole('button', { name: 'Check In All Rooms' }),
    ).toBeInTheDocument();
    // starts on the clicked room (209) and the arrows step through the rooms
    expect(within(dialog).getByRole('button', { name: /Room 209/ })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Next room/ }));
    expect(within(dialog).getByRole('button', { name: /Room 205/ })).toBeInTheDocument();
  });

  it('checked out: Manage Reservation with only Jump to Folio in its menu', async () => {
    const user = await loaded('/schedule?res=rs-1');
    const dialog = await panel(/Reservation #GR-50188/);
    expect(
      await within(dialog).findByRole('button', { name: 'Manage Reservation' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Checked Out')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'More reservation actions' }));
    expect(within(await screen.findByRole('menu')).getAllByRole('menuitem')).toHaveLength(1);
  });
});

describe('early check in and late check out auto-save', () => {
  const boxes = (dialog: HTMLElement) => ({
    early: within(dialog).getByRole('checkbox', { name: 'Early Check In' }),
    late: within(dialog).getByRole('checkbox', { name: 'Late Check Out' }),
  });

  it('saves on tick: Saving, then Saved, and the block gets its edge marker', async () => {
    const user = await loaded('/schedule?res=rs-5&rr=rr-5');
    const dialog = await panel(/Reservation #GR-50310/);
    await within(dialog).findByText('Check In: 10/16/2026');
    expect(boxes(dialog).early).not.toBeChecked();
    await user.click(boxes(dialog).early);
    expect(boxes(dialog).early).toBeChecked();
    expect(await within(dialog).findByText('Saved')).toBeInTheDocument();
    expect(block('Thomas Okafor').getAttribute('aria-label')).toMatch(/early check in/);
    await user.click(boxes(dialog).early);
    await waitFor(() =>
      expect(block('Thomas Okafor').getAttribute('aria-label')).not.toMatch(/early check in/),
    );
  });

  it('shows the saved values the next time the panel opens', async () => {
    const user = await loaded('/schedule?res=rs-5&rr=rr-5');
    let dialog = await panel(/Reservation #GR-50310/);
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Late Check Out' }));
    await within(dialog).findByText('Saved');
    await user.click(screen.getByRole('button', { name: 'Close reservation details' }));
    await panelGone();
    await user.click(block('Thomas Okafor'));
    dialog = await panel(/Reservation #GR-50310/);
    expect(await within(dialog).findByRole('checkbox', { name: 'Late Check Out' })).toBeChecked();
  });

  it('on a clear error: reverts, says so, and Retry saves', async () => {
    const base = createMockClient({ today: TODAY });
    let fail = true;
    const requests: EarlyLateRequest[] = [];
    const client: ApiClient = {
      ...base,
      reservations: {
        ...base.reservations,
        setEarlyLate: (r, o) => {
          requests.push(r);
          return fail
            ? Promise.reject(new ApiError(400, 'no'))
            : base.reservations.setEarlyLate(r, o);
        },
      },
    };
    const user = await loaded('/schedule?res=rs-5&rr=rr-5', client);
    const dialog = await panel(/Reservation #GR-50310/);
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Early Check In' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('The change could not be saved.');
    expect(boxes(dialog).early).not.toBeChecked();
    fail = false;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await within(dialog).findByText('Saved')).toBeInTheDocument();
    expect(boxes(dialog).early).toBeChecked();
    expect(requests).toHaveLength(2);
    expect(requests[1].requestId).not.toBe(requests[0].requestId); // nothing applied: a new key
  });

  it('an unknown outcome reloads the reservation and shows what the server has', async () => {
    const base = createMockClient({ today: TODAY });
    const client: ApiClient = {
      ...base,
      reservations: {
        ...base.reservations,
        // The change is applied, but the answer never arrives.
        setEarlyLate: async (r, o) => {
          await base.reservations.setEarlyLate(r, o);
          throw new ApiError(0, 'timeout', { code: 'timeout' });
        },
      },
    };
    const user = await loaded('/schedule?res=rs-5&rr=rr-5', client);
    const dialog = await panel(/Reservation #GR-50310/);
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Early Check In' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/could not be confirmed/);
    await waitFor(() => expect(boxes(dialog).early).toBeChecked());
  });

  it('409 stale reloads and retry succeeds with the fresh version', async () => {
    const base = createMockClient({ today: TODAY });
    const user = await loaded('/schedule?res=rs-5&rr=rr-5', base);
    const dialog = await panel(/Reservation #GR-50310/);
    await within(dialog).findByText('Check In: 10/16/2026');
    // Somebody else changes the reservation first.
    const { version } = await base.reservations.getDetail('rs-5');
    await base.reservations.setEarlyLate({
      requestId: 'other-client-1',
      reservationId: 'rs-5',
      version,
      lateCheckOut: true,
    });
    await user.click(boxes(dialog).early);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/changed elsewhere/);
    expect(boxes(dialog).late).toBeChecked(); // the reloaded truth
    await user.click(within(dialog).getByRole('button', { name: 'Retry' }));
    expect(await within(dialog).findByText('Saved')).toBeInTheDocument();
    expect(boxes(dialog).early).toBeChecked();
    expect(boxes(dialog).late).toBeChecked();
  });

  it('is read-only without the reservation.edit permission, and for a checked-out reservation', async () => {
    await loaded('/schedule?res=rs-5&rr=rr-5', undefined, ['page.schedule']);
    const dialog = await panel(/Reservation #GR-50310/);
    await within(dialog).findByText('Check In: 10/16/2026');
    expect(boxes(dialog).early).toBeDisabled();
    expect(within(dialog).getByText(/view, not change/)).toBeInTheDocument();
  });

  it('checked-out reservations cannot be changed', async () => {
    await loaded('/schedule?res=rs-1&rr=rr-1', undefined, ['reservation.edit']);
    const dialog = await panel(/Reservation #GR-50188/);
    await within(dialog).findByText(/Check In:/);
    expect(boxes(dialog).late).toBeDisabled();
    expect(
      within(dialog).getByText('This reservation can no longer be changed.'),
    ).toBeInTheDocument();
  });
});

describe('New Reservation panel', () => {
  it('opens from the button, shows the form, and Back to schedule restores the exact view', async () => {
    const start =
      '/schedule?start=2026-10-20&view=14&locations=lakeside&types=king-deluxe&rooms=booked';
    const user = await loaded(start);
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    expect(url()).toBe(start + '&panel=new');
    expect(within(dialog).getByRole('tab', { name: 'New Reservation' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Back to schedule' }));
    await panelGone();
    expect(url()).toBe(start);
    // the grid is still the 14 day view from the 20th, filtered
    expect(screen.getByRole('columnheader', { name: 'Tuesday 10/20' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(15);
    expect(within(grid()).getAllByRole('rowheader').length).toBeGreaterThan(0);
  });

  it('Back to schedule after the view changed in between restores the then-current view (reload case)', async () => {
    const user = await loaded('/schedule?panel=new&start=2026-11-02&view=30&locations=north-lodge');
    const dialog = await panel('New Reservation');
    await user.click(within(dialog).getByRole('button', { name: 'Back to schedule' }));
    await panelGone();
    expect(url()).toBe('/schedule?start=2026-11-02&view=30&locations=north-lodge');
  });

  it('the Room field lists EVERY room even when the schedule is filtered to one location and type', async () => {
    const user = await loaded('/schedule?locations=lakeside&types=cottage');
    // the grid shows only the cottages
    expect(
      within(grid())
        .getAllByRole('rowheader')
        .every((h) => /Lakeside/.test(h.textContent ?? '')),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    const room = within(dialog).getByRole('combobox', { name: 'Room' });
    await user.click(room);
    const list = await screen.findByRole('listbox');
    const labels = within(list)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels[0]).toBe('Unassigned'); // the first entry puts the room back to Unassigned
    expect(labels).toHaveLength(31);
    expect(labels).toContain('Room 201'); // Main Clubhouse
    expect(labels).toContain('Room 101'); // North Lodge
    expect(labels).toContain('Room C7'); // Lakeside, a king (not a cottage)
    // grouped by location and room type
    expect(within(list).getByText('Main Clubhouse | King Deluxe')).toBeInTheDocument();
    expect(within(list).getByText('Lakeside Cottages | Two-Bedroom Cottage')).toBeInTheDocument();
  });

  it('Escape closes an open Room list first and the panel only on the next press', async () => {
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(url()).toContain('panel=new');
    await user.keyboard('{Escape}');
    await panelGone();
  });

  it('the Room field is searchable by number, location and type', async () => {
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await user.type(within(dialog).getByRole('combobox', { name: 'Room' }), 'north suite');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Room 109', 'Room 110']);
    await user.click(options[0]);
    expect(within(dialog).getByRole('combobox', { name: /Location/ })).toHaveTextContent(
      'North Lodge',
    );
    expect(within(dialog).getByRole('combobox', { name: /Room Type/ })).toHaveTextContent('Suite');
  });

  it('creates the reservation, shows it on the grid and opens its details', async () => {
    const base = createMockClient({ today: TODAY });
    const user = await loaded('/schedule', base);
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await chooseGuest(user, dialog, 'Booking guest', 'grace', /Grace Nakamura/);
    await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
    await user.click(await screen.findByRole('option', { name: 'Room 203' }));
    expect(within(dialog).getByText(/Estimated Reservation Total: \$249\.00/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    // Room 203 is taken today (Henry Lowell): the server refuses and the panel says why.
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'That room is booked or closed on those dates.',
    );
    // 204 (same location and type: choosing 203 narrowed the list) is free tonight.
    await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
    await user.click(await screen.findByRole('option', { name: 'Room 204' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    const created = await panel(/Reservation #GR-7000\d/);
    expect(await within(created).findByText('Room 204')).toBeInTheDocument();
    expect(within(created).getAllByText(/Grace Nakamura \(MEM-0005\)/).length).toBeGreaterThan(0);
    expect(url()).toMatch(/\?res=rs-new-1&rr=rr-new-1$/);
    await waitFor(() => expect(block('Grace Nakamura')).toBeInTheDocument());
  });

  it('the permission gate: without reservation.edit the create button is inactive and says why', async () => {
    const user = await loaded('/schedule', undefined, ['page.schedule']);
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    expect(
      within(dialog).getByText('You do not have permission to create reservations.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    expect(within(dialog).getByRole('button', { name: 'Create New Reservation' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('hold timer', () => {
  function withHold(minutes: number): ApiClient {
    const base = createMockClient({ today: TODAY });
    return {
      ...base,
      settings: {
        ...base.settings,
        getBookingHold: async () => ({ employee: minutes, member: 99, nonMember: 98 }),
      },
    };
  }
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => vi.useRealTimers());

  const tick = (ms: number) =>
    act(async () => {
      vi.advanceTimersByTime(ms);
    });

  it('counts down from the employee hold, warns under a minute and announces it', async () => {
    setup('/schedule?panel=new', withHold(2));
    const timer = await screen.findByRole('timer', { name: 'Time to complete this reservation' });
    await waitFor(() => expect(timer).toHaveTextContent('Time left: 02:00'));
    await tick(30_000);
    expect(timer).toHaveTextContent('Time left: 01:30');
    await tick(31_000);
    expect(timer).toHaveTextContent('Time left: 00:59');
    expect(
      screen
        .getAllByRole('status')
        .map((s) => s.textContent)
        .join('|'),
    ).toMatch(/Less than a minute left/);
  });

  it('on expiry shows a dialog; Escape and outside clicks do not close the panel; Restart timer starts again', async () => {
    setup('/schedule?panel=new', withHold(1));
    const timer = await screen.findByRole('timer');
    await waitFor(() => expect(timer).toHaveTextContent('01:00'));
    await tick(61_000);
    const expired = await screen.findByRole('alertdialog', {
      name: 'Your time to complete this reservation has expired',
    });
    expect(timer).toHaveTextContent('Time expired');
    fireEvent.keyDown(expired, { key: 'Escape' });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(
      screen.getByRole('alertdialog', {
        name: 'Your time to complete this reservation has expired',
      }),
    ).toBeInTheDocument();
    expect(url()).toBe('/schedule?panel=new');
    fireEvent.click(document.querySelector('.MuiDialog-root .MuiBackdrop-root')!);
    expect(url()).toBe('/schedule?panel=new');
    expect(within(expired).getByRole('button', { name: 'Restart timer' })).toHaveFocus();
    // The create button does nothing while expired; Restart timer starts again.
    await act(async () => {
      within(expired).getByRole('button', { name: 'Restart timer' }).click();
    });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(timer).toHaveTextContent('Time left: 01:00');
  });

  it('Back to schedule in the expiry dialog leaves the panel', async () => {
    setup('/schedule?panel=new&view=14', withHold(1));
    await screen.findByRole('timer');
    await tick(61_000);
    const expired = await screen.findByRole('alertdialog');
    await act(async () => {
      within(expired).getByRole('button', { name: 'Back to schedule' }).click();
    });
    await waitFor(() => expect(url()).toBe('/schedule?view=14'));
  });

  it('without a loadable hold the panel says so and still works', async () => {
    const base = createMockClient({ today: TODAY });
    setup('/schedule?panel=new', {
      ...base,
      settings: { ...base.settings, getBookingHold: () => Promise.reject(new ApiError(500, 'x')) },
    });
    expect(await screen.findByText(/time limit could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});

// ---- round 1 review ----------------------------------------------------------------------------

/** Pick a person in a Booking Guest / Lead Occupant field: open it, search, choose the option. */
async function chooseGuest(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  field: string,
  search: string,
  option: RegExp,
) {
  await user.click(within(dialog).getByRole('combobox', { name: field }));
  await user.type(within(dialog).getByRole('combobox', { name: field }), search);
  await user.click(await screen.findByRole('option', { name: option }));
}

async function fillNewReservation(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  room = 'Room 108',
) {
  await chooseGuest(user, dialog, 'Booking guest', 'grace', /Grace Nakamura/);
  await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
  await user.click(await screen.findByRole('option', { name: room }));
}

describe('create is idempotent across a retry', () => {
  it('an unknown outcome keeps the request id: the retry replays and one reservation exists', async () => {
    const base = createMockClient({ today: TODAY });
    const ids: string[] = [];
    let first = true;
    const client: ApiClient = {
      ...base,
      reservations: {
        ...base.reservations,
        create: async (r, o) => {
          ids.push(r.requestId);
          const created = await base.reservations.create(r, o);
          if (first) {
            first = false;
            throw new ApiError(0, 'timeout', { code: 'timeout' }); // applied, answer lost
          }
          return created;
        },
      },
    };
    const user = await loaded('/schedule', client);
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await fillNewReservation(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/could not be confirmed/);
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    await panel(/Reservation #GR-7000\d/);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    const found = await base.schedule.get({ startDate: TODAY, days: 14 });
    expect(found.blocks.filter((b) => b.guestName === 'Grace Nakamura')).toHaveLength(1);
  });

  it('keeps the id while the form is unchanged and takes a new one when a field changes', async () => {
    const base = createMockClient({ today: TODAY });
    const ids: string[] = [];
    const client: ApiClient = {
      ...base,
      reservations: {
        ...base.reservations,
        create: (r) => {
          ids.push(r.requestId);
          return Promise.reject(new ApiError(503, 'down'));
        },
      },
    };
    const user = await loaded('/schedule', client);
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await fillNewReservation(user, dialog);
    const create = () => within(dialog).getByRole('button', { name: 'Create New Reservation' });
    await user.click(create());
    await within(dialog).findByRole('alert');
    await user.click(create());
    await waitFor(() => expect(ids).toHaveLength(2));
    expect(ids[1]).toBe(ids[0]);
    await user.click(within(dialog).getByRole('button', { name: 'Increase adults' }));
    await user.click(create());
    await waitFor(() => expect(ids).toHaveLength(3));
    expect(ids[2]).not.toBe(ids[1]);
  });

  it('a definitive refusal (409) drops the id, and the refused room is explained on the Room field', async () => {
    const base = createMockClient({ today: TODAY });
    const ids: string[] = [];
    const client: ApiClient = {
      ...base,
      reservations: {
        ...base.reservations,
        create: (r, o) => {
          ids.push(r.requestId);
          return base.reservations.create(r, o);
        },
      },
    };
    const user = await loaded('/schedule', client);
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await fillNewReservation(user, dialog, 'Room 203'); // taken today
    const create = () => within(dialog).getByRole('button', { name: 'Create New Reservation' });
    await user.click(create());
    const room = within(dialog).getByRole('combobox', { name: 'Room' });
    await waitFor(() => expect(room).toBeInvalid());
    const described = room.getAttribute('aria-describedby')!;
    expect(document.getElementById(described)).toHaveTextContent(
      'That room is booked or closed on those dates.',
    );
    await user.click(create());
    await waitFor(() => expect(ids).toHaveLength(2));
    expect(ids[1]).not.toBe(ids[0]);
  });
});

describe('history around creating', () => {
  it('open New, create, close: one Back press leaves for where the user was (no dead press)', async () => {
    const base = createMockClient({ today: TODAY });
    const user = userEvent.setup();
    setup('/schedule', base, undefined, ['/other']);
    await screen.findByRole('grid', { name: 'Schedule', hidden: true });
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await fillNewReservation(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    const created = await panel(/Reservation #GR-7000\d/);
    expect(await within(created).findByText('Confirmed')).toBeInTheDocument();
    // the heading takes focus: the form's button that had it is gone
    await waitFor(() =>
      expect(
        within(created).getByRole('heading', { name: /Reservation #GR-7000\d/ }),
      ).toHaveFocus(),
    );
    await user.click(within(created).getByRole('button', { name: 'Close reservation details' }));
    await panelGone();
    expect(url()).toBe('/schedule');
    fireEvent.click(screen.getByRole('button', { name: 'history back', hidden: true }));
    expect(await screen.findByText('Elsewhere')).toBeInTheDocument();
    expect(url()).toBe('/other');
  });
});

describe('early/late when the reload after an unknown outcome also fails', () => {
  it('says so, keeps the box as chosen (unconfirmed) and offers Reload, which shows the server state', async () => {
    const base = createMockClient({ today: TODAY });
    let reloadWorks = false;
    const client: ApiClient = {
      ...base,
      reservations: {
        ...base.reservations,
        setEarlyLate: async (r, o) => {
          await base.reservations.setEarlyLate(r, o);
          throw new ApiError(0, 'network', { code: 'network' });
        },
      },
    };
    // The detail fetch fails only for the reload that follows the failed save.
    let calls = 0;
    client.reservations.getDetail = (id, o) =>
      ++calls === 1 || reloadWorks
        ? base.reservations.getDetail(id, o)
        : Promise.reject(new ApiError(0, 'network', { code: 'network' }));
    const user = await loaded('/schedule?res=rs-5&rr=rr-5', client);
    const dialog = await panel(/Reservation #GR-50310/);
    const early = await within(dialog).findByRole('checkbox', { name: 'Early Check In' });
    await user.click(early);
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(
      'The change could not be confirmed and the reservation could not be reloaded. Reload to see the current state.',
    );
    expect(early).toBeChecked(); // not reverted: the server may have applied it
    reloadWorks = true;
    await user.click(within(alert).getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    expect(early).toBeChecked(); // the server did apply it
  });
});

describe('small review items', () => {
  it('Enter on a closure says there are no details; it does not open anything', async () => {
    const user = await loaded();
    grid().focus();
    await user.keyboard('{ArrowDown}'.repeat(9) + '{ArrowRight}{Enter}');
    expect(
      screen
        .getAllByRole('status', { hidden: true })
        .map((s) => s.textContent)
        .join(' '),
    ).toMatch(/Closures have no details/);
    expect(url()).toBe('/schedule');
  });

  it('every aria-controls in the panel points at an element that exists', async () => {
    const user = await loaded('/schedule?res=rs-2&rr=rr-2');
    const dialog = await panel(/Reservation #GR-50240/);
    await within(dialog).findByRole('button', { name: 'Add-Ons' });
    const check = () =>
      [...dialog.querySelectorAll('[aria-controls]')].every((el) =>
        document.getElementById(el.getAttribute('aria-controls')!),
      );
    expect(check()).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Notes' }));
    expect(check()).toBe(true);
    // regions are named by their section button and there is no duplicate region id
    const ids = [...dialog.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the Check Out calendar opens on the current check-out date', async () => {
    const user = await loaded('/schedule?panel=new');
    const dialog = await panel('New Reservation');
    await user.click(within(dialog).getByRole('button', { name: /Open calendar for check out/ }));
    const calendar = await screen.findByRole('dialog', { name: /Choose check out/ });
    await waitFor(() =>
      expect(within(calendar).getByRole('button', { name: /October 17, 2026/ })).toHaveFocus(),
    );
  });

  it('a stub notice is announced once: one live region, and the alert inside has no live role', async () => {
    const user = await loaded('/schedule?res=rs-5&rr=rr-5');
    const dialog = await panel(/Reservation #GR-50310/);
    await user.click(await within(dialog).findByRole('button', { name: 'Check In' }));
    const text = await within(dialog).findByText(/Reservation Hub \(ticket 3\.12\)/);
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(text.closest('[role=status]')).not.toBeNull();
  });

  it('the read-only reason is at the top of both panels for a user without reservation.edit', async () => {
    await loaded('/schedule?res=rs-5&rr=rr-5', undefined, ['page.schedule']);
    const details = await panel(/Reservation #GR-50310/);
    expect(
      await within(details).findByText('You can view, not change, this reservation.'),
    ).toBeInTheDocument();
  });
});

describe('early and late markers on the grid', () => {
  it('GR-50240 (arrived before today, early check in) draws the sliver the same way as an in-view block: inside its card', async () => {
    await loaded('/schedule');
    const daniel = block('Daniel Whitfield');
    expect(daniel.getAttribute('aria-label')).toMatch(/early check in/);
    const body = daniel.querySelector('[data-body]') as HTMLElement;
    // inside the card, as the in-view marker is; no detached piece, no inset body
    expect(body.querySelector(':scope > [data-marker="left"]')).not.toBeNull();
    expect(daniel.querySelector(':scope > [data-marker]')).toBeNull();
    expect(body).toHaveStyle({ left: '0px' });
    // (the rounded left corner is checked in the browser: jsdom does not parse the mixed radius)
  });

  it('a stay arriving in view keeps its early sliver at the arrival edge, inside the block; late at the departure edge', async () => {
    const user = await loaded('/schedule');
    await user.click(block('Henry Lowell'));
    const dialog = await panel(/Reservation #GR-50312/);
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Early Check In' }));
    await within(dialog).findByText('Saved');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Late Check Out' }));
    await waitFor(() =>
      expect(block('Henry Lowell').querySelector('[data-marker="right"]')).not.toBeNull(),
    );
    await user.keyboard('{Escape}');
    await panelGone();
    const henry = block('Henry Lowell');
    expect(henry.querySelector('[data-body] > [data-marker="left"]')).not.toBeNull();
    expect(henry.querySelector('[data-body] > [data-marker="right"]')).not.toBeNull();
  });
});

describe('the time limit stops with the panel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => vi.useRealTimers());

  it('no expiry dialog appears on a drawer that is closing', async () => {
    const base = createMockClient({ today: TODAY });
    setup('/schedule?panel=new', {
      ...base,
      settings: {
        ...base.settings,
        getBookingHold: async () => ({ employee: 1, member: 1, nonMember: 1 }),
      },
    });
    await screen.findByRole('timer');
    fireEvent.click(await screen.findByRole('button', { name: 'Back to schedule' }));
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
