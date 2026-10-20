import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError } from '../api/types';
import type { ApiClient, ScheduleQuery } from '../api/types';
import { theme } from '../theme';
import Schedule from './Schedule';

// The mock lays its data out around this date: today is Fri 2026-10-16, the grid starts on it.
const TODAY = '2026-10-16';

function Probe() {
  const { pathname, search } = useLocation();
  return <output data-testid="url">{pathname + search}</output>;
}

/** A client whose schedule calls are spied on; everything else comes from the mock. */
function spied(options: Parameters<typeof createMockClient>[0] = {}) {
  const base = createMockClient({ today: TODAY, ...options });
  const get = vi.fn((q: ScheduleQuery, o?: { signal?: AbortSignal }) => base.schedule.get(q, o));
  const moveRoom = vi.fn(base.schedule.moveRoom);
  const moveDates = vi.fn(base.schedule.moveDates);
  const client: ApiClient = { ...base, schedule: { get, moveRoom, moveDates } };
  return { client, get, moveRoom, moveDates };
}

function setup(url = '/schedule', client: ApiClient = createMockClient({ today: TODAY })) {
  return render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/schedule" element={<Schedule today={TODAY} />} />
            <Route path="*" element={<p>Elsewhere</p>} />
          </Routes>
          <Probe />
        </MemoryRouter>
      </ApiProvider>
    </ThemeProvider>,
  );
}

const url = () => screen.getByTestId('url').textContent;
// `hidden`: an open modal panel hides the page from the accessibility tree, the grid is still there.
const grid = () => screen.getByRole('grid', { name: 'Schedule', hidden: true });
const rows = () => within(grid()).getAllByRole('row', { hidden: true });
/** The toast shows its message twice (visible text and a live region). */
const toast = async (text: string | RegExp) => (await screen.findAllByText(text)).length;
const header = (name: string) => screen.getByRole('columnheader', { name });
const item = (text: string) =>
  within(grid())
    .getAllByRole('gridcell')
    .find((c) => c.getAttribute('aria-label')?.includes(text))!;
const rowOf = (room: string) =>
  within(grid())
    .getAllByRole('row')
    .find((r) => within(r).queryByRole('rowheader')?.textContent?.startsWith(room))!;
const liveText = () =>
  screen
    .getAllByRole('status')
    .map((s) => s.textContent)
    .join(' | ');

async function loaded(url_?: string, client?: ApiClient) {
  const user = userEvent.setup();
  setup(url_, client);
  await screen.findByRole('grid', { name: 'Schedule' });
  return user;
}

// jsdom has no layout: give the scroller a tall viewport so every row renders.
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

describe('Schedule grid', () => {
  it('renders the rooms, weekday headers and blocks with accessible names', async () => {
    await loaded();
    expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    expect(header('2026')).toBeInTheDocument();
    expect(header('Friday 10/16')).toHaveAttribute('aria-current', 'date');
    expect(header('Thursday 10/22')).toBeInTheDocument();
    expect(grid()).toHaveAttribute('aria-colcount', '8');
    const row = rowOf('202');
    expect(within(row).getByRole('rowheader')).toHaveTextContent('202Main Clubhouse | King Deluxe');
    expect(
      within(row).getByRole('gridcell', {
        name: /Thomas Okafor, GR-50310, not yet checked in, Room 202, 10\/16\/2026 to 10\/19\/2026/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('gridcell', { name: /Closure, Reserved: Fixed Loss, Room 208/ }),
    ).toBeInTheDocument();
  });

  it.each([
    [7, 8],
    [14, 15],
    [30, 31],
  ])('renders a %i day view', async (days, columnheaders) => {
    await loaded(`/schedule?view=${days}`);
    expect(screen.getAllByRole('columnheader')).toHaveLength(columnheaders);
    expect(screen.getByRole('combobox', { name: /view/i })).toHaveTextContent(`${days} Days`);
  });

  it('shows the first load as a skeleton, then the grid', async () => {
    setup();
    expect(screen.getByRole('status', { name: 'Loading schedule' })).toBeInTheDocument();
    expect(await screen.findByRole('grid', { name: 'Schedule' })).toBeInTheDocument();
  });

  it('virtualizes rows: 200 rooms render only the visible window', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    try {
      await loaded('/schedule?view=30', createMockClient({ today: TODAY, scheduleSize: 'large' }));
      const rows = within(grid()).getAllByRole('row');
      expect(grid()).toHaveAttribute('aria-rowcount', '201');
      expect(rows.length).toBeLessThan(25);
      expect(rows.length).toBeGreaterThan(5);
      // scrolling renders the rows that come into view
      const scroller = grid();
      scroller.scrollTop = 60 * 100;
      fireEvent.scroll(scroller);
      await waitFor(() =>
        expect(
          within(grid())
            .getAllByRole('row')
            .some((r) => r.getAttribute('aria-rowindex') === '102'),
        ).toBe(true),
      );
      expect(within(grid()).getAllByRole('row').length).toBeLessThan(25);
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get: () => 3000,
      });
    }
  });
});

describe('controls', () => {
  it('changes the view length, refetching with the new length', async () => {
    const { client, get } = spied();
    const user = await loaded('/schedule', client);
    expect(get).toHaveBeenLastCalledWith({ startDate: TODAY, days: 7 }, expect.anything());
    await user.click(screen.getByRole('combobox', { name: /view/i }));
    await user.click(screen.getByRole('option', { name: '14 Days' }));
    await waitFor(() => expect(header('Thursday 10/29')).toBeInTheDocument());
    expect(get).toHaveBeenLastCalledWith({ startDate: TODAY, days: 14 }, expect.anything());
    expect(url()).toContain('view=14');
  });

  it('moves one day with the single chevrons and a page with the double ones', async () => {
    const { client, get } = spied();
    const user = await loaded('/schedule', client);
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    await screen.findByRole('columnheader', { name: 'Saturday 10/17' });
    expect(url()).toContain('start=2026-10-17');
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByRole('columnheader', { name: 'Saturday 10/24' });
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    await screen.findByRole('columnheader', { name: 'Friday 10/23' });
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    await screen.findByRole('columnheader', { name: 'Friday 10/16' });
    expect(get).toHaveBeenLastCalledWith({ startDate: '2026-10-16', days: 7 }, expect.anything());
  });

  it('Today returns to the current date and clears the start from the URL', async () => {
    const user = await loaded('/schedule?start=2026-11-10');
    await screen.findByRole('columnheader', { name: 'Tuesday 11/10' });
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await screen.findByRole('columnheader', { name: 'Friday 10/16' });
    expect(url()).toBe('/schedule');
  });

  it('jumps to a date picked in the calendar', async () => {
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'Choose start date' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose start date' });
    await user.click(within(dialog).getByRole('button', { name: /October 20, 2026/ }));
    await screen.findByRole('columnheader', { name: 'Tuesday 10/20' });
    expect(url()).toContain('start=2026-10-20');
  });

  it('restores the view from the URL (reload and Back) and ignores bad input', async () => {
    await loaded('/schedule?start=nonsense&view=99&rooms=what');
    expect(header('Friday 10/16')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(8);
  });

  it('links Night Audit and New Reservation to their routes and the toggle to the list', async () => {
    await loaded();
    expect(screen.getByRole('link', { name: 'Night Audit' })).toHaveAttribute(
      'href',
      '/night-audit-history',
    );
    expect(screen.getByRole('link', { name: 'New Reservation' })).toHaveAttribute(
      'href',
      '/reservations/new/results',
    );
    expect(screen.getByRole('link', { name: 'List view' })).toHaveAttribute(
      'href',
      '/reservations',
    );
    expect(screen.getByRole('button', { name: 'Calendar view' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('filters', () => {
  it('filters by location with Select none / Select all and the checkboxes', async () => {
    const user = await loaded();
    const before = rows().length;
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const panel = await screen.findByRole('dialog', { name: 'Schedule filters' });
    await user.click(within(panel).getByRole('checkbox', { name: 'Lakeside Cottages' }));
    await waitFor(() => expect(rows().length).toBeLessThan(before));
    expect(
      screen.queryByRole('rowheader', { name: /Lakeside/, hidden: true }),
    ).not.toBeInTheDocument();
    expect(url()).toContain('locations=main-clubhouse%2Cnorth-lodge');
    await user.click(within(panel).getByRole('button', { name: 'Select all locations' }));
    await waitFor(() => expect(rows().length).toBe(before));
    expect(url()).not.toContain('locations');
  });

  it('filters by room type and shows an empty message with Clear filters', async () => {
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const panel = await screen.findByRole('dialog', { name: 'Schedule filters' });
    await user.click(within(panel).getByRole('button', { name: 'Select none of the room types' }));
    expect(await screen.findByText('No rooms match the filters.')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Select all room types' }));
    await waitFor(() => expect(grid()).toBeInTheDocument());
    await user.click(within(panel).getByRole('button', { name: 'Select none of the locations' }));
    await user.keyboard('{Escape}');
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(grid()).toBeInTheDocument());
    expect(url()).toBe('/schedule');
  });

  it('shows only booked or only available rooms', async () => {
    const user = await loaded();
    const all = rows().length;
    await user.click(screen.getByRole('button', { name: /all rooms/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Booked only' }));
    await waitFor(() => expect(rows().length).toBeLessThan(all));
    const booked = rows().length;
    expect(url()).toContain('rooms=booked');
    await user.click(screen.getByRole('button', { name: /booked only/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Available only' }));
    await waitFor(() => expect(url()).toContain('rooms=available'));
    const available = rows().length;
    // every room is booked, closed or free: booked + available never exceed all (header row counted once each)
    expect(booked + available - 2).toBeLessThanOrEqual(all);
    expect(rows().some((r) => r.textContent?.startsWith('203'))).toBe(false);
  });
});

describe('states', () => {
  it('shows the empty state', async () => {
    setup('/schedule', createMockClient({ scenario: 'empty', today: TODAY }));
    expect(await screen.findByText('No rooms to show.')).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('shows an error with Retry that loads again', async () => {
    const base = createMockClient({ today: TODAY });
    let calls = 0;
    const client: ApiClient = {
      ...base,
      schedule: {
        ...base.schedule,
        get: (q, o) =>
          ++calls === 1 ? Promise.reject(new ApiError(500, 'boom')) : base.schedule.get(q, o),
      },
    };
    const user = userEvent.setup();
    setup('/schedule', client);
    expect(await screen.findByText('The schedule could not be loaded.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('grid', { name: 'Schedule' })).toBeInTheDocument();
  });

  it('stays in the loading state while the request never settles', () => {
    setup('/schedule', createMockClient({ scenario: 'loading', today: TODAY }));
    expect(screen.getByRole('status', { name: 'Loading schedule' })).toBeInTheDocument();
  });

  it('keeps the grid, busy, while the next range loads', async () => {
    const base = createMockClient({ today: TODAY });
    let release: (() => void) | undefined;
    let calls = 0;
    const client: ApiClient = {
      ...base,
      schedule: {
        ...base.schedule,
        get: (q, o) =>
          ++calls === 1
            ? base.schedule.get(q, o)
            : new Promise((resolve) => (release = () => resolve(base.schedule.get(q, o)))),
      },
    };
    const user = await loaded('/schedule', client);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(grid()).toHaveAttribute('aria-busy', 'true'));
    expect(header('Friday 10/16')).toBeInTheDocument(); // still the old range
    await act(async () => release?.());
    await screen.findByRole('columnheader', { name: 'Friday 10/23' });
    expect(grid()).not.toHaveAttribute('aria-busy');
  });
});

// ---- keyboard drag --------------------------------------------------------------------------

/** Focus the grid and walk the cursor to a room row and day column (0-based). */
async function cursorTo(user: ReturnType<typeof userEvent.setup>, row: number, col: number) {
  grid().focus();
  if (row) await user.keyboard('{ArrowDown}'.repeat(row));
  if (col) await user.keyboard('{ArrowRight}'.repeat(col));
}

describe('keyboard navigation and move', () => {
  it('moves a cell at a time and names the active cell or block', async () => {
    const user = await loaded();
    grid().focus();
    expect(grid()).toHaveAttribute('aria-activedescendant');
    const active = () => document.getElementById(grid().getAttribute('aria-activedescendant')!);
    expect(active()).toHaveAccessibleName(/Daniel Whitfield/); // 201, today: a stay in progress
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}{ArrowRight}');
    expect(active()).toHaveAccessibleName('Room 203, Sunday 10/18, no reservation');
    await user.keyboard('{End}');
    expect(active()).toHaveAccessibleName('Room 203, Thursday 10/22, no reservation');
    await user.keyboard('{Home}{ArrowUp}');
    expect(active()).toHaveAccessibleName(/Thomas Okafor/);
  });

  it('moves a reservation to another room with Enter, the Room Change dialog and Move to New Room', async () => {
    const { client, moveRoom } = spied();
    const user = await loaded('/schedule', client);
    await cursorTo(user, 1, 0); // 202: Thomas Okafor
    await user.keyboard('{Enter}');
    expect(liveText()).toMatch(/Picked up Thomas Okafor/);
    await user.keyboard('{ArrowDown}'.repeat(7)); // 207, free for those nights
    expect(liveText()).toMatch(/Room 207, Friday 10\/16: drop allowed/);
    expect(screen.getByTestId('drop-indicator')).toHaveAttribute('data-allowed', 'true');
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Reservation GR-50310 Room Change' });
    expect(dialog).toHaveTextContent(
      'Please confirm moving this room to Room 207 for dates 10/16/2026 to 10/19/2026.',
    );
    expect(within(dialog).getByRole('button', { name: 'Move to New Room' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(moveRoom).toHaveBeenCalledWith({ reservationRoomId: 'rr-5', toRoomId: 'rm-207' }),
    );
    await waitFor(() =>
      expect(
        within(rowOf('207')).getByRole('gridcell', { name: /Thomas Okafor/ }),
      ).toBeInTheDocument(),
    );
    expect(
      within(rowOf('202')).queryByRole('gridcell', { name: /Thomas Okafor/ }),
    ).not.toBeInTheDocument();
    expect(await toast('Reservation GR-50310 moved.')).toBeGreaterThan(0);
  });

  it('picks up with M too, and Escape cancels without a change', async () => {
    const { client, moveRoom, moveDates } = spied();
    const user = await loaded('/schedule', client);
    await cursorTo(user, 1, 0);
    await user.keyboard('m');
    await user.keyboard('{ArrowDown}{Escape}');
    expect(liveText()).toMatch(/Move cancelled/);
    expect(screen.queryByTestId('drop-indicator')).not.toBeInTheDocument();
    expect(moveRoom).not.toHaveBeenCalled();
    expect(moveDates).not.toHaveBeenCalled();
    expect(
      within(rowOf('202')).getByRole('gridcell', { name: /Thomas Okafor/ }),
    ).toBeInTheDocument();
  });

  it('Cancel and Escape in the dialog leave everything unchanged', async () => {
    const { client, moveRoom } = spied();
    const user = await loaded('/schedule', client);
    for (const close of ['cancel', 'escape']) {
      await cursorTo(user, 1, 0);
      await user.keyboard('{Enter}' + '{ArrowDown}'.repeat(7) + '{Enter}');
      await screen.findByRole('dialog', { name: /Room Change/ });
      if (close === 'cancel') await user.click(screen.getByRole('button', { name: 'Cancel' }));
      else await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(moveRoom).not.toHaveBeenCalled();
      expect(
        within(rowOf('202')).getByRole('gridcell', { name: /Thomas Okafor/ }),
      ).toBeInTheDocument();
      grid().blur();
    }
  });

  const refused = async (
    startUrl: string,
    row: number,
    col: number,
    keys: string,
    message: RegExp,
  ) => {
    const { client, moveRoom, moveDates } = spied();
    const user = await loaded(startUrl, client);
    await cursorTo(user, row, col);
    await user.keyboard('{Enter}' + keys + '{Enter}');
    expect(await toast(message)).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(moveRoom).not.toHaveBeenCalled();
    expect(moveDates).not.toHaveBeenCalled();
  };

  it('refuses a drop on a room with a reservation on the same dates', async () => {
    await refused('/schedule', 1, 0, '{ArrowDown}', /already has a reservation on those dates/);
  });
  it('refuses a drop on a room with a closure on the same dates', async () => {
    await refused('/schedule', 1, 0, '{ArrowDown}'.repeat(8), /closure on those dates/);
  });
  it('refuses a drop on a past date', async () => {
    // start 10/14: Thomas arrives in column 2; one day left is 10/15, before today
    await refused('/schedule?start=2026-10-14', 1, 2, '{ArrowLeft}', /date in the past/);
  });
  it('refuses a locked room type leaving its type', async () => {
    // Julian Brandt (207, locked) moved up to a King room
    await refused('/schedule', 8, 3, '{ArrowUp}'.repeat(8), /locked to its room type/);
  });

  it('does not pick up closures or checked-out rooms, and says why', async () => {
    const { client } = spied();
    const user = await loaded('/schedule', client);
    await cursorTo(user, 9, 1); // closure in 208
    await user.keyboard('{Enter}');
    expect(liveText()).toMatch(/Closures cannot be moved/);
    expect(screen.queryByTestId('drop-indicator')).not.toBeInTheDocument();
  });

  it('does not pick up a checked-out reservation', async () => {
    const user = await loaded('/schedule?start=2026-10-10');
    await cursorTo(user, 0, 0); // Sofia Marchetti, checked out
    await user.keyboard('{Enter}');
    expect(liveText()).toMatch(/Checked-out rooms cannot be moved/);
  });

  it('moves every room of a multi-room reservation to the new dates', async () => {
    const { client, moveDates } = spied();
    const user = await loaded('/schedule', client);
    await cursorTo(user, 3, 2); // 204: Annika Lindqvist, 3 rooms, 10/18 to 10/21
    await user.keyboard('{Enter}{ArrowRight}{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Reservation GR-50321 Date Change' });
    expect(dialog).toHaveTextContent(
      'will change the check in and check out dates for all rooms on the reservation',
    );
    expect(
      within(dialog).getByRole('button', { name: 'split the room from reservation' }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Move to New Dates' }));
    await waitFor(() =>
      expect(moveDates).toHaveBeenCalledWith({
        reservationRoomId: 'rr-7',
        toStartDate: '2026-10-19',
        scope: 'all-rooms',
        toRoomId: undefined,
      }),
    );
    for (const room of ['204', '209', '205']) {
      await waitFor(() =>
        expect(
          within(rowOf(room)).getByRole('gridcell', {
            name: /Annika Lindqvist.*10\/19\/2026 to 10\/22\/2026/,
          }),
        ).toBeInTheDocument(),
      );
    }
  });

  it('the split link moves only this room (scope this-room)', async () => {
    const { client, moveDates } = spied();
    const user = await loaded('/schedule', client);
    await cursorTo(user, 3, 2);
    await user.keyboard('{Enter}{ArrowRight}{Enter}');
    await user.click(
      await screen.findByRole('button', { name: 'split the room from reservation' }),
    );
    await waitFor(() =>
      expect(moveDates).toHaveBeenCalledWith({
        reservationRoomId: 'rr-7',
        toStartDate: '2026-10-19',
        scope: 'this-room',
        toRoomId: undefined,
      }),
    );
    await waitFor(() =>
      expect(
        within(rowOf('204')).getByRole('gridcell', { name: /Annika Lindqvist.*10\/19\/2026/ }),
      ).toBeInTheDocument(),
    );
    expect(
      within(rowOf('209')).getByRole('gridcell', {
        name: /Annika Lindqvist.*10\/18\/2026 to 10\/21\/2026/,
      }),
    ).toBeInTheDocument();
  });

  it('does not offer the split link for a single-room date change, which has its own dialog', async () => {
    const user = await loaded();
    await cursorTo(user, 1, 0); // Thomas, one room
    await user.keyboard('{Enter}{ArrowRight}{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Reservation GR-50310 Date Change' });
    expect(dialog).toHaveTextContent('will change the total rate for the reservation.');
    expect(within(dialog).queryByRole('button', { name: /split/ })).not.toBeInTheDocument();
  });

  it('rolls the block back and shows the reason when the API refuses the move (409)', async () => {
    const { client, moveRoom } = spied();
    moveRoom.mockRejectedValueOnce(
      new ApiError(409, 'Room 207 was just booked.', { code: 'conflict' }),
    );
    const user = await loaded('/schedule', client);
    await cursorTo(user, 1, 0);
    await user.keyboard('{Enter}' + '{ArrowDown}'.repeat(7) + '{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Move to New Room' }));
    expect(await toast('Room 207 was just booked.')).toBeGreaterThan(0);
    expect(
      within(rowOf('202')).getByRole('gridcell', { name: /Thomas Okafor/ }),
    ).toBeInTheDocument();
    expect(
      within(rowOf('207')).queryByRole('gridcell', { name: /Thomas Okafor/ }),
    ).not.toBeInTheDocument();
  });
});

// ---- pointer drag ---------------------------------------------------------------------------

/** jsdom has no layout: describe a 1460px wide grid (130px headers + 7 x 190px days), 60px rows. */
function mockGeometry() {
  const scroller = grid();
  const content = scroller.firstElementChild as HTMLElement;
  const rect = (r: Partial<DOMRect>) => () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
      ...r,
    }) as DOMRect;
  scroller.getBoundingClientRect = rect({
    left: 0,
    top: 0,
    right: 1460,
    bottom: 900,
    width: 1460,
    height: 900,
  });
  content.getBoundingClientRect = rect({
    left: 0,
    top: 0,
    right: 1460,
    bottom: 900,
    width: 1460,
    height: 900,
  });
}
/** Client y of the middle of room row `i` (header 60px). */
const rowY = (i: number) => 60 + 60 * i + 30;
const DAY = 190;

function dragItem(el: HTMLElement, to: { dx?: number; y: number }, { release = true } = {}) {
  const x = 700;
  const y = rowY(Number(el.closest('[role=row]')!.getAttribute('aria-rowindex')) - 2);
  fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, pointerType: 'mouse' });
  fireEvent.pointerMove(window, { clientX: x + 10, clientY: y + 3, pointerType: 'mouse' });
  fireEvent.pointerMove(window, { clientX: x + (to.dx ?? 0), clientY: to.y, pointerType: 'mouse' });
  if (release)
    fireEvent.pointerUp(window, { clientX: x + (to.dx ?? 0), clientY: to.y, pointerType: 'mouse' });
}

describe('pointer drag', () => {
  it('drags to another room: ghost and green indicator, then the Room Change dialog, then the move', async () => {
    const { client, moveRoom } = spied();
    await loaded('/schedule', client);
    mockGeometry();
    dragItem(item('Thomas Okafor'), { y: rowY(8) }, { release: false });
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument();
    expect(screen.getByTestId('drop-indicator')).toHaveAttribute('data-allowed', 'true');
    expect(liveText()).toMatch(/Room 207.*drop allowed/);
    fireEvent.pointerUp(window, { clientX: 700, clientY: rowY(8), pointerType: 'mouse' });
    const dialog = await screen.findByRole('dialog', { name: /Room Change/ });
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move to New Room' }));
    await waitFor(() =>
      expect(moveRoom).toHaveBeenCalledWith({ reservationRoomId: 'rr-5', toRoomId: 'rm-207' }),
    );
    await waitFor(() =>
      expect(
        within(rowOf('207')).getByRole('gridcell', { name: /Thomas Okafor/ }),
      ).toBeInTheDocument(),
    );
  });

  it('drags to a future date: the Date Change dialog with the new dates', async () => {
    const { client, moveDates } = spied();
    await loaded('/schedule', client);
    mockGeometry();
    dragItem(item('Thomas Okafor'), { dx: DAY * 2, y: rowY(1) });
    const dialog = await screen.findByRole('dialog', { name: 'Reservation GR-50310 Date Change' });
    expect(dialog).toHaveTextContent('Room 202 for dates 10/18/2026 to 10/21/2026');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move to New Dates' }));
    await waitFor(() =>
      expect(moveDates).toHaveBeenCalledWith({
        reservationRoomId: 'rr-5',
        toStartDate: '2026-10-18',
        scope: 'all-rooms',
        toRoomId: undefined,
      }),
    );
  });

  it('a combined room and date drop uses the date change dialog and sends both', async () => {
    const { client, moveDates } = spied();
    await loaded('/schedule', client);
    mockGeometry();
    dragItem(item('Thomas Okafor'), { dx: DAY, y: rowY(7) }); // room 206 one day later
    await screen.findByRole('dialog', { name: /Date Change/ });
    await userEvent.click(screen.getByRole('button', { name: 'Move to New Dates' }));
    await waitFor(() =>
      expect(moveDates).toHaveBeenCalledWith({
        reservationRoomId: 'rr-5',
        toStartDate: '2026-10-17',
        scope: 'all-rooms',
        toRoomId: 'rm-206',
      }),
    );
  });

  it('an invalid drop snaps back: nothing changes and the reason is shown', async () => {
    const { client, moveRoom, moveDates } = spied();
    await loaded('/schedule', client);
    mockGeometry();
    dragItem(item('Thomas Okafor'), { y: rowY(9) }, { release: false }); // 208: closure
    expect(screen.getByTestId('drop-indicator')).toHaveAttribute('data-allowed', 'false');
    expect(liveText()).toMatch(/Room 208.*closure on those dates/);
    fireEvent.pointerUp(window, { clientX: 700, clientY: rowY(9), pointerType: 'mouse' });
    expect(await toast(/closure on those dates/)).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
    expect(moveRoom).not.toHaveBeenCalled();
    expect(moveDates).not.toHaveBeenCalled();
    expect(
      within(rowOf('202')).getByRole('gridcell', { name: /Thomas Okafor/ }),
    ).toBeInTheDocument();
  });

  it('a closure cannot be dragged', async () => {
    await loaded();
    mockGeometry();
    dragItem(item('Closure, Reserved: Fixed Loss'), { y: rowY(10) });
    expect(await toast('Closures cannot be moved.')).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a checked-out reservation cannot be dragged', async () => {
    await loaded('/schedule?start=2026-10-10');
    mockGeometry();
    dragItem(item('Sofia Marchetti'), { y: rowY(3) });
    expect(await toast('Checked-out rooms cannot be moved.')).toBeGreaterThan(0);
  });

  it('Escape during a drag cancels it', async () => {
    const { client, moveRoom } = spied();
    await loaded('/schedule', client);
    mockGeometry();
    dragItem(item('Thomas Okafor'), { y: rowY(8) }, { release: false });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument());
    fireEvent.pointerUp(window, { clientX: 700, clientY: rowY(8), pointerType: 'mouse' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(moveRoom).not.toHaveBeenCalled();
  });

  it('dropping where it started does nothing', async () => {
    await loaded();
    mockGeometry();
    dragItem(item('Thomas Okafor'), { y: rowY(1) });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a click without movement is not a drag', async () => {
    await loaded();
    mockGeometry();
    const el = item('Thomas Okafor');
    fireEvent.pointerDown(el, { clientX: 700, clientY: rowY(1), button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(window, { clientX: 700, clientY: rowY(1), pointerType: 'mouse' });
    fireEvent.click(el);
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
    expect(grid()).toHaveFocus();
  });
});
