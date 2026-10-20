import type { OccupancyCounts } from './types';

/**
 * Occupancy percent: booked / (booked + available) rooms, rounded to one decimal. Assumption (the
 * requirements doc is not available here): "available" excludes rooms that are blocked or out of
 * service, so the basis is the rooms that can be sold.
 */
export function occupancyPercent(booked: number, available: number): number {
  const sellable = booked + available;
  return sellable > 0 ? Math.round((booked / sellable) * 1000) / 10 : 0;
}

export function occupancyCounts(booked: number, available: number): OccupancyCounts {
  return { booked, available, percent: occupancyPercent(booked, available) };
}

/** TOTAL row: sums booked and available; the percent is the mean of the rows' percents ("(avg)"). */
export function summarizeOccupancy(rows: readonly OccupancyCounts[]): OccupancyCounts {
  const booked = rows.reduce((sum, r) => sum + r.booked, 0);
  const available = rows.reduce((sum, r) => sum + r.available, 0);
  const mean = rows.length ? rows.reduce((sum, r) => sum + r.percent, 0) / rows.length : 0;
  return { booked, available, percent: Math.round(mean * 10) / 10 };
}
