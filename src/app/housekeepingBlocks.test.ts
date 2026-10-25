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
  housekeepingOnCheckIn,
  housekeepingOnCheckOut,
  housekeepingOptionsFor,
  housekeepingStatusLabel,
  housekeepingStatusOf,
  needsHousekeepingBlock,
  stayLifecycle,
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

const STORED: (HousekeepingStatus | undefined)[] = [
  undefined,
  'nyci',
  'not-checked-out',
  'needs-cleaning',
  'cleaned',
  'ready',
  'needs-maintenance',
];

// The derivation table (D-HK-4): lifecycle x stored status -> shown status.
describe('housekeepingStatusOf', () => {
  const table: Record<ScheduleBlockStatus, Record<string, HousekeepingStatus>> = {
    confirmed: {
      none: 'nyci',
      nyci: 'nyci',
      'not-checked-out': 'nyci',
      'needs-cleaning': 'nyci',
      cleaned: 'nyci',
      ready: 'nyci',
      'needs-maintenance': 'needs-maintenance',
    },
    nyci: {
      none: 'nyci',
      nyci: 'nyci',
      'not-checked-out': 'nyci',
      'needs-cleaning': 'nyci',
      cleaned: 'nyci',
      ready: 'nyci',
      'needs-maintenance': 'needs-maintenance',
    },
    'checked-in': {
      none: 'not-checked-out',
      nyci: 'not-checked-out',
      'not-checked-out': 'not-checked-out',
      'needs-cleaning': 'not-checked-out',
      cleaned: 'not-checked-out',
      ready: 'not-checked-out',
      'needs-maintenance': 'not-checked-out',
    },
    'checked-out': {
      none: 'needs-cleaning',
      nyci: 'needs-cleaning',
      'not-checked-out': 'needs-cleaning',
      'needs-cleaning': 'needs-cleaning',
      cleaned: 'cleaned',
      ready: 'ready',
      'needs-maintenance': 'needs-maintenance',
    },
  };
  for (const [status, row] of Object.entries(table)) {
    it.each(STORED)(`${status} with stored %s`, (stored) => {
      const b = block({ status: status as ScheduleBlockStatus, housekeeping: stored });
      expect(housekeepingStatusOf(b)).toBe(row[stored ?? 'none']);
    });
  }
  it('is undefined where there is no block', () => {
    expect(
      housekeepingStatusOf(block({ roomId: '', status: 'checked-out', housekeeping: 'ready' })),
    ).toBeUndefined();
  });
});

describe('stayLifecycle', () => {
  it('groups the block statuses', () => {
    expect(stayLifecycle('confirmed')).toBe('not-checked-in');
    expect(stayLifecycle('nyci')).toBe('not-checked-in');
    expect(stayLifecycle('checked-in')).toBe('in-house');
    expect(stayLifecycle('checked-out')).toBe('checked-out');
  });
});

describe('housekeepingOptionsFor', () => {
  const values = (b: ScheduleBlock) => housekeepingOptionsFor(b).map((o) => o.value);
  it('offers nothing for a stay not yet checked in, its chip is invisible', () => {
    expect(values(block({ status: 'confirmed' }))).toEqual([]);
    expect(values(block({ status: 'nyci', housekeeping: 'cleaned' }))).toEqual([]);
  });
  it('keeps only the maintenance flag staff already set on a stay not yet checked in', () => {
    expect(values(block({ status: 'confirmed', housekeeping: 'needs-maintenance' }))).toEqual([
      'needs-maintenance',
    ]);
  });
  it('keeps a guest in house at Not Checked Out', () => {
    expect(values(block({ status: 'checked-in', housekeeping: 'cleaned' }))).toEqual([
      'not-checked-out',
    ]);
  });
  it('offers the four cleaning states after check-out, never Not Checked Out', () => {
    for (const housekeeping of [undefined, 'cleaned', 'needs-maintenance'] as const) {
      expect(values(block({ status: 'checked-out', housekeeping }))).toEqual([
        'needs-cleaning',
        'cleaned',
        'ready',
        'needs-maintenance',
      ]);
    }
  });
  it('offers nothing where there is no block', () => {
    expect(values(block({ roomId: '' }))).toEqual([]);
  });
});

describe('check-in and check-out effects', () => {
  it('check-in stores Not Checked Out, check-out Needs Cleaning', () => {
    expect(housekeepingOnCheckIn()).toBe('not-checked-out');
    expect(housekeepingOnCheckOut()).toBe('needs-cleaning');
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
