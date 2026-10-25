// Mock Quick Stats: plausible numbers for any date, week or month, deterministic from the request
// (the same query always gives the same answer). Replaced by the backend later.
import { addDays, monthRange, daysBetween } from '../lib/dates';
import { occupancyCounts, summarizeOccupancy } from './occupancy';
import { rateCategories } from './mockData';
import { totalsFor, weightedAverageRateOrNull } from './stats';
import type {
  OccupancyCounts,
  QuickStats,
  QuickStatsDayOccupancy,
  QuickStatsQuery,
  QuickStatsRevenue,
  QuickStatsRoomBlock,
} from './types';

/** PLACEHOLDER: rooms that can be sold per night; the real count comes from the Rooms setup. */
export const MOCK_SELLABLE_ROOMS = 24;

// PLACEHOLDER: Figma shows only "[Block Name]" and "[Rate Category]"; these names are invented.
const BLOCK_NAMES = [
  'Member-Guest Tournament',
  'Spring Wedding Party',
  'Board Retreat',
  'Charity Golf Outing',
  'Holiday Reunion',
  'Junior Championship',
];

/** Base nightly rate per rate category id, in cents (placeholder). */
const BASE_RATE: Record<string, number> = {
  'rc-member': 16_000,
  'rc-non-member': 21_000,
  'rc-comp': 0,
  'rc-owner': 10_000,
};

function hash(text: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 16_777_619);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator, so a query always yields the same numbers. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const between = (rand: () => number, min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));

function occupancyForDay(date: string): OccupancyCounts {
  const rand = seeded(hash(`occupancy:${date}`));
  const booked = between(rand, 6, MOCK_SELLABLE_ROOMS - 2);
  return occupancyCounts(booked, MOCK_SELLABLE_ROOMS - booked);
}

/**
 * Splits `total` whole units over `weights` by the largest-remainder method, so the parts always
 * add up to `total` (separate rounding drifts by one).
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}

/** Revenue for `nightsTotal` room nights, split over the rate categories deterministically. */
function revenueFor(
  seedKey: string,
  nightsTotal: number,
  categories: readonly CategoryRef[],
): QuickStatsRevenue {
  const rand = seeded(hash(`revenue:${seedKey}`));
  const weights = categories.map(() => 0.5 + rand());
  const shares = apportion(nightsTotal, weights);
  const rows = categories.map((c, i) => {
    const nights = shares[i];
    const base = BASE_RATE[c.id] ?? 18_000;
    const jitter = between(rand, -1_500, 1_500);
    const rate = base === 0 ? 0 : base + jitter;
    return { id: c.id, name: c.name, nights, revenue: nights * rate };
  });
  const totals = totalsFor(rows);
  return {
    rows,
    totalRevenue: totals.totalRevenue,
    totalNights: totals.totalNights,
    averageRate: weightedAverageRateOrNull(totals.totalRevenue, totals.totalNights),
  };
}

function roomBlocksFor(from: string, to: string): QuickStatsRoomBlock[] {
  const rand = seeded(hash(`blocks:${from}:${to}`));
  const span = daysBetween(from, to) + 1;
  const count = between(rand, 2, 4);
  return Array.from({ length: count }, (_, i) => {
    const nights = between(rand, 1, 3);
    const booked = between(rand, 2, 8);
    const available = between(rand, 0, 6);
    return {
      id: `blk-${from}-${i}`,
      name: BLOCK_NAMES[(hash(`${from}:${i}`) + i) % BLOCK_NAMES.length],
      nights,
      startDate: addDays(from, between(rand, 0, Math.max(0, span - 1))),
      counts: occupancyCounts(booked, available),
    };
  });
}

/** A rate category as the revenue table needs it. */
export interface CategoryRef {
  id: string;
  name: string;
}

/**
 * The answer to `query`. `categories` are the club's rate categories (the Rate Categories setup);
 * the seed list is used without it.
 */
export function buildQuickStats(
  query: QuickStatsQuery,
  categories: readonly CategoryRef[] = rateCategories,
): QuickStats {
  switch (query.view) {
    case 'day': {
      const occupancy = occupancyForDay(query.date);
      const roomBlocks = roomBlocksFor(query.date, query.date);
      return {
        view: 'day',
        date: query.date,
        occupancy,
        revenue: revenueFor(query.date, occupancy.booked, categories),
        roomBlocks,
        roomBlocksTotal: summarizeOccupancy(roomBlocks.map((b) => b.counts)),
      };
    }
    case 'week': {
      const days: QuickStatsDayOccupancy[] = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(query.startDate, i);
        return { date, counts: occupancyForDay(date) };
      });
      const daysTotal = summarizeOccupancy(days.map((d) => d.counts));
      const nights = days.reduce((sum, d) => sum + d.counts.booked, 0);
      return {
        view: 'week',
        startDate: query.startDate,
        occupancy: daysTotal,
        revenue: revenueFor(query.startDate, nights, categories),
        days,
        daysTotal,
      };
    }
    case 'month': {
      const { from, to } = monthRange(query.month);
      const length = daysBetween(from, to) + 1;
      const perDay = Array.from({ length }, (_, i) => occupancyForDay(addDays(from, i)));
      const occupancy = summarizeOccupancy(perDay);
      const roomBlocks = roomBlocksFor(from, to);
      return {
        view: 'month',
        month: query.month,
        occupancy,
        revenue: revenueFor(
          query.month,
          perDay.reduce((sum, d) => sum + d.booked, 0),
          categories,
        ),
        roomBlocks,
        roomBlocksTotal: summarizeOccupancy(roomBlocks.map((b) => b.counts)),
      };
    }
  }
}

const NO_OCCUPANCY: OccupancyCounts = { booked: 0, available: 0, percent: 0 };
const NO_REVENUE: QuickStatsRevenue = {
  rows: [],
  totalRevenue: 0,
  totalNights: 0,
  averageRate: null,
};

/** The "empty" scenario: nothing to show for the period. */
export function emptyQuickStats(query: QuickStatsQuery): QuickStats {
  const base = { occupancy: NO_OCCUPANCY, revenue: NO_REVENUE };
  switch (query.view) {
    case 'day':
      return {
        view: 'day',
        date: query.date,
        ...base,
        roomBlocks: [],
        roomBlocksTotal: NO_OCCUPANCY,
      };
    case 'week':
      return {
        view: 'week',
        startDate: query.startDate,
        ...base,
        days: [],
        daysTotal: NO_OCCUPANCY,
      };
    case 'month':
      return {
        view: 'month',
        month: query.month,
        ...base,
        roomBlocks: [],
        roomBlocksTotal: NO_OCCUPANCY,
      };
  }
}
