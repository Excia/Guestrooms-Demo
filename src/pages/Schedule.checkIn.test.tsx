import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { MOCK_MANAGER_PIN } from '../api/overridePin';
import { ApiError } from '../api/types';
import type { ApiClient, CheckInReservationRequest, CheckInReservationResult } from '../api/types';
import { GrantedAccess } from '../app/testing';
import type { Permission } from '../app/permissions';
import { theme } from '../theme';
import Schedule from './Schedule';

// Check in on past dates from the reservation panel (ticket 163). Mock "today" is 10/16/2026.
// rs-31 (room 110) never arrived: 10/12 to 10/15. rs-32 has two rooms since 10/14: room 106 is in
// house, room C8 is waiting. rs-5 (room 202) arrives today; rs-6 (203) has no payment method.
const TODAY = '2026-10-16';
const ANY: Permission[] = ['reservation.edit', 'reservation.check-in.any-time'];
const ARRIVAL_ONLY: Permission[] = ['reservation.edit', 'reservation.check-in.arrival-date'];
const NEVER: Permission[] = ['reservation.edit'];

function Probe() {
  const { pathname, search } = useLocation();
  return <output data-testid="url">{pathname + search}</output>;
}

function setup(url: string, client: ApiClient, granted: Permission[]) {
  return render(
    <ThemeProvider theme={theme}>
      <GrantedAccess granted={granted}>
        <ApiProvider client={client}>
          <MemoryRouter initialEntries={[url]}>
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
const dialog = (name: RegExp | string) => screen.findByRole('dialog', { name });
const details = (conf: RegExp) => dialog(conf);

async function open(
  res: string,
  {
    client = createMockClient({ today: TODAY }),
    granted = ANY,
    room,
  }: { client?: ApiClient; granted?: Permission[]; room?: string } = {},
) {
  const user = userEvent.setup();
  setup(`/schedule?res=${res}${room ? `&rr=${room}` : ''}`, client, granted);
  return { user, client };
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});

describe('check in on the arrival date', () => {
  it('opens the check in panel with no prior-date notice, then completes and names the room', async () => {
    const { user } = await open('rs-5', { room: 'rr-5' });
    const panel = await details(/Reservation #GR-50310/);
    await user.click(await within(panel).findByRole('button', { name: 'Check In' }));
    const checkIn = await dialog('Check in');
    expect(within(checkIn).queryByText(/has passed/)).not.toBeInTheDocument();
    expect(within(checkIn).getByRole('heading', { name: 'Check in' })).toHaveFocus();
    await user.click(within(checkIn).getByRole('button', { name: 'Complete check in' }));
    expect(
      (await screen.findAllByText('You have successfully checked in Room 202.')).length,
    ).toBeGreaterThan(0);
    // The panel is back on the details, now checked in, and the heading has focus.
    const back = await details(/Reservation #GR-50310/);
    expect(await within(back).findByText('Checked In')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(back).getByRole('heading', { name: /Reservation #GR-50310/ })).toHaveFocus(),
    );
  });

  it('updates the schedule block without a reload', async () => {
    const { user, client } = await open('rs-5', { room: 'rr-5' });
    const panel = await details(/Reservation #GR-50310/);
    await user.click(await within(panel).findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Complete check in' }));
    await waitFor(async () => {
      const data = await client.schedule.get({ startDate: '2026-10-06', days: 30 });
      expect(data.blocks.find((b) => b.id === 'rr-5')?.status).toBe('checked-in');
    });
    const cell = (await screen.findAllByRole('gridcell', { hidden: true })).find((c) =>
      c.getAttribute('aria-label')?.includes('GR-50310'),
    )!;
    await waitFor(() => expect(cell.getAttribute('aria-label')).toMatch(/checked in/i));
  });

  it('the back button returns to the details without checking in', async () => {
    const { user, client } = await open('rs-5', { room: 'rr-5' });
    const panel = await details(/Reservation #GR-50310/);
    await user.click(await within(panel).findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Back to details' }));
    expect(await screen.findByRole('button', { name: 'Check In' })).toBeInTheDocument();
    expect((await client.reservations.getDetail('rs-5')).rooms[0].status).toBe('nyci');
  });
});

describe('check in on a past date', () => {
  it('asks first, naming the original arrival date; Escape closes it and returns focus', async () => {
    const { user, client } = await open('rs-31');
    const panel = await details(/Reservation #GR-50395/);
    const button = await within(panel).findByRole('button', { name: 'Check In' });
    await user.click(button);
    const prompt = await dialog('The check-in date of 10/12/2026 has passed');
    expect(
      within(prompt).getByText(/Check in for the original date, or adjust the reservation dates\?/),
    ).toBeInTheDocument();
    expect(within(prompt).getByRole('button', { name: 'Adjust reservation dates' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /has passed/ })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(button).toHaveFocus());
    expect((await client.reservations.getDetail('rs-31')).rooms[0].status).toBe('nyci');
  });

  it('"adjust reservation dates" does not check in and explains where it goes', async () => {
    const { user, client } = await open('rs-31');
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Adjust reservation dates' }));
    expect(
      await screen.findByText(/Editing a reservation arrives with the Reservation Hub/),
    ).toBeInTheDocument();
    expect((await client.reservations.getDetail('rs-31')).rooms[0].status).toBe('nyci');
  });

  it('continues to the panel with the prior-date notice, then checks in and out automatically', async () => {
    const { user, client } = await open('rs-31');
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Check in for original date' }));
    const checkIn = await dialog('Check in');
    expect(
      within(checkIn).getByText(/Confirm that you want to check in for a prior date/),
    ).toBeInTheDocument();
    expect(within(checkIn).getByText(/checked out automatically/)).toBeInTheDocument();
    await user.click(within(checkIn).getByRole('button', { name: 'Complete check in' }));
    const done = await dialog('The check-out date has passed');
    expect(within(done).getByText(/check-out date of 10\/15\/2026/)).toBeInTheDocument();
    expect(within(done).getByRole('button', { name: 'Run night audit' })).toHaveFocus();
    const stored = await client.reservations.getDetail('rs-31');
    expect(stored.status).toBe('checked-out');
    expect(stored.rooms[0].checkedInAt).toBeDefined();
    expect(stored.rooms[0].checkedOutAt).toBeDefined();
    await user.click(within(done).getByRole('button', { name: 'Run night audit' }));
    expect(await screen.findByText('Elsewhere')).toBeInTheDocument();
    expect(url()).toBe('/night-audit-history');
  });

  it('closing the automatic check-out dialog returns focus to the reservation heading', async () => {
    const { user } = await open('rs-31');
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Check in for original date' }));
    await user.click(await screen.findByRole('button', { name: 'Complete check in' }));
    const done = await dialog('The check-out date has passed');
    await user.click(within(done).getByRole('button', { name: 'Close' }));
    const back = await details(/Reservation #GR-50395/);
    await waitFor(() =>
      expect(within(back).getByRole('heading', { name: /Reservation #GR-50395/ })).toHaveFocus(),
    );
    expect(await within(back).findByText('Checked Out')).toBeInTheDocument();
  });
});

describe('permission levels', () => {
  it('"never": Check In is disabled with the reason', async () => {
    const { user } = await open('rs-5', { room: 'rr-5', granted: NEVER });
    const button = await screen.findByRole('button', { name: 'Check In' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('You do not have permission to check in.');
    await user.click(button);
    expect(screen.queryByRole('dialog', { name: 'Check in' })).not.toBeInTheDocument();
  });

  it('"arrival date only": checks in on the arrival date without a code', async () => {
    const { user } = await open('rs-5', { room: 'rr-5', granted: ARRIVAL_ONLY });
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    expect(await dialog('Check in')).toBeInTheDocument();
  });

  it('"arrival date only": a past date reads "Override and check in" and asks for a code', async () => {
    const { user, client } = await open('rs-31', { granted: ARRIVAL_ONLY });
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    const prompt = await dialog(/has passed/);
    expect(within(prompt).getByText(/enter an override code/)).toBeInTheDocument();
    await user.click(within(prompt).getByRole('button', { name: 'Override and check in' }));
    const code = await dialog('Enter override code to check in after the check-in date');
    const field = within(code).getByLabelText('Override code');
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('type', 'password');
    await user.type(field, '0000');
    await user.click(within(code).getByRole('button', { name: 'Override and check in' }));
    expect(await within(code).findByText('That override code is not valid.')).toBeInTheDocument();
    expect(field).toBeInvalid();
    expect((await client.reservations.getDetail('rs-31')).rooms[0].status).toBe('nyci');
    await user.clear(field);
    await user.type(field, `${MOCK_MANAGER_PIN}{Enter}`);
    const checkIn = await dialog('Check in');
    expect(
      within(checkIn).getByText(/Confirm that you want to check in for a prior date/),
    ).toBeInTheDocument();
    await user.click(within(checkIn).getByRole('button', { name: 'Complete check in' }));
    await dialog('The check-out date has passed');
    expect((await client.reservations.getDetail('rs-31')).rooms[0].status).toBe('checked-out');
  });

  it('cancelling the override code goes back to the prompt', async () => {
    const { user } = await open('rs-31', { granted: ARRIVAL_ONLY });
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Override and check in' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    const prompt = await dialog(/has passed/);
    expect(within(prompt).getByRole('button', { name: 'Adjust reservation dates' })).toHaveFocus();
  });
});

describe('partial reservation (another room is already checked in)', () => {
  it('offers a split instead of adjusting the dates; keeping the rooms together changes nothing', async () => {
    const { user, client } = await open('rs-32', { room: 'rr-32' });
    await user.click(await screen.findByRole('button', { name: 'Check In Remaining Rooms' }));
    const prompt = await dialog(/has passed/);
    expect(within(prompt).getByText(/already checked in or out/)).toBeInTheDocument();
    expect(
      within(prompt).queryByRole('button', { name: 'Adjust reservation dates' }),
    ).not.toBeInTheDocument();
    await user.click(
      within(prompt).getByRole('button', { name: 'Split this room from the reservation' }),
    );
    const confirm = await dialog('Split room from reservation?');
    expect(within(confirm).getByText(/Room C8 from reservation #GR-50396/)).toBeInTheDocument();
    expect(within(confirm).getByRole('button', { name: 'No, keep rooms together' })).toHaveFocus();
    await user.click(within(confirm).getByRole('button', { name: 'No, keep rooms together' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Split room from reservation?' }),
      ).not.toBeInTheDocument(),
    );
    expect((await client.reservations.getDetail('rs-32')).rooms).toHaveLength(2);
    const back = await details(/Reservation #GR-50396/);
    await waitFor(() =>
      expect(within(back).getByRole('heading', { name: /Reservation #GR-50396/ })).toHaveFocus(),
    );
  });

  it('splitting creates a reservation of its own and opens it', async () => {
    const { user, client } = await open('rs-32', { room: 'rr-32' });
    await user.click(await screen.findByRole('button', { name: 'Check In Remaining Rooms' }));
    await user.click(
      await screen.findByRole('button', { name: 'Split this room from the reservation' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Yes, split Room C8' }));
    await waitFor(() => expect(url()).toMatch(/res=rs-split-\d+/));
    expect((await client.reservations.getDetail('rs-32')).rooms).toHaveLength(1);
    expect(await screen.findByText(/Reservation #GR-8000\d/)).toBeInTheDocument();
  });

  it('checks in one room from the room selector; the others are listed, not selectable', async () => {
    const { user, client } = await open('rs-32', { room: 'rr-32' });
    const panel = await details(/Reservation #GR-50396/);
    await user.click(await within(panel).findByRole('button', { name: 'Check In Room' }));
    await user.click(await screen.findByRole('button', { name: 'Check in for original date' }));
    const checkIn = await dialog('Check in');
    const group = within(checkIn).getByRole('group', { name: 'Select rooms to check in' });
    expect(within(group).getByRole('checkbox', { name: /Room C8/ })).toBeChecked();
    expect(within(group).queryByRole('checkbox', { name: /Room 106/ })).not.toBeInTheDocument();
    expect(within(group).getByText(/^Checked in/)).toBeInTheDocument();
    await user.click(within(checkIn).getByRole('button', { name: 'Check in 1 room' }));
    expect(
      (await screen.findAllByText('You have successfully checked in all rooms.')).length,
    ).toBeGreaterThan(0);
    expect((await client.reservations.getDetail('rs-32')).rooms.map((r) => r.status)).toEqual([
      'checked-in',
      'checked-in',
    ]);
  });

  it('the Complete button is off while no room is ticked', async () => {
    const { user } = await open('rs-32', { room: 'rr-32' });
    await user.click(await screen.findByRole('button', { name: 'Check In Room' }));
    await user.click(await screen.findByRole('button', { name: 'Check in for original date' }));
    const checkIn = await dialog('Check in');
    await user.click(within(checkIn).getByRole('checkbox', { name: /Room C8/ }));
    expect(within(checkIn).getByRole('button', { name: 'Check in 0 rooms' })).toBeDisabled();
  });
});

describe('payment method and room readiness', () => {
  it('opens the Payment Methods placeholder when none is on file, then continues the check in', async () => {
    const { user, client } = await open('rs-6', { room: 'rr-6' });
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    const checkIn = await dialog('Check in');
    await user.click(within(checkIn).getByRole('button', { name: 'Complete check in' }));
    const payment = await dialog('Add a payment method to check in');
    expect(within(payment).getByRole('button', { name: 'Add mock card' })).toHaveFocus();
    expect((await client.reservations.getDetail('rs-6')).rooms[0].status).toBe('nyci');
    await user.click(within(payment).getByRole('button', { name: 'Add mock card' }));
    expect(
      (await screen.findAllByText('You have successfully checked in Room 203.')).length,
    ).toBeGreaterThan(0);
    expect((await client.reservations.getDetail('rs-6')).rooms[0].status).toBe('checked-in');
  });

  it('cancelling the Payment Methods dialog leaves the panel open and checks nothing in', async () => {
    const { user, client } = await open('rs-6', { room: 'rr-6' });
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Complete check in' }));
    await user.click(
      await within(await dialog('Add a payment method to check in')).findByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(await dialog('Check in')).toBeInTheDocument();
    expect((await client.reservations.getDetail('rs-6')).rooms[0].status).toBe('nyci');
  });

  it('a dirty room cannot be checked in', async () => {
    const client = createMockClient({ today: TODAY });
    const block = (await client.schedule.get({ startDate: '2026-10-06', days: 30 })).blocks.find(
      (b) => b.id === 'rr-35',
    )!;
    await client.schedule.setHousekeeping({
      reservationRoomId: 'rr-35',
      requestId: 'req-dirty-0001',
      version: block.version,
      status: 'needs-cleaning',
    });
    const { user } = await open('rs-22', { client, room: 'rr-25' });
    const button = await screen.findByRole('button', { name: 'Check In' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(
      'This room is dirty or not ready, so it cannot be checked in.',
    );
    await user.click(button);
    expect(screen.queryByRole('dialog', { name: 'Check in' })).not.toBeInTheDocument();
  });
});

describe('results and failures', () => {
  const wrap = (check: (r: CheckInReservationRequest) => Promise<CheckInReservationResult>) => {
    const base = createMockClient({ today: TODAY });
    return { ...base, reservations: { ...base.reservations, checkIn: check } } as ApiClient;
  };

  it('lists the rooms that could not be checked in with the reason', async () => {
    const base = createMockClient({ today: TODAY });
    const client = wrap(async (r) => {
      const reservation = await base.reservations.getDetail(r.reservationId);
      return {
        reservation,
        rooms: [{ reservationRoomId: 'rr-32', checkedIn: false, failure: 'occupied' }],
        autoCheckedOut: false,
        nightsPosted: 0,
        integrationErrors: [],
      };
    });
    const { user } = await open('rs-32', { client, room: 'rr-32' });
    await user.click(await screen.findByRole('button', { name: 'Check In Room' }));
    await user.click(await screen.findByRole('button', { name: 'Check in for original date' }));
    await user.click(await screen.findByRole('button', { name: 'Check in 1 room' }));
    const result = await dialog('1 room could not be checked in:');
    expect(within(result).getByText('Reservation GR-50396 | Room C8')).toBeInTheDocument();
    expect(
      within(result).getByText('Another reservation is still checked in to the assigned room.'),
    ).toBeInTheDocument();
    await user.click(within(result).getByRole('button', { name: 'Close' }));
    const back = await details(/Reservation #GR-50396/);
    await waitFor(() =>
      expect(within(back).getByRole('heading', { name: /Reservation #GR-50396/ })).toHaveFocus(),
    );
  });

  it('shows an error toast when the request fails and keeps the panel open', async () => {
    const client = wrap(async () => {
      throw new ApiError(400, 'bad', { code: 'invalid-query' });
    });
    const { user } = await open('rs-5', { client, room: 'rr-5' });
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Complete check in' }));
    expect((await screen.findAllByText('Could not check in. Try again.')).length).toBeGreaterThan(
      0,
    );
    expect(await dialog('Check in')).toBeInTheDocument();
  });

  it('reports an integration error after a check in that went through', async () => {
    const base = createMockClient({ today: TODAY });
    const client = wrap(async (r) => {
      const real = await base.reservations.checkIn(r);
      return { ...real, integrationErrors: [{ kind: 'key-card', message: 'Encoder offline' }] };
    });
    const { user } = await open('rs-5', { client, room: 'rr-5' });
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Complete check in' }));
    expect(
      (await screen.findAllByText(/Key card integration reported an error/)).length,
    ).toBeGreaterThan(0);
  });

  it('retries with the same idempotency key after an unknown outcome', async () => {
    const base = createMockClient({ today: TODAY });
    const keys: string[] = [];
    let first = true;
    const client = wrap(async (r) => {
      keys.push(r.requestId);
      if (first) {
        first = false;
        throw new ApiError(500, 'boom');
      }
      return base.reservations.checkIn(r);
    });
    const { user } = await open('rs-5', { client, room: 'rr-5' });
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Complete check in' }));
    expect(
      (await screen.findAllByText(/Could not confirm whether the check in went through/)).length,
    ).toBeGreaterThan(0);
    await user.click(await screen.findByRole('button', { name: 'Complete check in' }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[1]).toBe(keys[0]);
  });

  it('sends the override code back to its step when the backend refuses it', async () => {
    const base = createMockClient({ today: TODAY });
    const client = wrap(async () => {
      throw new ApiError(403, 'no', { code: 'override-invalid' });
    });
    client.overrides = base.overrides;
    const { user } = await open('rs-31', { client, granted: ARRIVAL_ONLY });
    await user.click(await screen.findByRole('button', { name: 'Check In' }));
    await user.click(await screen.findByRole('button', { name: 'Override and check in' }));
    await user.type(await screen.findByLabelText('Override code'), `${MOCK_MANAGER_PIN}{Enter}`);
    await user.click(await screen.findByRole('button', { name: 'Complete check in' }));
    expect((await screen.findAllByText(/override code was not accepted/)).length).toBeGreaterThan(
      0,
    );
    expect(
      await dialog('Enter override code to check in after the check-in date'),
    ).toBeInTheDocument();
  });
});

describe('rooms with different dates on one reservation', () => {
  // rs-32 with its two rooms rewritten: room 106 and room C8 both wait for check in.
  const withRooms = (
    edit: (rooms: Awaited<ReturnType<ApiClient['reservations']['getDetail']>>['rooms']) => void,
  ) => {
    const base = createMockClient({ today: TODAY });
    return {
      ...base,
      reservations: {
        ...base.reservations,
        getDetail: async (id: string) => {
          const detail = await base.reservations.getDetail(id);
          if (id === 'rs-32') edit(detail.rooms);
          return detail;
        },
      },
    } as ApiClient;
  };

  it('a room arriving later is listed as not yet and left out of the check in', async () => {
    const client = withRooms((rooms) => {
      Object.assign(rooms[0], { status: 'nyci', arrival: TODAY, departure: '2026-10-20' });
      Object.assign(rooms[1], { status: 'nyci', arrival: '2026-10-17', departure: '2026-10-20' });
    });
    const { user } = await open('rs-32', { client });
    await user.click(await screen.findByRole('button', { name: 'Check In All Rooms' }));
    const checkIn = await dialog('Check in');
    expect(within(checkIn).getByRole('checkbox', { name: /Room 106/ })).toBeChecked();
    expect(within(checkIn).queryByRole('checkbox', { name: /Room C8/ })).not.toBeInTheDocument();
    expect(
      within(checkIn).getByText(/Not yet: this room arrives 10\/17\/2026/),
    ).toBeInTheDocument();
    expect(within(checkIn).getByRole('button', { name: 'Check in 1 room' })).toBeEnabled();
  });

  it('says which rooms are checked out automatically when only some departures have passed', async () => {
    const client = withRooms((rooms) => {
      Object.assign(rooms[0], { status: 'nyci', arrival: '2026-10-12', departure: '2026-10-15' });
      Object.assign(rooms[1], { status: 'nyci', arrival: '2026-10-12', departure: '2026-10-20' });
    });
    const { user } = await open('rs-32', { client });
    await user.click(await screen.findByRole('button', { name: 'Check In All Rooms' }));
    await user.click(await screen.findByRole('button', { name: 'Check in for original date' }));
    const checkIn = await dialog('Check in');
    expect(
      within(checkIn).getByText(/The departure date has passed for Room 106\./),
    ).toBeInTheDocument();
    // Untick the room that qualifies: the notice goes away.
    await user.click(within(checkIn).getByRole('checkbox', { name: /Room 106/ }));
    expect(within(checkIn).queryByText(/departure date has passed/)).not.toBeInTheDocument();
    // The past-date note says how many nights are charged (room C8: 10/12 to 10/16 = 4 nights).
    expect(within(checkIn).getByText(/4 nights before today will be charged/)).toBeInTheDocument();
  });
});
