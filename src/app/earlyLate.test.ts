import { ApiError } from '../api/types';
import {
  earlyLateChanges,
  earlyLateFailure,
  earlyLateReducer,
  initialEarlyLate,
  type EarlyLateEvent,
} from './earlyLate';

const OFF = { earlyCheckIn: false, lateCheckOut: false };
const run = (events: EarlyLateEvent[], start = initialEarlyLate(OFF)) =>
  events.reduce(earlyLateReducer, start);

describe('early/late auto-save state machine', () => {
  it('shows a ticked box at once as saving, then saved with the server values', () => {
    const saving = run([{ type: 'toggle', field: 'earlyCheckIn' }]);
    expect(saving).toMatchObject({ status: 'saving', shown: { earlyCheckIn: true } });
    expect(saving.confirmed.earlyCheckIn).toBe(false);
    const saved = earlyLateReducer(saving, {
      type: 'saved',
      values: { earlyCheckIn: true, lateCheckOut: false },
    });
    expect(saved).toMatchObject({ status: 'saved', confirmed: { earlyCheckIn: true } });
  });

  it('stays saving when the user ticked again during the save, then saves the follow-up', () => {
    const state = run([
      { type: 'toggle', field: 'earlyCheckIn' },
      { type: 'toggle', field: 'lateCheckOut' },
      { type: 'saved', values: { earlyCheckIn: true, lateCheckOut: false } },
    ]);
    expect(state.status).toBe('saving');
    expect(state.shown).toEqual({ earlyCheckIn: true, lateCheckOut: true });
    expect(earlyLateChanges(state.confirmed, state.shown)).toEqual({ lateCheckOut: true });
  });

  it('reverts on failure, keeps the message and retries the failed change', () => {
    const failed = run([
      { type: 'toggle', field: 'lateCheckOut' },
      { type: 'failed', revert: true, message: 'The change could not be saved.' },
    ]);
    expect(failed).toMatchObject({
      status: 'error',
      shown: OFF,
      message: 'The change could not be saved.',
    });
    const retry = earlyLateReducer(failed, { type: 'retry' });
    expect(retry).toMatchObject({ status: 'saving', shown: { lateCheckOut: true }, message: null });
  });

  it('a failure with fresh server values adopts them', () => {
    const fresh = { earlyCheckIn: true, lateCheckOut: true };
    const state = run([
      { type: 'toggle', field: 'lateCheckOut' },
      { type: 'failed', revert: true, message: 'x', values: fresh },
    ]);
    expect(state.shown).toEqual(fresh);
    expect(state.confirmed).toEqual(fresh);
  });

  it('retry applies the failed change on top of the reloaded server values', () => {
    const fresh = { earlyCheckIn: false, lateCheckOut: true }; // changed elsewhere meanwhile
    const state = run([
      { type: 'toggle', field: 'earlyCheckIn' },
      { type: 'failed', revert: true, message: 'x', values: fresh },
      { type: 'retry' },
    ]);
    expect(state.shown).toEqual({ earlyCheckIn: true, lateCheckOut: true });
    expect(earlyLateChanges(state.confirmed, state.shown)).toEqual({ earlyCheckIn: true });
  });

  it('retry does nothing unless there is a failure', () => {
    const idle = initialEarlyLate(OFF);
    expect(earlyLateReducer(idle, { type: 'retry' })).toBe(idle);
  });

  it('a new tick clears the error', () => {
    const failed = run([
      { type: 'toggle', field: 'earlyCheckIn' },
      { type: 'failed', revert: true, message: 'x' },
      { type: 'toggle', field: 'earlyCheckIn' },
    ]);
    expect(failed).toMatchObject({ status: 'saving', message: null });
  });

  it('sends only what changed', () => {
    expect(earlyLateChanges(OFF, OFF)).toBeNull();
    expect(earlyLateChanges(OFF, { earlyCheckIn: true, lateCheckOut: true })).toEqual({
      earlyCheckIn: true,
      lateCheckOut: true,
    });
  });

  it('classifies failures like the schedule moves', () => {
    expect(earlyLateFailure(new ApiError(400, 'x'))).toMatchObject({
      revert: true,
      refetch: false,
    });
    expect(earlyLateFailure(new ApiError(409, 'x', { code: 'stale' }))).toMatchObject({
      revert: true,
      refetch: true,
    });
    expect(earlyLateFailure(new ApiError(409, 'x', { code: 'not-editable' })).refetch).toBe(true);
    for (const e of [
      new ApiError(0, 'x', { code: 'network' }),
      new ApiError(500, 'x'),
      new ApiError(408, 'x'),
    ]) {
      expect(earlyLateFailure(e)).toMatchObject({ revert: true, refetch: true });
    }
    expect(earlyLateFailure(new Error('boom')).refetch).toBe(true);
  });
});
