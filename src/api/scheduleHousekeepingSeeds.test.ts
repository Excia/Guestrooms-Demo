import { describe, expect, it } from 'vitest';
import {
  housekeepingStatusOf,
  needsHousekeepingBlock,
  stayLifecycle,
} from '../app/housekeepingBlocks';
import { blockLayout } from '../app/schedule';
import { blockFillToken } from '../app/scheduleColors';
import { createScheduleState } from './scheduleData';

// The mock must let the owner see every block state and every housekeeping state.
describe.each(['default', 'large'] as const)('schedule mock seeds (%s)', (size) => {
  const state = createScheduleState('2026-10-24', size);

  it('every assigned stay has a status, linked and unassigned ones none', () => {
    for (const b of state.blocks) {
      expect(housekeepingStatusOf(b) !== undefined).toBe(needsHousekeepingBlock(b));
    }
    for (const b of state.unassigned) expect(housekeepingStatusOf(b)).toBeUndefined();
  });

  // D-HK-4: the stored state follows the stay's check-in status; a stay not yet checked in stores
  // none, bar the one maintenance flag staff set on the room.
  it('every seeded stay stores a housekeeping state that fits its check-in status', () => {
    for (const b of state.blocks) {
      if (!needsHousekeepingBlock(b)) continue;
      const lifecycle = stayLifecycle(b.status);
      const shown = housekeepingStatusOf(b);
      if (lifecycle === 'not-checked-in') {
        expect([undefined, 'needs-maintenance'], b.id).toContain(b.housekeeping);
        expect(shown, b.id).toBe(b.housekeeping ?? 'nyci');
      } else if (lifecycle === 'in-house') {
        expect(b.housekeeping, b.id).toBe('not-checked-out');
      } else {
        expect(['needs-cleaning', 'cleaned', 'ready', 'needs-maintenance'], b.id).toContain(
          b.housekeeping,
        );
      }
    }
  });

  it('has a note on some chip', () => {
    expect(state.blocks.some((b) => b.housekeepingNotes)).toBe(true);
  });
});

// The default view starts today and shows 7 days: everything must be on screen without paging.
describe('schedule mock seeds in the default 7-day view', () => {
  const state = createScheduleState('2026-10-24');
  const inView = state.blocks.filter((b) => blockLayout(b, state.today, 7) !== null);

  it('shows a block in every fill state', () => {
    const tokens = new Set(inView.map((b) => blockFillToken(b, state.today)));
    for (const t of ['nyci', 'checkedIn', 'checkedOut', 'linked']) {
      expect(tokens, t).toContain(t);
    }
    expect(inView.some((b) => b.status === 'confirmed')).toBe(true);
    expect(inView.some((b) => b.status === 'nyci')).toBe(true);
  });

  // A due-out stay leaves today, so its last night is yesterday: it is on screen only when the view
  // starts a day earlier (the default view starts today, so a stay that ends today is out of it).
  it('shows a due-out block when the view starts yesterday', () => {
    const yesterday = '2026-10-23';
    expect(
      state.blocks.some(
        (b) => blockFillToken(b, state.today) === 'dueOut' && blockLayout(b, yesterday, 7) !== null,
      ),
    ).toBe(true);
  });

  // A stay that leaves today is out of a view that starts today, so the states are looked for in
  // the default view and in the one that starts a day earlier.
  it('shows every housekeeping state, each chip at a real departure edge', () => {
    const drawn = new Set<string | undefined>();
    for (const start of [state.today, '2026-10-23']) {
      for (const b of state.blocks) {
        const layout = blockLayout(b, start, 7);
        if (layout && !layout.continuesAfter) drawn.add(housekeepingStatusOf(b));
      }
    }
    for (const s of [
      'not-checked-out',
      'needs-cleaning',
      'cleaned',
      'ready',
      'needs-maintenance',
    ]) {
      expect(drawn, s).toContain(s);
    }
    // NYCI is drawn invisible: its stay is on screen, its chip is not.
    expect(inView.some((b) => housekeepingStatusOf(b) === 'nyci')).toBe(true);
  });

  it('shows a cleaning state only on checked-out stays', () => {
    for (const b of inView) {
      const s = housekeepingStatusOf(b);
      if (s === 'needs-cleaning' || s === 'cleaned' || s === 'ready') {
        expect(b.status, b.id).toBe('checked-out');
      }
    }
  });

  it('has a checked-out stay with its chip', () => {
    const out = inView.filter((b) => b.status === 'checked-out');
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((b) => !blockLayout(b, state.today, 7)!.continuesAfter)).toBe(true);
  });
});
