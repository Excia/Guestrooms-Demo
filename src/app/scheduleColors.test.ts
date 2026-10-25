import { describe, expect, it } from 'vitest';
import { theme } from '../theme';
import { blockFillToken, housekeepingFillToken, EDGE_TAB_SPACING } from './scheduleColors';

const today = '2026-10-24';
const res = (status: 'confirmed' | 'nyci' | 'checked-in' | 'checked-out', endDate = '2026-10-27') =>
  ({ kind: 'reservation', status, endDate }) as const;

describe('blockFillToken', () => {
  it('maps every block state', () => {
    expect(blockFillToken(res('confirmed'), today)).toBe('nyci');
    expect(blockFillToken(res('nyci'), today)).toBe('nyci');
    expect(blockFillToken(res('checked-in'), today)).toBe('checkedIn');
    expect(blockFillToken(res('checked-in', today), today)).toBe('dueOut');
    expect(blockFillToken(res('checked-out', today), today)).toBe('checkedOut');
    expect(
      blockFillToken(
        { ...res('confirmed'), linkedTo: { roomNumber: '1', reserverName: 'A B' } },
        today,
      ),
    ).toBe('linked');
    expect(blockFillToken({ kind: 'closure', endDate: today }, today)).toBe('closure');
  });
});

describe('housekeepingFillToken', () => {
  it('maps the five visible statuses and leaves nyci unfilled', () => {
    expect(housekeepingFillToken('not-checked-out')).toBe('hkNotCheckedOut');
    expect(housekeepingFillToken('needs-cleaning')).toBe('hkNeedsCleaning');
    expect(housekeepingFillToken('cleaned')).toBe('hkCleaned');
    expect(housekeepingFillToken('ready')).toBe('hkReady');
    expect(housekeepingFillToken('needs-maintenance')).toBe('hkNeedsMaintenance');
    expect(housekeepingFillToken('nyci')).toBeNull();
  });
  it('every token exists in the theme with the Figma value', () => {
    const c = theme.palette.schedule;
    expect(c.hkNotCheckedOut).toBe('rgba(66, 66, 66, 0.3)');
    expect(c.hkNeedsCleaning).toBe('rgba(228, 113, 0, 0.8)');
    expect(c.hkCleaned).toBe('rgba(253, 216, 53, 0.8)');
    expect(c.hkReady).toBe('rgba(56, 142, 60, 0.8)');
    expect(c.hkNeedsMaintenance).toBe('rgba(239, 83, 80, 0.8)');
    expect(c.nyci).toBe('rgba(250, 250, 250, 0.8)');
    expect(c.checkedIn).toBe('rgba(175, 210, 177, 0.8)');
    expect(c.checkedOut).toBe('rgba(224, 224, 224, 0.8)');
    expect(c.dueOut).toBe('rgba(228, 113, 0, 0.4)');
    expect(c.linked).toBe('rgba(189, 189, 189, 0.8)');
  });

  it('draws the early and late tabs 4px wide (owner decision, 8px spacing unit)', () => {
    expect(EDGE_TAB_SPACING * 8).toBe(4);
  });
});
