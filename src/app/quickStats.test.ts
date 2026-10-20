import type { QuickStats } from '../api/types';
import {
  EM_DASH,
  blockSubtitle,
  defaultPeriods,
  formatCount,
  formatMoney,
  formatMoneyWhole,
  formatMonthDay,
  formatPercent,
  formatShortDate,
  isQuickStatsEmpty,
  monthChoices,
  monthSelectLabel,
  occupancyPercent,
  quickStatsQuery,
  summarizeOccupancy,
  weightedAverageRateOrNull,
} from './quickStats';

describe('formatting', () => {
  it('formats money from cents', () => {
    expect(formatMoney(12_345)).toBe('$123.45');
    expect(formatMoney(123_456_00)).toBe('$123,456.00');
    expect(formatMoney(0)).toBe('$0.00');
  });
  it('formats the total revenue in whole dollars', () => {
    expect(formatMoneyWhole(1_234_567)).toBe('$12,346');
    expect(formatMoneyWhole(4_250_000)).toBe('$42,500');
  });
  it('shows an em dash for missing values', () => {
    for (const f of [formatMoney, formatMoneyWhole, formatCount, formatPercent]) {
      expect(f(null)).toBe(EM_DASH);
      expect(f(undefined)).toBe(EM_DASH);
      expect(f(Number.NaN)).toBe(EM_DASH);
    }
    expect(formatMonthDay('nope')).toBe(EM_DASH);
    expect(formatShortDate('2026-02-30')).toBe(EM_DASH);
  });
  it('formats counts and percents', () => {
    expect(formatCount(1234)).toBe('1,234');
    expect(formatCount(0)).toBe('0');
    expect(formatPercent(68.5)).toBe('68.5');
    expect(formatPercent(70)).toBe('70');
    expect(formatPercent(66.666)).toBe('66.7');
  });
  it('formats dates', () => {
    expect(formatMonthDay('2026-12-03')).toBe('12/03');
    expect(formatShortDate('2026-12-03')).toBe('12/03/26');
  });
  it('words the block subtitle with a singular night', () => {
    expect(blockSubtitle(3, '2026-12-03')).toBe('3 Nights starting 12/03');
    expect(blockSubtitle(1, '2026-12-03')).toBe('1 Night starting 12/03');
  });
});

describe('occupancy', () => {
  it('is booked over booked plus available, to one decimal', () => {
    expect(occupancyPercent(12, 12)).toBe(50);
    expect(occupancyPercent(1, 2)).toBe(33.3);
    expect(occupancyPercent(0, 0)).toBe(0);
  });
  it('sums booked and available and averages the percents', () => {
    expect(
      summarizeOccupancy([
        { booked: 10, available: 14, percent: 41.7 },
        { booked: 20, available: 4, percent: 83.3 },
      ]),
    ).toEqual({ booked: 30, available: 18, percent: 62.5 });
    expect(summarizeOccupancy([])).toEqual({ booked: 0, available: 0, percent: 0 });
  });
});

describe('weighted average rate', () => {
  it('divides revenue by nights, null without nights', () => {
    expect(weightedAverageRateOrNull(100_000, 8)).toBe(12_500);
    expect(weightedAverageRateOrNull(0, 0)).toBeNull();
  });
});

describe('per-tab periods', () => {
  it('defaults to today, the start of the week and the current month', () => {
    // 2026-10-16 is a Friday.
    expect(defaultPeriods('2026-10-16')).toEqual({
      day: '2026-10-16',
      week: '2026-10-11',
      month: '2026-10',
    });
    expect(defaultPeriods('2026-10-16', 1).week).toBe('2026-10-12');
  });
  it('builds the query for each view', () => {
    expect(quickStatsQuery('day', '2026-10-16')).toEqual({ view: 'day', date: '2026-10-16' });
    expect(quickStatsQuery('week', '2026-10-11')).toEqual({
      view: 'week',
      startDate: '2026-10-11',
    });
    expect(quickStatsQuery('month', '2026-10')).toEqual({ view: 'month', month: '2026-10' });
  });
});

describe('month choices', () => {
  it('labels the month in progress "(to date)" and the rest with their year', () => {
    expect(monthSelectLabel('2026-12', '2026-12-09')).toBe('December (to date)');
    expect(monthSelectLabel('2026-11', '2026-12-09')).toBe('November 2026');
  });
  it('lists the current month first, then earlier months, across year ends', () => {
    const choices = monthChoices('2026-01-15', 3);
    expect(choices).toEqual([
      { value: '2026-01', label: 'January (to date)' },
      { value: '2025-12', label: 'December 2025' },
      { value: '2025-11', label: 'November 2025' },
    ]);
  });
});

describe('isQuickStatsEmpty', () => {
  const none = { booked: 0, available: 0, percent: 0 };
  const revenue = { rows: [], totalRevenue: 0, totalNights: 0, averageRate: null };
  it('is true without revenue rows and without blocks or days', () => {
    expect(
      isQuickStatsEmpty({
        view: 'week',
        startDate: '2026-10-11',
        occupancy: none,
        revenue,
        days: [],
        daysTotal: none,
      } satisfies QuickStats),
    ).toBe(true);
  });
  it('is false when any detail exists', () => {
    expect(
      isQuickStatsEmpty({
        view: 'day',
        date: '2026-10-16',
        occupancy: none,
        revenue,
        roomBlocks: [{ id: 'b', name: 'B', nights: 1, startDate: '2026-10-16', counts: none }],
        roomBlocksTotal: none,
      } satisfies QuickStats),
    ).toBe(false);
  });
});
