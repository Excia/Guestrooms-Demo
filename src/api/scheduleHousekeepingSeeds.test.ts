import { describe, expect, it } from 'vitest';
import { housekeepingStatusOf, needsHousekeepingBlock } from '../app/housekeepingBlocks';
import { blockFillToken } from '../app/scheduleColors';
import { createScheduleState } from './scheduleData';

// The mock must let the owner see every block state and every housekeeping state.
describe.each(['default', 'large'] as const)('schedule mock seeds (%s)', (size) => {
  const state = createScheduleState('2026-10-24', size);

  // The large state is generated; only the hand-written default one covers every fill state.
  it.runIf(size === 'default')('has a block in every fill state', () => {
    const tokens = new Set(state.blocks.map((b) => blockFillToken(b, state.today)));
    for (const t of ['nyci', 'checkedIn', 'checkedOut', 'dueOut', 'linked'])
      expect(tokens, t).toContain(t);
  });

  it('shows every housekeeping state', () => {
    const states = new Set(state.blocks.map((b) => housekeepingStatusOf(b)));
    for (const s of [
      'not-checked-out',
      'needs-cleaning',
      'cleaned',
      'ready',
      'needs-maintenance',
      'nyci',
    ])
      expect(states, s).toContain(s);
    expect(state.blocks.some((b) => b.housekeepingNotes)).toBe(true);
  });

  it('every assigned stay has a status, linked and unassigned ones none', () => {
    for (const b of state.blocks) {
      expect(housekeepingStatusOf(b) !== undefined).toBe(needsHousekeepingBlock(b));
    }
    for (const b of state.unassigned) expect(housekeepingStatusOf(b)).toBeUndefined();
  });
});
