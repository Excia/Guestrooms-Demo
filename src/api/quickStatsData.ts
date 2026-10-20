// Mock Quick Stats: plausible numbers for any date, week or month, deterministic from the request
// (the same query always gives the same answer). Replaced by the backend later.
import { addDays, monthRange, daysBetween } from '../app/dateSelection';
import { occupancyCounts, summarizeOccupancy, weightedAverageRateOrNull } from '../app/quickStats';
import { rateCategories } from './mockData';
import { totalsFor } from './stats';
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
  member: 16_000,
  reciprocal: 19_500,
  'guest-of-member': 22_500,
  event: 24_500,
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

/** Revenue for `nightsTotal` room nights, split over the rate categories deterministically. */
function revenueFor(seedKey: string, nightsTotal: number): QuickStatsRevenue {
  const rand = seeded(hash(`revenue:${seedKey}`));
  const weights = rateCategories.map(() => 0.5 + rand());
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const rows = rateCategories.map((c, i) => {
    const nights = Math.round((nightsTotal * weights[i]) / weightSum);
    const rate = (BASE_RATE[c.id] ?? 18_000) + between(rand, -1_500, 1_500);
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

/** The answer to `query`. Shapes follow the three Figma views. */
export function buildQuickStats(query: QuickStatsQuery): QuickStats {
  switch (query.view) {
    case 'day': {
      const occupancy = occupancyForDay(query.date);
      const roomBlocks = roomBlocksFor(query.date, query.date);
      return {
        view: 'day',
        date: query.date,
        occupancy,
        revenue: revenueFor(query.date, occupancy.booked),
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
        revenue: revenueFor(query.startDate, nights),
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
