import { describe, expect, it } from 'vitest';
import {
  SETTABLE_HOUSEKEEPING_STATUSES,
  type HousekeepingStatus,
  type ScheduleBlock,
  type ScheduleBlockStatus,
} from '../api/types';
import {
  HOUSEKEEPING_LABELS,
  HOUSEKEEPING_OPTIONS,
  housekeepingStatusLabel,
  housekeepingStatusOf,
  needsHousekeepingBlock,
} from './housekeepingBlocks';

const block = (over: Partial<ScheduleBlock> = {}): ScheduleBlock => ({
  kind: 'reservation',
  id: 'rr-1',
  reservationId: 'rs-1',
  confirmationNumber: 'GR-1',
  guestName: 'A B',
  guestType: 'guest',
  roomId: 'rm-101',
  startDate: '2026-10-24',
  endDate: '2026-10-26',
  status: 'confirmed',
  roomCount: 1,
  roomTypeLocked: false,
  version: 'v1',
  ...over,
});

describe('needsHousekeepingBlock', () => {
  it.each<ScheduleBlockStatus>(['confirmed', 'nyci', 'checked-in', 'checked-out'])(
    'every assigned stay gets one (%s)',
    (status) => {
      expect(needsHousekeepingBlock(block({ status }))).toBe(true);
    },
  );
  it('an unassigned reservation gets none', () => {
    expect(needsHousekeepingBlock(block({ roomId: '' }))).toBe(false);
  });
  it('a linked-room block gets none', () => {
    const linkedTo = { roomNumber: '102', reserverName: 'B Q' };
    expect(needsHousekeepingBlock(block({ linkedTo }))).toBe(false);
  });
});

describe('housekeepingStatusOf', () => {
  it('uses the stored status', () => {
    expect(housekeepingStatusOf(block({ housekeeping: 'ready' }))).toBe('ready');
    expect(housekeepingStatusOf(block({ housekeeping: 'nyci' }))).toBe('nyci');
  });
  it('defaults to not checked out when none is stored', () => {
    expect(housekeepingStatusOf(block())).toBe('not-checked-out');
    expect(housekeepingStatusOf(block({ status: 'checked-out' }))).toBe('not-checked-out');
  });
  it('is undefined where there is no block', () => {
    expect(housekeepingStatusOf(block({ roomId: '', housekeeping: 'ready' }))).toBeUndefined();
  });
});

describe('labels and options', () => {
  it('has a label for every status, title cased for display', () => {
    expect(housekeepingStatusLabel('not-checked-out')).toBe('Not Checked Out');
    expect(housekeepingStatusLabel('needs-maintenance')).toBe('Needs Maintenance');
    for (const s of Object.keys(HOUSEKEEPING_LABELS) as HousekeepingStatus[]) {
      expect(housekeepingStatusLabel(s)).not.toBe('');
    }
  });
  it('offers the settable statuses in order, not NYCI', () => {
    expect(HOUSEKEEPING_OPTIONS.map((o) => o.value)).toEqual(SETTABLE_HOUSEKEEPING_STATUSES);
    expect(HOUSEKEEPING_OPTIONS.map((o) => o.label)).toEqual([
      'Not Checked Out',
      'Needs Cleaning',
      'Cleaned',
      'Ready',
      'Needs Maintenance',
    ]);
  });
});
