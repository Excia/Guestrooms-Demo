import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ApiProvider } from '../../api';
import { createMockClient } from '../../api/mock';
import { ApiError } from '../../api/types';
import type { ApiClient, ReservationDetail } from '../../api/types';
import { useReservationMenuActions } from './useReservationMenuActions';

const TODAY = '2026-10-16';

async function setup(client: ApiClient, detail?: ReservationDetail) {
  const shown = detail ?? (await client.reservations.getDetail('rs-5'));
  const onReloaded = vi.fn();
  const onChanged = vi.fn();
  const say = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider client={client}>{children}</ApiProvider>
  );
  const view = renderHook(
    () => useReservationMenuActions({ detail: shown, onReloaded, onChanged, say }),
    { wrapper },
  );
  return { shown, onReloaded, onChanged, say, view };
}

describe('useReservationMenuActions', () => {
  it('sends the version of the detail on screen, not a fresher one', async () => {
    const client = createMockClient({ today: TODAY });
    const shown = await client.reservations.getDetail('rs-5');
    // The reservation changes elsewhere after the panel loaded it.
    await client.reservations.setEarlyLate({
      requestId: 'req-elsewhere-1',
      reservationId: 'rs-5',
      version: shown.version,
      earlyCheckIn: true,
    });
    const cancel = vi.spyOn(client.reservations, 'cancelReservation');
    const { view, say, onReloaded } = await setup(client, shown);
    act(() => view.result.current.cancel());
    await waitFor(() => expect(say).toHaveBeenCalled());
    expect(cancel).toHaveBeenCalledWith(expect.objectContaining({ version: shown.version }));
    // The backend's stale check fired: the reservation is reloaded and nothing was cancelled.
    expect(say).toHaveBeenCalledWith(expect.stringContaining('changed elsewhere'));
    await waitFor(() => expect(onReloaded).toHaveBeenCalled());
    expect(onReloaded.mock.calls[0][0].status).not.toBe('cancelled');
    expect((await client.reservations.getDetail('rs-5')).status).not.toBe('cancelled');
  });

  it('cancels with the screen version, reports success and the change', async () => {
    const client = createMockClient({ today: TODAY });
    const { view, say, onReloaded, onChanged, shown } = await setup(client);
    act(() => view.result.current.cancel());
    await waitFor(() => expect(onReloaded).toHaveBeenCalled());
    expect(onReloaded.mock.calls[0][0]).toMatchObject({ status: 'cancelled' });
    expect(say).toHaveBeenCalledWith(`Reservation #${shown.confirmationNumber} cancelled.`);
    expect(onChanged).toHaveBeenCalled();
  });

  it('reuses the idempotency key when the user retries after an unknown outcome', async () => {
    const client = createMockClient({ today: TODAY });
    const cancel = vi
      .spyOn(client.reservations, 'cancelReservation')
      .mockRejectedValueOnce(new ApiError(503, 'down'));
    const { view, say } = await setup(client);
    act(() => view.result.current.cancel());
    await waitFor(() => expect(say).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.result.current.busy).toBe(false));
    act(() => view.result.current.cancel());
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(2));
    expect(cancel.mock.calls[1][0].requestId).toBe(cancel.mock.calls[0][0].requestId);
  });

  it('does not touch panel state after unmount', async () => {
    const client = createMockClient({ today: TODAY, latencyMs: 20 });
    const { view, say, onReloaded, onChanged } = await setup(client);
    act(() => view.result.current.cancel());
    view.unmount();
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(say).not.toHaveBeenCalled();
    expect(onReloaded).not.toHaveBeenCalled();
  });
});
