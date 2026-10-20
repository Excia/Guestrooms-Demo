import type { Cents, RateCategoryStat } from './types';

/** Weighted average rate: total revenue divided by total nights, rounded to whole cents. */
export function weightedAverageRate(revenue: Cents, nights: number): Cents {
  if (nights <= 0) return 0;
  return Math.round(revenue / nights);
}

export function totalsFor(categories: readonly RateCategoryStat[]): {
  totalRevenue: Cents;
  totalNights: number;
  averageRate: Cents;
} {
  const totalRevenue = categories.reduce((sum, c) => sum + c.revenue, 0);
  const totalNights = categories.reduce((sum, c) => sum + c.nights, 0);
  return { totalRevenue, totalNights, averageRate: weightedAverageRate(totalRevenue, totalNights) };
}

/** Weighted average rate (revenue / nights) in cents; null, shown as an em dash, without nights. */
export function weightedAverageRateOrNull(revenue: Cents, nights: number): Cents | null {
  return nights > 0 ? weightedAverageRate(revenue, nights) : null;
}
