import { useRef, useState } from 'react';
import { useApi } from '../../api';
import type { ReservationDetail } from '../../api';
import { menuFailure, menuSuccessMessage, type MenuMutation } from '../../app/reservationActions';
import { newRequestId } from '../../lib/requestId';

export interface UseReservationMenuActionsOptions {
  detail: ReservationDetail;
  /** The reservation as it is now (after a change, or a reload after a failure). */
  onReloaded: (detail: ReservationDetail) => void;
  /** A change was applied: the schedule behind the panel reloads. */
  onChanged?: () => void;
  say: (text: string) => void;
}

/**
 * Cancel Reservation and Undo Check In (ticket 2.5). One request at a time, each with its own
 * idempotency key and the reservation's current version; a failure explains itself and reloads the
 * reservation when its state may have changed.
 */
export function useReservationMenuActions({
  detail,
  onReloaded,
  onChanged,
  say,
}: UseReservationMenuActionsOptions) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  const id = detail.id;

  // The version is read just before sending: the Early/Late saves change it without reloading the
  // detail, so the copy on screen may be one revision behind.
  const run = (kind: MenuMutation, send: (version: string) => Promise<ReservationDetail>) => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    const settle = () => {
      inflight.current = false;
      setBusy(false);
    };
    api.reservations
      .getDetail(id)
      .then((fresh) => send(fresh.version))
      .then(
        (next) => {
          onReloaded(next);
          onChanged?.();
          say(menuSuccessMessage(kind, detail.confirmationNumber));
          settle();
        },
        (error: unknown) => {
          const failure = menuFailure(kind, error);
          say(failure.message);
          if (!failure.refetch) return settle();
          api.reservations.getDetail(id).then((fresh) => {
            onReloaded(fresh);
            onChanged?.();
            settle();
          }, settle);
        },
      );
  };

  return {
    busy,
    cancel: () =>
      run('cancel', (version) =>
        api.reservations.cancelReservation({
          requestId: newRequestId(),
          reservationId: id,
          version,
        }),
      ),
    undoCheckIn: (reservationRoomId?: string) =>
      run('undo-check-in', (version) =>
        api.reservations.undoCheckIn({
          requestId: newRequestId(),
          reservationId: id,
          version,
          ...(reservationRoomId ? { reservationRoomId } : {}),
        }),
      ),
  };
}
