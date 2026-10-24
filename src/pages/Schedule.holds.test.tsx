import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient, ScheduleData } from '../api/types';
import { GrantedAccess } from '../app/testing';
import { formatHoldTime } from '../app/slotHolds';
import { theme } from '../theme';
import Schedule from './Schedule';

const TODAY = '2026-10-16';
const T0 = new Date(2026, 9, 16, 9, 0, 0).getTime();
let clock = T0;
const now = () => clock;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});
beforeEach(() => {
  clock = T0;
});

function client(over?: (base: ApiClient) => Partial<ApiClient['schedule']>) {
  const base = createMockClient({ today: TODAY, now: () => new Date(clock) });
  return over ? { ...base, schedule: { ...base.schedule, ...over(base) } } : base;
}

async function loaded(api: ApiClient, url = '/schedule', clockFn: () => number = now) {
  const user = userEvent.setup();
  render(
    <ThemeProvider theme={theme}>
      <GrantedAccess>
        <ApiProvider client={api}>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route path="/schedule" element={<Schedule today={TODAY} now={clockFn} />} />
            </Routes>
          </MemoryRouter>
        </ApiProvider>
      </GrantedAccess>
    </ThemeProvider>,
  );
  await screen.findByRole('grid', { name: 'Schedule', hidden: true });
  return user;
}

const grid = () => screen.getByRole('grid', { name: 'Schedule', hidden: true });
const holdCells = () =>
  within(grid())
    .queryAllByRole('gridcell', { hidden: true })
    .filter((c) => c.getAttribute('data-kind') === 'hold');
const week = (api: ApiClient): Promise<ScheduleData> =>
  api.schedule.get({ startDate: TODAY, days: 7 });
const status = () =>
  screen
    .getAllByRole('status', { hidden: true })
    .map((s) => s.textContent)
    .join(' ');

/** A room nothing is booked, closed or held in tonight. */
async function freeRoomTonight(api: ApiClient): Promise<string> {
  const d = await week(api);
  const taken = (x: { roomId: string; startDate: string; endDate: string }) =>
    x.startDate <= TODAY && x.endDate > TODAY;
  return d.rooms.find(
    (r) =>
      ![...d.blocks, ...d.closures, ...(d.holds ?? [])].some((x) => x.roomId === r.id && taken(x)),
  )!.number;
}

describe("another user's hold on the grid", () => {
  it('is shaded with an accessible name and a "Held until" tooltip', async () => {
    const api = client();
    const user = await loaded(api);
    const [cell] = holdCells();
    const seeded = (await week(api)).holds![0];
    const until = formatHoldTime(seeded.expiresAt);
    expect(holdCells()).toHaveLength(1);
    expect(cell.getAttribute('aria-label')).toMatch(new RegExp(`^Held until ${until}, Room `));
    expect(cell).toHaveAttribute('aria-disabled', 'true');
    // The look is not colour alone: an icon and the text are drawn too.
    expect(within(cell).getByText(`Held until ${until}`)).toBeInTheDocument();
    await user.hover(cell);
    expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent(
      `Held until ${until}`,
    );
  });

  it('opens nothing when clicked, and says the room is held', async () => {
    const user = await loaded(client());
    await user.click(holdCells()[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(status()).toMatch(/is held\. Held until/);
  });

  it('from the keyboard: the cursor reads the hold and Enter says it is held, opening nothing', async () => {
    const api = client();
    const user = await loaded(api);
    const d = await week(api);
    const hold = d.holds![0];
    const row = d.rooms.findIndex((r) => r.id === hold.roomId);
    const col =
      Number(new Date(hold.startDate)) / 86_400_000 - Number(new Date(TODAY)) / 86_400_000;
    grid().focus();
    await user.keyboard('{ArrowDown}'.repeat(row) + '{ArrowRight}'.repeat(col));
    const active = document.getElementById(grid().getAttribute('aria-activedescendant')!)!;
    expect(active.getAttribute('aria-label')).toMatch(/^Held until \d\d:\d\d, Room /);
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(status()).toMatch(/is held\. Held until/);
  });

  it('is not draggable (a press on it starts nothing)', async () => {
    const user = await loaded(client());
    const [cell] = holdCells();
    await user.pointer([
      { keys: '[MouseLeft>]', target: cell },
      { coords: { clientX: 200, clientY: 40 } },
      { keys: '[/MouseLeft]' },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drop-indicator')).not.toBeInTheDocument();
  });

  it('disappears when it expires, without a reload', async () => {
    // Real time here: the sample hold is rewritten to end in about a second.
    const base = createMockClient({ today: TODAY });
    const api: ApiClient = {
      ...base,
      schedule: {
        ...base.schedule,
        get: async (q, o) => {
          const d = await base.schedule.get(q, o);
          return {
            ...d,
            holds: d.holds?.map((h) => ({
              ...h,
              expiresAt: new Date(Date.now() + 1200).toISOString(),
            })),
          };
        },
      },
    };
    await loaded(api, '/schedule', Date.now);
    expect(holdCells()).toHaveLength(1);
    await waitFor(() => expect(holdCells()).toHaveLength(0), { timeout: 4000 });
  });

  it('cannot be chosen for a new booking: the Room field explains and Create is refused', async () => {
    const plain = client();
    const number = await freeRoomTonight(plain);
    const roomId = (await week(plain)).rooms.find((r) => r.number === number)!.id;
    const expiresAt = new Date(T0 + 10 * 60_000).toISOString();
    const api = client((base) => ({
      get: async (q, o) => {
        const d = await base.schedule.get(q, o);
        const tonight = { id: 'hold-other-9', roomId, startDate: TODAY, endDate: '2026-10-17' };
        return { ...d, holds: [...(d.holds ?? []), { ...tonight, expiresAt, mine: false }] };
      },
    }));
    const user = await loaded(api, '/schedule?panel=new');
    const dialog = await screen.findByRole('dialog', { name: 'New Reservation' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
    await user.click(await screen.findByRole('option', { name: `Room ${number}` }));
    const room = within(dialog).getByRole('combobox', { name: 'Room' });
    await waitFor(() => expect(room).toBeInvalid());
    expect(document.getElementById(room.getAttribute('aria-describedby')!)).toHaveTextContent(
      `That room is held by another user until ${formatHoldTime(expiresAt)}.`,
    );
    // Create is refused before anything is sent.
    const created = vi.spyOn(api.reservations, 'create');
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    expect(created).not.toHaveBeenCalled();
    // And no hold of ours was placed on the room the other user holds.
    expect((await week(api)).holds!.filter((h) => h.mine)).toEqual([]);
  });
});

describe('the hold of a booking in progress', () => {
  it('shades the chosen room and dates, and the shading is gone when the panel closes', async () => {
    const api = client();
    const calls: string[] = [];
    const spied: ApiClient = {
      ...api,
      schedule: {
        ...api.schedule,
        holdSlot: (r, o) => {
          calls.push(`hold ${r.roomId} ${r.startDate}`);
          return api.schedule.holdSlot(r, o);
        },
        releaseHold: (id, o) => {
          calls.push('release');
          return api.schedule.releaseHold(id, o);
        },
      },
    };
    const number = await freeRoomTonight(api);
    const user = await loaded(spied);
    const others = holdCells().length;
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await screen.findByRole('dialog', { name: 'New Reservation' });
    expect(holdCells()).toHaveLength(others);
    await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
    await user.click(await screen.findByRole('option', { name: `Room ${number}` }));
    await waitFor(() => expect(holdCells()).toHaveLength(others + 1));
    const mine = holdCells().find((c) => c.getAttribute('aria-label')?.startsWith('Your hold'))!;
    expect(mine.getAttribute('aria-label')).toMatch(
      new RegExp(`^Your hold, held until \\d\\d:\\d\\d, Room ${number},`),
    );
    expect(mine).toHaveAttribute('data-own', 'true');
    expect(calls[0]).toMatch(new RegExp(`^hold .* ${TODAY}$`));

    await user.click(within(dialog).getByRole('button', { name: 'Close new reservation' }));
    await waitFor(() => expect(holdCells()).toHaveLength(others));
    await waitFor(() => expect(calls).toContain('release'));
    // The server has let go of it too.
    expect((await week(spied)).holds!.filter((h) => h.mine)).toEqual([]);
  });

  it('follows the room and dates as they change (one hold, moved)', async () => {
    const api = client();
    const first = await freeRoomTonight(api);
    const user = await loaded(api);
    const others = holdCells().length;
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await screen.findByRole('dialog', { name: 'New Reservation' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
    await user.click(await screen.findByRole('option', { name: `Room ${first}` }));
    await waitFor(() => expect(holdCells()).toHaveLength(others + 1));
    // Clearing the room (Unassigned) holds nothing.
    await user.click(within(dialog).getByRole('button', { name: /clear/i }));
    await waitFor(() => expect(holdCells()).toHaveLength(others));
    await waitFor(async () =>
      expect((await week(api)).holds!.filter((h) => h.mine)).toHaveLength(0),
    );
  });

  it('a refused hold (the room was just booked) explains on the Room field and reloads the schedule', async () => {
    let gets = 0;
    const api = client((base) => ({
      get: (q, o) => {
        gets++;
        return base.schedule.get(q, o);
      },
    }));
    const user = await loaded(api);
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await screen.findByRole('dialog', { name: 'New Reservation' });
    const before = gets;
    await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
    // 203 is booked tonight in the sample data.
    await user.click(await screen.findByRole('option', { name: 'Room 203' }));
    const room = within(dialog).getByRole('combobox', { name: 'Room' });
    await waitFor(() => expect(room).toBeInvalid());
    expect(document.getElementById(room.getAttribute('aria-describedby')!)).toHaveTextContent(
      'That room is booked or closed on those dates.',
    );
    await waitFor(() => expect(gets).toBeGreaterThan(before));
    expect(
      holdCells().filter((c) => c.getAttribute('aria-label')?.startsWith('Your hold')),
    ).toHaveLength(0);
  });

  it('a hold request that fails on the network does not block the form', async () => {
    const api = client(() => ({
      holdSlot: () => Promise.reject(new Error('offline')),
    }));
    const number = await freeRoomTonight(api);
    const user = await loaded(api);
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await screen.findByRole('dialog', { name: 'New Reservation' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
    await user.click(await screen.findByRole('option', { name: `Room ${number}` }));
    expect(within(dialog).getByRole('combobox', { name: 'Room' })).toBeValid();
    expect(
      holdCells().filter((c) => c.getAttribute('aria-label')?.startsWith('Your hold')),
    ).toHaveLength(0);
  });
});
