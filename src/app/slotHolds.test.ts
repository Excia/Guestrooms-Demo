import { describe, expect, it } from 'vitest';
import type { ScheduleHold } from '../api/types';
import {
  canInteractWithHold,
  formatHoldTime,
  heldByOther,
  heldMessage,
  holdableSlot,
  holdAriaLabel,
  holdExpiry,
  holdTipText,
  isHoldLive,
  liveHolds,
  nextHoldExpiry,
  otherHolds,
  ownHolds,
  slotConflict,
} from './slotHolds';

const NOW = new Date(2026, 9, 24, 14, 0, 0).getTime();
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();
const hold = (over: Partial<ScheduleHold> = {}): ScheduleHold => ({
  id: 'h1',
  roomId: 'r1',
  startDate: '2026-10-26',
  endDate: '2026-10-28',
  expiresAt: at(10),
  mine: false,
  ...over,
});

describe('hold expiry', () => {
  it('adds the minutes to the start', () => {
    expect(holdExpiry(NOW, 15)).toBe(at(15));
  });
  it('is live until the instant of expiry, not at it', () => {
    expect(isHoldLive(hold({ expiresAt: at(1) }), NOW)).toBe(true);
    expect(isHoldLive(hold({ expiresAt: at(0) }), NOW)).toBe(false);
    expect(isHoldLive(hold({ expiresAt: at(-1) }), NOW)).toBe(false);
  });
  it('treats an unreadable instant as ended', () => {
    expect(isHoldLive(hold({ expiresAt: 'soon' }), NOW)).toBe(false);
  });
  it('keeps only live holds and tolerates none', () => {
    expect(
      liveHolds([hold(), hold({ id: 'h2', expiresAt: at(-5) })], NOW).map((h) => h.id),
    ).toEqual(['h1']);
    expect(liveHolds(undefined, NOW)).toEqual([]);
  });
  it('finds the time to the next expiry', () => {
    expect(
      nextHoldExpiry([hold({ expiresAt: at(9) }), hold({ id: 'h2', expiresAt: at(3) })], NOW),
    ).toBe(3 * 60_000);
    expect(nextHoldExpiry([hold({ expiresAt: at(-3) })], NOW)).toBeNull();
    expect(nextHoldExpiry(undefined, NOW)).toBeNull();
  });
});

describe('who owns a hold', () => {
  const holds = [hold({ id: 'a', mine: true }), hold({ id: 'b' })];
  it("lists the viewer's holds", () => {
    expect(ownHolds(holds).map((h) => h.id)).toEqual(['a']);
    expect(ownHolds(undefined)).toEqual([]);
  });
  it("leaves out the open panel's own hold", () => {
    expect(otherHolds(holds, 'a').map((h) => h.id)).toEqual(['b']);
    expect(otherHolds(holds, null)).toHaveLength(2);
  });
  it('lets only the panel that placed a hold interact with it', () => {
    expect(canInteractWithHold({ id: 'a' }, 'a')).toBe(true);
    expect(canInteractWithHold({ id: 'b' }, 'a')).toBe(false);
    expect(canInteractWithHold({ id: 'a' }, null)).toBe(false);
  });
});

describe('overlap with holds and bookings', () => {
  const slot = (startDate: string, endDate: string, roomId = 'r1') => ({
    roomId,
    startDate,
    endDate,
  });
  it('a hold in the same room on shared nights clashes', () => {
    expect(heldByOther(slot('2026-10-27', '2026-10-29'), [hold()], null, NOW)?.id).toBe('h1');
  });
  it('a same-day turnover does not clash (the end night is free)', () => {
    expect(heldByOther(slot('2026-10-28', '2026-10-30'), [hold()], null, NOW)).toBeUndefined();
    expect(heldByOther(slot('2026-10-24', '2026-10-26'), [hold()], null, NOW)).toBeUndefined();
  });
  it("the caller's own holds (mine) never clash, whatever their id", () => {
    expect(
      heldByOther(
        slot('2026-10-26', '2026-10-28'),
        [hold({ mine: true, id: 'orphan' })],
        'h9',
        NOW,
      ),
    ).toBeUndefined();
  });
  it("another room, an expired hold and the holder's own hold do not clash", () => {
    expect(
      heldByOther(slot('2026-10-26', '2026-10-28', 'r2'), [hold()], null, NOW),
    ).toBeUndefined();
    expect(
      heldByOther(slot('2026-10-26', '2026-10-28'), [hold({ expiresAt: at(-1) })], null, NOW),
    ).toBeUndefined();
    expect(heldByOther(slot('2026-10-26', '2026-10-28'), [hold()], 'h1', NOW)).toBeUndefined();
  });
  it('reports booked before closed before held', () => {
    const state = {
      blocks: [slot('2026-10-26', '2026-10-27')],
      closures: [slot('2026-10-27', '2026-10-28')],
      holds: [hold()],
    };
    expect(slotConflict(slot('2026-10-26', '2026-10-28'), state, null, NOW)).toEqual({
      kind: 'booked',
    });
    expect(slotConflict(slot('2026-10-27', '2026-10-28'), state, null, NOW)).toEqual({
      kind: 'closed',
    });
    const heldOnly = { blocks: [], closures: [], holds: [hold()] };
    expect(slotConflict(slot('2026-10-27', '2026-10-28'), heldOnly, null, NOW)).toMatchObject({
      kind: 'held',
    });
    expect(slotConflict(slot('2026-11-01', '2026-11-02'), state, null, NOW)).toBeNull();
  });
  it('only a room with at least one night can be held', () => {
    expect(holdableSlot(slot('2026-10-26', '2026-10-27'))).toBe(true);
    expect(holdableSlot(slot('2026-10-26', '2026-10-26'))).toBe(false);
    expect(holdableSlot(slot('2026-10-26', '2026-10-27', ''))).toBe(false);
    expect(holdableSlot(slot('', '2026-10-27'))).toBe(false);
  });
});

describe('hold text', () => {
  it('formats the time as HH:mm with a leading zero', () => {
    expect(formatHoldTime(new Date(2026, 9, 24, 9, 5).toISOString())).toBe('09:05');
    expect(formatHoldTime('nope')).toBe('');
  });
  it('words the tooltip and the accessible name', () => {
    const h = hold({ expiresAt: new Date(2026, 9, 24, 14, 30).toISOString() });
    expect(holdTipText(h)).toBe('Held until 14:30');
    const dates = { from: 'Oct 26', to: 'Oct 28' };
    expect(holdAriaLabel(h, '101', dates, false)).toBe(
      'Held until 14:30, Room 101, Oct 26 to Oct 28',
    );
    expect(holdAriaLabel(h, '101', dates, true)).toBe(
      'Your hold, held until 14:30, Room 101, Oct 26 to Oct 28',
    );
    expect(holdAriaLabel(h, undefined, dates, false)).toBe('Held until 14:30, Oct 26 to Oct 28');
    expect(heldMessage(h)).toBe('That room is held by another user until 14:30.');
  });
});

describe('hold time on the club clock', () => {
  it('reads the instant in the club time zone, not the browser', () => {
    const at = '2026-10-24T18:30:00.000Z';
    expect(formatHoldTime(at, 'America/New_York')).toBe('14:30');
    expect(formatHoldTime(at, 'Asia/Tokyo')).toBe('03:30');
    expect(holdTipText({ expiresAt: at }, 'America/New_York')).toBe('Held until 14:30');
    expect(heldMessage({ expiresAt: at }, 'America/New_York')).toBe(
      'That room is held by another user until 14:30.',
    );
    expect(
      holdAriaLabel({ expiresAt: at }, '101', { from: 'a', to: 'b' }, false, 'America/New_York'),
    ).toBe('Held until 14:30, Room 101, a to b');
  });
});
