import { useEffect, useRef, useState } from 'react';
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
 * Cancel Reservation and Undo Check In (ticket 2.5). One request at a time. The request carries
 * the version of the reservation on screen, so the backend's 409 `stale` check can fire when it
 * changed elsewhere. Each user action has its own idempotency key; it is reused when the user tries
 * the same action again after an unknown outcome (no answer, 408, 5xx). A failure explains itself
 * and reloads the reservation when its state may have changed.
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
  // False once the panel is gone: late answers must not touch its state.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // The key of an attempt whose outcome is unknown, with what it was for.
  const attempt = useRef<{ what: string; id: string } | null>(null);
  const id = detail.id;
  const version = detail.version;

  const run = (
    kind: MenuMutation,
    what: string,
    send: (requestId: string) => Promise<ReservationDetail>,
  ) => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    const key = `${what}|${version}`;
    const requestId = attempt.current?.what === key ? attempt.current.id : newRequestId();
    attempt.current = null;
    const settle = () => {
      inflight.current = false;
      if (mounted.current) setBusy(false);
    };
    send(requestId).then(
      (next) => {
        if (mounted.current) {
          onReloaded(next);
          say(menuSuccessMessage(kind, detail.confirmationNumber));
        }
        onChanged?.();
        settle();
      },
      (error: unknown) => {
        const failure = menuFailure(kind, error);
        if (failure.outcomeUnknown) attempt.current = { what: key, id: requestId };
        if (mounted.current) say(failure.message);
        if (!failure.refetch) return settle();
        api.reservations.getDetail(id).then((fresh) => {
          if (mounted.current) onReloaded(fresh);
          onChanged?.();
          settle();
        }, settle);
      },
    );
  };

  return {
    busy,
    cancel: () =>
      run('cancel', 'cancel', (requestId) =>
        api.reservations.cancelReservation({ requestId, reservationId: id, version }),
      ),
    undoCheckIn: (reservationRoomId?: string) =>
      run('undo-check-in', `undo:${reservationRoomId ?? 'all'}`, (requestId) =>
        api.reservations.undoCheckIn({
          requestId,
          reservationId: id,
          version,
          ...(reservationRoomId ? { reservationRoomId } : {}),
        }),
      ),
  };
}
