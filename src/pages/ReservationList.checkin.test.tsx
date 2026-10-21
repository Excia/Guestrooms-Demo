import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter } from 'react-router';
import { ApiError, ApiProvider } from '../api';
import type { ApiClient, CheckInRoomRequest } from '../api';
import { createMockClient } from '../api/mock';
import { hasPaymentOnFile } from '../api/reservationListData';
import { theme } from '../theme';
import ReservationList from './ReservationList';

const TODAY = '2026-10-16';

// Reservations of the mock used here: GR-50402 one unassigned room, GR-50403 two rooms (the first
// unassigned). `outcome` decides each check-in so the test does not depend on the mock's payment data.
function setup(outcome: (id: string) => 'ok' | 'unassigned' | 'no-payment-method') {
  const base = createMockClient({ today: TODAY });
  const checkInRoom = vi.fn(async (r: CheckInRoomRequest) => {
    const result = outcome(r.reservationRoomId);
    if (result === 'ok')
      return { reservationRoomId: r.reservationRoomId, status: 'checked-in' as const };
    throw new ApiError(409, result, { code: result });
  });
  const client: ApiClient = { ...base, reservationList: { ...base.reservationList, checkInRoom } };
  render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <MemoryRouter initialEntries={['/reservations']}>
          <ReservationList today={TODAY} />
        </MemoryRouter>
      </ApiProvider>
    </ThemeProvider>,
  );
  return { checkInRoom };
}

const rowFor = async (conf: string) => {
  const t = await screen.findByRole('table', { name: 'Reservations' });
  const row = await waitFor(() => {
    const found = within(t)
      .getAllByRole('row')
      .find((r) => within(r).queryByText(conf));
    if (!found) throw new Error('row not loaded');
    return found;
  });
  return row;
};
const select = async (conf: string) => {
  const row = await rowFor(conf);
  await userEvent.click(within(row).getByRole('checkbox'));
};

describe('bulk check-in', () => {
  it('shows no button with nothing selected and counts rooms, not reservations', async () => {
    setup(() => 'ok');
    await rowFor('GR-50402');
    expect(screen.queryByRole('button', { name: /check in \d/i })).toBeNull();
    await select('GR-50402');
    expect(screen.getByRole('button', { name: 'CHECK IN 1 ROOM' })).toBeInTheDocument();
    await select('GR-50403');
    expect(screen.getByRole('button', { name: 'CHECK IN 3 ROOMS' })).toBeInTheDocument();
  });

  it('checks in each room on its own and lists successes and failures with reasons', async () => {
    const { checkInRoom } = setup((id) =>
      id === 'rs-X2-1' ? 'no-payment-method' : id === 'rs-X3-1' ? 'unassigned' : 'ok',
    );
    await select('GR-50402');
    await select('GR-50403');
    await userEvent.click(screen.getByRole('button', { name: 'CHECK IN 3 ROOMS' }));
    expect(checkInRoom).toHaveBeenCalledTimes(3);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(
      '1 Room Successfully Checked In.',
    );
    expect(within(dialog).getByText('2 rooms could not be checked in:')).toBeInTheDocument();
    expect(within(dialog).getByText('No payment method on file.')).toBeInTheDocument();
    expect(within(dialog).getByText('No room assigned.')).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      '1 room checked in. 2 rooms could not be checked in.',
    );

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // The failed reservations are flagged and still selected; the CTA counts what is left.
    expect(
      within(await rowFor('GR-50402')).getByText(/could not be checked in/i),
    ).toBeInTheDocument();
  });

  it('locks a reservation whose rooms all checked in and drops it from the count', async () => {
    const mock = createMockClient({ today: TODAY });
    const page = await mock.reservationList.list({ checkInFrom: TODAY, checkInTo: '2026-10-23' });
    const good = page.items.find(
      (r) =>
        r.rooms.length === 1 &&
        r.rooms[0].status === 'not-checked-in' &&
        r.rooms[0].roomNumber !== null &&
        hasPaymentOnFile(r.id),
    );
    expect(good).toBeDefined();
    // Same client for the page: its in-memory schedule is what the check-in changes.
    const client = mock;
    render(
      <ThemeProvider theme={theme}>
        <ApiProvider client={client}>
          <MemoryRouter initialEntries={['/reservations']}>
            <ReservationList today={TODAY} />
          </MemoryRouter>
        </ApiProvider>
      </ThemeProvider>,
    );
    await select(good!.confirmationNumber);
    await select('GR-50402');
    await userEvent.click(screen.getByRole('button', { name: 'CHECK IN 2 ROOMS' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('No room assigned.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'CHECK IN 1 ROOM' })).toBeInTheDocument(),
    );
    const done = await rowFor(good!.confirmationNumber);
    await waitFor(() => expect(within(done).queryByRole('checkbox')).toBeNull());
    expect(done).toHaveTextContent('Checked In');
  });
});
