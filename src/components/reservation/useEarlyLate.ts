import { useEffect, useReducer, useRef } from 'react';
import { useApi } from '../../api';
import type { ReservationDetail } from '../../api';
import {
  earlyLateChanges,
  earlyLateFailure,
  earlyLateReducer,
  initialEarlyLate,
  UNCONFIRMED_MESSAGE,
  type EarlyLateValues,
} from '../../app/earlyLate';
import { newRequestId } from '../../lib/requestId';

export interface UseEarlyLateOptions {
  detail: ReservationDetail;
  /** A save was confirmed: mirror it elsewhere (the schedule's edge markers). */
  onSaved: (values: EarlyLateValues) => void;
  /** The reservation was reloaded after a failed save (it changed, or the outcome was unknown). */
  onReloaded: (detail: ReservationDetail) => void;
}

/**
 * Auto-save of Early Check In / Late Check Out. The reducer (src/app/earlyLate.ts) holds the
 * shown, confirmed and failed values; this hook sends the diff, one request at a time, with the
 * reservation's current version, and reloads the reservation when the outcome is unknown.
 * Saves are not aborted when the panel closes: an interrupted save would leave the outcome unknown.
 */
export function useEarlyLate({ detail, onSaved, onReloaded }: UseEarlyLateOptions) {
  const api = useApi();
  const [state, dispatch] = useReducer(
    earlyLateReducer,
    { earlyCheckIn: detail.earlyCheckIn, lateCheckOut: detail.lateCheckOut },
    initialEarlyLate,
  );
  const version = useRef(detail.version);
  const inflight = useRef(false);
  const callbacks = useRef({ onSaved, onReloaded });
  useEffect(() => {
    callbacks.current = { onSaved, onReloaded };
  });
  const id = detail.id;

  useEffect(() => {
    if (state.status !== 'saving' || inflight.current) return;
    const changes = earlyLateChanges(state.confirmed, state.shown);
    if (!changes) {
      dispatch({ type: 'saved', values: state.confirmed });
      return;
    }
    inflight.current = true;
    api.reservations
      .setEarlyLate({
        requestId: newRequestId(),
        reservationId: id,
        version: version.current,
        ...changes,
      })
      .then(
        (result) => {
          version.current = result.version;
          inflight.current = false;
          const values = { earlyCheckIn: result.earlyCheckIn, lateCheckOut: result.lateCheckOut };
          dispatch({ type: 'saved', values });
          callbacks.current.onSaved(values);
        },
        (error: unknown) => {
          const failure = earlyLateFailure(error);
          // `fail` is only used when the outcome is known or the reservation was reloaded.
          const fail = (values?: EarlyLateValues) => {
            inflight.current = false;
            dispatch({ type: 'failed', revert: failure.revert, message: failure.message, values });
          };
          if (!failure.refetch) return fail();
          api.reservations.getDetail(id).then(
            (fresh) => {
              version.current = fresh.version;
              const values = { earlyCheckIn: fresh.earlyCheckIn, lateCheckOut: fresh.lateCheckOut };
              fail(values);
              callbacks.current.onSaved(values);
              callbacks.current.onReloaded(fresh);
            },
            () => {
              // Unknown outcome and no way to check: keep what the user chose, do not claim a revert.
              inflight.current = false;
              dispatch({
                type: 'failed',
                revert: false,
                message: UNCONFIRMED_MESSAGE,
                unconfirmed: true,
              });
            },
          );
        },
      );
  }, [api, id, state.status, state.confirmed, state.shown]);

  /** After an unconfirmed save: fetch the reservation and show what the server has. */
  const reload = () => {
    api.reservations.getDetail(id).then(
      (fresh) => {
        version.current = fresh.version;
        const values = { earlyCheckIn: fresh.earlyCheckIn, lateCheckOut: fresh.lateCheckOut };
        dispatch({ type: 'reset', values });
        callbacks.current.onSaved(values);
        callbacks.current.onReloaded(fresh);
      },
      () => undefined, // still unconfirmed: the message stays and Reload can be tried again
    );
  };

  return {
    state,
    reload,
    toggle: (field: keyof EarlyLateValues) => dispatch({ type: 'toggle', field }),
    retry: () => dispatch({ type: 'retry' }),
  };
}
