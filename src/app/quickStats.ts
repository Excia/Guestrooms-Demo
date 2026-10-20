// Pure rules for the Quick Stats panel (Figma component set 78:3760): formatting, occupancy math,
// per-tab defaults and the month choices. Money is integer cents; revenue excludes taxes and
// service charges, and the average rate is weighted (total revenue / total nights).
import type {
  Cents,
  OccupancyCounts,
  QuickStats,
  QuickStatsQuery,
  QuickStatsView,
} from '../api/types';
import { weightedAverageRate } from '../api/stats';
import {
  addMonths,
  monthLabel,
  monthOf,
  parseIsoDate,
  weekRange,
  type IsoDate,
  type IsoMonth,
  type WeekStart,
} from './dateSelection';

export const EM_DASH = '—';

export const QUICK_STATS_VIEWS: readonly QuickStatsView[] = ['day', 'week', 'month'];

export const VIEW_LABELS: Record<QuickStatsView, string> = {
  day: 'Day View',
  week: 'Week View',
  month: 'Month View',
};

export const REVENUE_TITLES: Record<QuickStatsView, string> = {
  day: 'Daily Revenue',
  week: 'Weekly Revenue',
  month: 'Monthly Revenue',
};

/** Control label above the stats (Figma: Date, Start Date, Month). */
export const CONTROL_LABELS: Record<QuickStatsView, string> = {
  day: 'Date',
  week: 'Start Date',
  month: 'Month',
};

/** The dashboard frame opens on the Week View. */
export const DEFAULT_VIEW: QuickStatsView = 'week';

// ---- formatting --------------------------------------------------------------------------------

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const isNumber = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** "$1,234.00"; an em dash for a missing value. */
export function formatMoney(cents: Cents | null | undefined): string {
  return isNumber(cents) ? usd.format(cents / 100) : EM_DASH;
}

/** "$12,345" (whole dollars, the TOTAL revenue); an em dash for a missing value. */
export function formatMoneyWhole(cents: Cents | null | undefined): string {
  return isNumber(cents) ? usdWhole.format(cents / 100) : EM_DASH;
}

/** Whole numbers (nights, rooms) with thousands separators; an em dash for a missing value. */
export function formatCount(n: number | null | undefined): string {
  return isNumber(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : EM_DASH;
}

/** "68.5", "70": at most one decimal; an em dash for a missing value. The icon carries the "%". */
export function formatPercent(p: number | null | undefined): string {
  return isNumber(p) ? p.toLocaleString('en-US', { maximumFractionDigits: 1 }) : EM_DASH;
}

/** "12/03" for an ISO date; an em dash when it is not a valid date. */
export function formatMonthDay(iso: IsoDate): string {
  return parseIsoDate(iso) ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}` : EM_DASH;
}

/** "12/03/26" for an ISO date (the Week View day column); an em dash when invalid. */
export function formatShortDate(iso: IsoDate): string {
  return parseIsoDate(iso) ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(2, 4)}` : EM_DASH;
}

/** "3 Nights starting 12/03" (Figma: "1 Night" in the singular). */
export function blockSubtitle(nights: number, startDate: IsoDate): string {
  return `${formatCount(nights)} ${nights === 1 ? 'Night' : 'Nights'} starting ${formatMonthDay(startDate)}`;
}

/** Weighted average rate (revenue / nights) in cents; null, shown as an em dash, without nights. */
export function weightedAverageRateOrNull(revenue: Cents, nights: number): Cents | null {
  return nights > 0 ? weightedAverageRate(revenue, nights) : null;
}

// ---- occupancy ---------------------------------------------------------------------------------

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

/** True when a response carries nothing to show (no revenue rows, blocks or days). */
export function isQuickStatsEmpty(stats: QuickStats): boolean {
  const detail = stats.view === 'week' ? stats.days : stats.roomBlocks;
  return stats.revenue.rows.length === 0 && detail.length === 0;
}

// ---- per-tab controls --------------------------------------------------------------------------

/** What each tab's control holds: an ISO date (day), the week's first date, or `yyyy-mm`. */
export type QuickStatsPeriods = Record<QuickStatsView, string>;

export function defaultPeriods(today: IsoDate, weekStartsOn: WeekStart = 0): QuickStatsPeriods {
  return {
    day: today,
    week: weekRange(today, weekStartsOn).from,
    month: monthOf(today),
  };
}

export function quickStatsQuery(view: QuickStatsView, period: string): QuickStatsQuery {
  switch (view) {
    case 'day':
      return { view, date: period };
    case 'week':
      return { view, startDate: period };
    case 'month':
      return { view, month: period };
  }
}

/** "December" from "2026-12"; the month name alone, as the Figma select shows it. */
function monthName(month: IsoMonth): string {
  return monthLabel(month).split(' ')[0];
}

/**
 * Month select label: the month in progress reads "<Month> (to date)" (Figma: "December (to date)"),
 * every other month "<Month> <year>" so options from different years stay distinct.
 */
export function monthSelectLabel(month: IsoMonth, today: IsoDate): string {
  return month === monthOf(today) ? `${monthName(month)} (to date)` : monthLabel(month);
}

export interface MonthChoice {
  value: IsoMonth;
  label: string;
}

/** The current month first (to date), then earlier months, newest first. */
export function monthChoices(today: IsoDate, count = 24): MonthChoice[] {
  const current = monthOf(today);
  return Array.from({ length: count }, (_, i) => {
    const value = addMonths(current, -i);
    return { value, label: monthSelectLabel(value, today) };
  });
}
