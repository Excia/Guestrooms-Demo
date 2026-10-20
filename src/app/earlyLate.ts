// Early Check In / Late Check Out auto-save (no Save button). A small state machine: ticking a box
// shows the new value at once ("Saving..."), the server's answer makes it "Saved", a failure
// reverts it and offers Retry. Ticks made while a save is running are folded into one follow-up
// save. The reducer is pure; the hook performs the request.
import type { EarlyLateRequest } from '../api/types';
import { ApiError } from '../api/types';

export interface EarlyLateValues {
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EarlyLateState {
  /** What the server last confirmed. */
  confirmed: EarlyLateValues;
  /** What the checkboxes show (the confirmed values plus ticks not yet saved). */
  shown: EarlyLateValues;
  status: SaveStatus;
  /** What the failed save wanted, for Retry. */
  failed: EarlyLateValues | null;
  message: string | null;
}

export type EarlyLateEvent =
  | { type: 'toggle'; field: keyof EarlyLateValues }
  | { type: 'saved'; values: EarlyLateValues }
  | { type: 'failed'; revert: boolean; message: string; values?: EarlyLateValues }
  | { type: 'retry' }
  | { type: 'reset'; values: EarlyLateValues };

export const initialEarlyLate = (values: EarlyLateValues): EarlyLateState => ({
  confirmed: values,
  shown: values,
  status: 'idle',
  failed: null,
  message: null,
});

const same = (a: EarlyLateValues, b: EarlyLateValues) =>
  a.earlyCheckIn === b.earlyCheckIn && a.lateCheckOut === b.lateCheckOut;

export function earlyLateReducer(state: EarlyLateState, event: EarlyLateEvent): EarlyLateState {
  switch (event.type) {
    case 'toggle': {
      const shown = { ...state.shown, [event.field]: !state.shown[event.field] };
      return { ...state, shown, status: 'saving', failed: null, message: null };
    }
    case 'saved': {
      // Ticks made while saving keep the state "saving"; the hook sends the follow-up.
      const pending = !same(state.shown, event.values) && state.status === 'saving';
      return {
        ...state,
        confirmed: event.values,
        shown: pending ? state.shown : event.values,
        status: pending ? 'saving' : 'saved',
        failed: null,
        message: null,
      };
    }
    case 'failed':
      return {
        ...state,
        confirmed: event.values ?? state.confirmed,
        shown: event.revert ? (event.values ?? state.confirmed) : state.shown,
        status: 'error',
        failed: state.shown,
        message: event.message,
      };
    case 'retry':
      return state.status === 'error' && state.failed
        ? { ...state, shown: state.failed, status: 'saving', failed: null, message: null }
        : state;
    case 'reset':
      return initialEarlyLate(event.values);
  }
}

/** Only the flags that differ from what the server has, as the request needs them. */
export function earlyLateChanges(
  confirmed: EarlyLateValues,
  shown: EarlyLateValues,
): Pick<EarlyLateRequest, 'earlyCheckIn' | 'lateCheckOut'> | null {
  const changes: Pick<EarlyLateRequest, 'earlyCheckIn' | 'lateCheckOut'> = {};
  if (confirmed.earlyCheckIn !== shown.earlyCheckIn) changes.earlyCheckIn = shown.earlyCheckIn;
  if (confirmed.lateCheckOut !== shown.lateCheckOut) changes.lateCheckOut = shown.lateCheckOut;
  return Object.keys(changes).length > 0 ? changes : null;
}

export interface EarlyLateFailure {
  /** Show the last confirmed values again (the change certainly did not apply). */
  revert: boolean;
  /** Reload the reservation: the change may have applied, or it changed under us. */
  refetch: boolean;
  message: string;
}

/**
 * Like the schedule moves: a clear 4xx (other than 408) applied nothing, so revert. Status 0, 408,
 * 5xx and an unusable answer are unknown outcomes: reload instead of guessing. 409 `stale` means
 * the reservation changed elsewhere: reload it.
 */
export function earlyLateFailure(error: unknown): EarlyLateFailure {
  const status = error instanceof ApiError ? error.status : 0;
  const code = error instanceof ApiError ? error.code : undefined;
  if (code === 'stale') {
    return {
      revert: true,
      refetch: true,
      message: 'This reservation changed elsewhere. It was reloaded; try again.',
    };
  }
  if (code === 'not-editable') {
    return { revert: true, refetch: true, message: 'This reservation can no longer be changed.' };
  }
  if (status >= 400 && status < 500 && status !== 408) {
    return { revert: true, refetch: false, message: 'The change could not be saved.' };
  }
  return {
    revert: true,
    refetch: true,
    message: 'The change could not be confirmed. The reservation was reloaded.',
  };
}
