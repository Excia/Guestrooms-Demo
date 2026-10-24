import { describe, expect, it } from 'vitest';
import {
  blockIndicators,
  indicatorsForStatus,
  isLinkedBlock,
  linkedBlockText,
  linkedTooltipLines,
} from './scheduleLinked';
import { blockAriaLabel, blockMarkers } from './scheduleGrid';
import type { ScheduleBlock } from '../api/types';

const one = { roomNumber: '202', reserverName: 'Thomas Okafor' };
const several = { ...one, multilinkageCount: 3 };

describe('linkedBlockText', () => {
  it('7 day view: room on the first line, reserver on the second, whatever the stay length', () => {
    for (const nights of [1, 2, 3, 9]) {
      expect(linkedBlockText(one, 7, nights)).toEqual({ title: '202', subtitle: 'Thomas Okafor' });
    }
  });
  it('7 day view with several rooms linked: " +N" after the room, second line blank', () => {
    expect(linkedBlockText(several, 7, 1)).toEqual({ title: '202 +3', subtitle: '' });
  });
  it('14 day view, stay of 3+ nights: the room on the first line only', () => {
    expect(linkedBlockText(one, 14, 3)).toEqual({ title: '202', subtitle: '' });
    expect(linkedBlockText(several, 14, 5)).toEqual({ title: '202 +3', subtitle: '' });
  });
  it('14 day view, stay under 3 nights: empty first line, the room name on the second', () => {
    expect(linkedBlockText(one, 14, 1)).toEqual({ title: '', subtitle: '202' });
    expect(linkedBlockText(one, 14, 2)).toEqual({ title: '', subtitle: '202' });
  });
  it('30 day view: the room only for a stay of 3+ nights', () => {
    expect(linkedBlockText(one, 30, 1)).toEqual({ title: '', subtitle: '' });
    expect(linkedBlockText(one, 30, 2)).toEqual({ title: '', subtitle: '' });
    expect(linkedBlockText(one, 30, 3)).toEqual({ title: '202', subtitle: '' });
  });
  it('a count of 0 or 1 adds nothing', () => {
    expect(linkedBlockText({ ...one, multilinkageCount: 1 }, 7, 1).title).toBe('202');
    expect(linkedBlockText({ ...one, multilinkageCount: 0 }, 7, 1).title).toBe('202');
  });
});

describe('linkedTooltipLines', () => {
  it('is "Linked to [Room]" then the reserver name', () => {
    expect(linkedTooltipLines(one)).toEqual(['Linked to 202', 'Thomas Okafor']);
  });
  it('adds " +N Room" when several rooms are linked', () => {
    expect(linkedTooltipLines(several)).toEqual(['Linked to 202 +3 Room', 'Thomas Okafor']);
  });
});

describe('isLinkedBlock', () => {
  it('is true only for a block that has a linked room', () => {
    expect(isLinkedBlock({ linkedTo: one })).toBe(true);
    expect(isLinkedBlock({})).toBe(false);
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
