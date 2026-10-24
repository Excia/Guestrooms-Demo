import { describe, expect, it } from 'vitest';
import {
  blockIndicators,
  indicatorsForStatus,
  linkedTier,
  linkedTooltipLines,
  LINKED_TIER_MIN_WIDTH,
} from './scheduleLinked';
import { blockAriaLabel, blockMarkers } from './scheduleGrid';
import type { ScheduleBlock } from '../api/types';

describe('linkedTier', () => {
  it('shows the icon alone at a 30 day single-night width', () => {
    expect(linkedTier(40)).toBe('icon');
    expect(linkedTier(60)).toBe('icon');
  });
  it('adds the room number at a 14 day single-night width', () => {
    expect(linkedTier(90)).toBe('room');
  });
  it('adds the reserver name once icon and number fit on one line (7 day single night)', () => {
    expect(linkedTier(120)).toBe('reserver');
    expect(linkedTier(360)).toBe('reserver');
  });
  it('switches exactly at the limits', () => {
    expect(linkedTier(LINKED_TIER_MIN_WIDTH.room - 1)).toBe('icon');
    expect(linkedTier(LINKED_TIER_MIN_WIDTH.room)).toBe('room');
    expect(linkedTier(LINKED_TIER_MIN_WIDTH.reserver - 1)).toBe('room');
    expect(linkedTier(LINKED_TIER_MIN_WIDTH.reserver)).toBe('reserver');
    expect(linkedTier(0)).toBe('icon');
  });
});

describe('linkedTooltipLines', () => {
  it('is "Linked to [Room Number]" then the reserver name', () => {
    expect(linkedTooltipLines({ roomNumber: '202', reserverName: 'Thomas Okafor' })).toEqual([
      'Linked to 202',
      'Thomas Okafor',
    ]);
  });
});

describe('indicatorsForStatus', () => {
  const both = { earlyCheckIn: true, lateCheckOut: true };
  it('Not Yet Checked In shows only early check in', () => {
    expect(indicatorsForStatus('nyci', both)).toEqual({ early: true, late: false });
    expect(indicatorsForStatus('confirmed', both)).toEqual({ early: true, late: false });
    expect(indicatorsForStatus('nyci', { lateCheckOut: true })).toEqual({
      early: false,
      late: false,
    });
  });
  it('Checked In and Checked Out show only late check out, even if both are set', () => {
    expect(indicatorsForStatus('checked-in', both)).toEqual({ early: false, late: true });
    expect(indicatorsForStatus('checked-out', both)).toEqual({ early: false, late: true });
    expect(indicatorsForStatus('checked-in', { earlyCheckIn: true })).toEqual({
      early: false,
      late: false,
    });
  });
  it('keeps both flags when the status is unknown', () => {
    expect(indicatorsForStatus(undefined, both)).toEqual({ early: true, late: true });
  });
});

describe('blockIndicators', () => {
  it('a linked block draws no indicators, whatever its flags and status', () => {
    const linkedTo = { roomNumber: '1', reserverName: 'A B' };
    for (const status of ['nyci', 'checked-in', 'checked-out'] as const) {
      expect(blockIndicators({ status, earlyCheckIn: true, lateCheckOut: true, linkedTo })).toEqual(
        { early: false, late: false },
      );
    }
  });
  it('an unlinked block uses its own flags', () => {
    expect(blockIndicators({ status: 'checked-out', lateCheckOut: true })).toEqual({
      early: false,
      late: true,
    });
  });
});

describe('blockMarkers with a status', () => {
  const edge = { continuesBefore: false, continuesAfter: false };
  const both = { earlyCheckIn: true, lateCheckOut: true };
  it('draws the left sliver for not yet checked in and the right one after check in', () => {
    expect(blockMarkers({ ...both, status: 'nyci' }, edge)).toEqual({ left: true, right: false });
    expect(blockMarkers({ ...both, status: 'checked-in' }, edge)).toEqual({
      left: false,
      right: true,
    });
    expect(blockMarkers({ ...both, status: 'checked-out' }, edge)).toEqual({
      left: false,
      right: true,
    });
  });
});

describe('blockMarkers for a linked block', () => {
  it('draws no marker on either edge', () => {
    const linkedTo = { roomNumber: '1', reserverName: 'A B' };
    expect(
      blockMarkers(
        { status: 'nyci', earlyCheckIn: true, lateCheckOut: true, linkedTo },
        { continuesBefore: false, continuesAfter: false },
      ),
    ).toEqual({ left: false, right: false });
  });
});

describe('blockAriaLabel for linked blocks', () => {
  const base = {
    guestName: 'Henry Lowell',
    confirmationNumber: 'GR-1',
    status: 'checked-in',
    startDate: '2026-10-20',
    endDate: '2026-10-21',
    earlyCheckIn: true,
    lateCheckOut: true,
    linkedTo: { roomNumber: '202', reserverName: 'Thomas Okafor' },
  } as unknown as ScheduleBlock;
  it('says what the block is linked to and names no early/late indicator', () => {
    const label = blockAriaLabel(base, { number: '203' });
    expect(label).toContain('Linked to 202, Thomas Okafor');
    expect(label).not.toContain('early check in');
    expect(label).not.toContain('late check out');
  });
});
