import { totalsFor, weightedAverageRate } from './stats';

describe('weightedAverageRate', () => {
  it('divides total revenue by total nights', () => {
    expect(weightedAverageRate(300_000, 3)).toBe(100_000);
  });
  it('rounds to whole cents', () => {
    expect(weightedAverageRate(100_000, 3)).toBe(33_333);
    expect(weightedAverageRate(200_000, 3)).toBe(66_667);
  });
  it('is 0 with no nights (no division by zero)', () => {
    expect(weightedAverageRate(0, 0)).toBe(0);
    expect(weightedAverageRate(5_000, 0)).toBe(0);
  });
});

describe('totalsFor', () => {
  it('weights by nights, not by averaging category averages', () => {
    const t = totalsFor([
      { id: 'a', name: 'A', nights: 1, revenue: 10_000 },
      { id: 'b', name: 'B', nights: 9, revenue: 90_000 + 9_000 },
    ]);
    expect(t).toEqual({ totalRevenue: 109_000, totalNights: 10, averageRate: 10_900 });
  });
  it('handles an empty list', () => {
    expect(totalsFor([])).toEqual({ totalRevenue: 0, totalNights: 0, averageRate: 0 });
  });
});
