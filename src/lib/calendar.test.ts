import {
  clampDate,
  dayLabel,
  monthGrid,
  monthTitle,
  moveFocus,
  shiftMonths,
  weekdayHeaders,
} from './calendar';

describe('calendar helpers', () => {
  it('builds a month grid with blanks outside the month', () => {
    const g = monthGrid('2026-10');
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(monthGrid('2026-10', 1)[0].slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(monthGrid('bad')).toEqual([]);
  });

  it('orders weekday headers from the week start', () => {
    expect(weekdayHeaders()[0]).toEqual({ short: 'Su', long: 'Sunday' });
    expect(weekdayHeaders(1)[6].long).toBe('Sunday');
  });

  it('moves the focus like the WAI-ARIA date grid', () => {
    expect(moveFocus('2026-10-20', 'ArrowRight')).toBe('2026-10-21');
    expect(moveFocus('2026-10-20', 'ArrowLeft')).toBe('2026-10-19');
    expect(moveFocus('2026-10-20', 'ArrowDown')).toBe('2026-10-27');
    expect(moveFocus('2026-10-20', 'ArrowUp')).toBe('2026-10-13');
    expect(moveFocus('2026-10-20', 'Home')).toBe('2026-10-18');
    expect(moveFocus('2026-10-20', 'End')).toBe('2026-10-24');
    expect(moveFocus('2026-10-20', 'PageDown')).toBe('2026-11-20');
    expect(moveFocus('2026-01-31', 'PageDown')).toBe('2026-02-28');
    expect(moveFocus('2026-10-20', 'PageUp', true)).toBe('2025-10-20');
    expect(moveFocus('2026-10-20', 'a')).toBeNull();
  });

  it('shifts months, clamps and labels', () => {
    expect(shiftMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(clampDate('2026-01-01', '2026-10-20', '2027-01-01')).toBe('2026-10-20');
    expect(clampDate('2030-01-01', '2026-10-20', '2027-01-01')).toBe('2027-01-01');
    expect(monthTitle('2026-10')).toBe('October 2026');
    expect(dayLabel('2026-10-20')).toBe('Tuesday, October 20, 2026');
  });
});
