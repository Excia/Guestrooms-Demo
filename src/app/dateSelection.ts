// Pure date-state logic for <DateSelection> (Figma 120:8668).
// Assumption: the club timezone is not specified, so every date is a local calendar date held as
// an ISO "yyyy-mm-dd" string (months as "yyyy-mm"). Arithmetic runs on UTC midnights, so DST never
// shifts a day. Weeks start on Sunday unless a caller passes another day.

import {
  addDays,
  daysBetween,
  formatIsoDate,
  isValidIsoDate,
  isValidMonth,
  monthOf,
  monthRange,
  pad,
  parseIsoDate,
  parseMonth,
  todayIso,
  type DateRange,
  type IsoDate,
  type IsoMonth,
} from '../lib/dates';

export {
  addDays,
  daysBetween,
  formatIsoDate,
  isValidIsoDate,
  isValidMonth,
  monthOf,
  monthRange,
  parseIsoDate,
  todayIso,
  type DateRange,
  type IsoDate,
  type IsoMonth,
};

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Period =
  | { kind: 'custom'; from: IsoDate; to: IsoDate }
  | { kind: 'singleDay'; date: IsoDate }
  | { kind: 'thisWeek'; from: IsoDate; to: IsoDate }
  | { kind: 'month'; month: IsoMonth }
  | { kind: 'asOf'; date: IsoDate };

export type PeriodKind = Period['kind'];
export type RangePreset = 'lastWeek' | 'previousPeriod' | 'custom';

// Comparison defaults are NOT in the Figma file except "This Week -> Last Week" and
// "Month -> same month a year earlier" (Compare-Month frame). The rest are invented and need the
// owner's confirmation: Custom -> previous period of equal length, Single Day -> previous day,
// As Of -> same date one year earlier.
// `derived` is internal bookkeeping: absent or true means the comparison follows the period; the
// library sets it to false once the user edits it (ranges use preset 'custom' instead), after which
// it stays independent. Fixtures and saved values may omit it. Changing the period KIND rebuilds
// the comparison and discards a user edit (intentional: the old shape no longer fits).
export type Comparison =
  | { kind: 'range'; preset: RangePreset; from: IsoDate; to: IsoDate }
  | { kind: 'month'; month: IsoMonth; derived?: boolean }
  | { kind: 'date'; date: IsoDate; derived?: boolean };

/**
 * What <DateSelection> reports. `comparison` is null while "Compare Dates" is off.
 * onChange may emit an invalid value (empty or inverted dates while typing): consumers must check
 * isValidValue()/validateValue() before using it. Note: thisWeek and asOf store materialised dates,
 * so a persisted value goes stale ("this week" is not re-evaluated); revisit when reports persist.
 */
export interface DateSelectionValue {
  period: Period;
  comparison: Comparison | null;
}

/** The eight Figma states (frame 120:8668). */
export type DateSelectionState =
  | 'Custom'
  | 'Single Day'
  | 'This Week'
  | 'Month'
  | 'As Of'
  | 'Compare'
  | 'Compare-Month'
  | 'Compare-AsOf';

export const PERIOD_KINDS: readonly PeriodKind[] = [
  'custom',
  'singleDay',
  'thisWeek',
  'month',
  'asOf',
];

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  custom: 'Custom',
  singleDay: 'Single Day',
  thisWeek: 'This Week',
  month: 'Month',
  asOf: 'As Of',
};

export const PRESET_LABELS: Record<RangePreset, string> = {
  lastWeek: 'Last Week',
  previousPeriod: 'Previous Period',
  custom: 'Custom',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function addMonths(month: IsoMonth, delta: number): IsoMonth {
  const p = parseMonth(month);
  if (!p) return month;
  const total = p.year * 12 + p.index + delta;
  return `${pad(Math.floor(total / 12), 4)}-${pad((total % 12) + 1)}`;
}

/** "February 2025" (English, fixed so output does not depend on the runtime locale). */
export function monthLabel(month: IsoMonth): string {
  const p = parseMonth(month);
  return p ? `${MONTH_NAMES[p.index]} ${p.year}` : month;
}

/** The same calendar day `delta` months away, clamped to the month end (Feb 29 + 12 -> Feb 28). */
export function addMonthsToDate(iso: IsoDate, delta: number): IsoDate {
  if (!parseIsoDate(iso)) return iso;
  const target = addMonths(monthOf(iso), delta);
  const last = Number(monthRange(target).to.slice(8));
  return `${target}-${pad(Math.min(Number(iso.slice(8)), last))}`;
}

/** The 7-day week containing `iso`. */
export function weekRange(iso: IsoDate, weekStartsOn: WeekStart = 0): DateRange {
  const d = parseIsoDate(iso);
  if (!d) return { from: iso, to: iso };
  const offset = (d.getUTCDay() - weekStartsOn + 7) % 7;
  const from = addDays(iso, -offset);
  return { from, to: addDays(from, 6) };
}

/** Month choices for the Month selects: `count` months ending at `latest`, newest first. */
export function monthOptions(latest: IsoMonth, selected: IsoMonth, count = 36): IsoMonth[] {
  const options = Array.from({ length: count }, (_, i) => addMonths(latest, -i));
  return isValidMonth(selected) && !options.includes(selected) ? [selected, ...options] : options;
}

export function defaultPeriod(
  kind: PeriodKind,
  today: IsoDate,
  weekStartsOn: WeekStart = 0,
): Period {
  switch (kind) {
    case 'custom':
      return { kind, from: today, to: today };
    case 'singleDay':
      return { kind, date: today };
    case 'thisWeek':
      return { kind, ...weekRange(today, weekStartsOn) };
    case 'month':
      return { kind, month: monthOf(today) };
    case 'asOf':
      return { kind, date: today };
  }
}

/** Presets offered for the "Compare to" range select; thisWeek and custom differ. */
export function rangePresets(kind: PeriodKind): RangePreset[] {
  return kind === 'thisWeek' ? ['lastWeek', 'custom'] : ['previousPeriod', 'custom'];
}

function presetRange(preset: RangePreset, from: IsoDate, to: IsoDate): DateRange {
  const length = daysBetween(from, to) + 1;
  if (preset === 'lastWeek') return { from: addDays(from, -7), to: addDays(to, -7) };
  // previousPeriod: the same number of days ending the day before `from`.
  return { from: addDays(from, -length), to: addDays(from, -1) };
}

/** The comparison paired with a period: same shape as the period (range, month or date). */
export function defaultComparison(period: Period): Comparison {
  switch (period.kind) {
    case 'custom':
    case 'thisWeek': {
      const preset = rangePresets(period.kind)[0];
      return { kind: 'range', preset, ...presetRange(preset, period.from, period.to) };
    }
    case 'singleDay':
      return { kind: 'date', date: addDays(period.date, -1), derived: true };
    case 'month':
      return { kind: 'month', month: addMonths(period.month, -12), derived: true };
    case 'asOf':
      return { kind: 'date', date: addMonthsToDate(period.date, -12), derived: true };
  }
}

export function createValue(
  kind: PeriodKind,
  today: IsoDate,
  weekStartsOn: WeekStart = 0,
): DateSelectionValue {
  return { period: defaultPeriod(kind, today, weekStartsOn), comparison: null };
}

/** Switching the period type resets the period; an active comparison is rebuilt to match it. */
export function changePeriodKind(
  value: DateSelectionValue,
  kind: PeriodKind,
  today: IsoDate,
  weekStartsOn: WeekStart = 0,
): DateSelectionValue {
  if (value.period.kind === kind) return value;
  const period = defaultPeriod(kind, today, weekStartsOn);
  return { period, comparison: value.comparison ? defaultComparison(period) : null };
}

/**
 * Replaces the period. A derived comparison (preset or default) follows it; a custom one stays.
 * While the period itself is invalid the comparison is left untouched, so typing a half-entered
 * date does not scramble it.
 */
export function updatePeriod(value: DateSelectionValue, period: Period): DateSelectionValue {
  const c = value.comparison;
  if (!c || periodError(period)) return { ...value, period };
  if (c.kind === 'range') {
    if (c.preset === 'custom' || !('from' in period)) return { period, comparison: c };
    return { period, comparison: { ...c, ...presetRange(c.preset, period.from, period.to) } };
  }
  return { period, comparison: c.derived !== false ? defaultComparison(period) : c };
}

export function setCompare(value: DateSelectionValue, on: boolean): DateSelectionValue {
  if (!on) return { ...value, comparison: null };
  return value.comparison ? value : { ...value, comparison: defaultComparison(value.period) };
}

/** A user edit: month and date comparisons become independent of the period. */
export function updateComparison(
  value: DateSelectionValue,
  comparison: Comparison,
): DateSelectionValue {
  return {
    ...value,
    comparison:
      comparison.kind === 'range'
        ? { ...comparison, preset: 'custom' }
        : { ...comparison, derived: false },
  };
}

/** Selecting a preset recomputes its dates; "custom" keeps the current ones editable. */
export function setRangePreset(value: DateSelectionValue, preset: RangePreset): DateSelectionValue {
  const c = value.comparison;
  const p = value.period;
  if (c?.kind !== 'range' || !('from' in p)) return value;
  if (preset === 'custom') return { ...value, comparison: { ...c, preset } };
  return { ...value, comparison: { kind: 'range', preset, ...presetRange(preset, p.from, p.to) } };
}

/** Which of the eight Figma states the value renders as. */
export function dateSelectionState(value: DateSelectionValue): DateSelectionState {
  const c = value.comparison;
  if (c)
    return c.kind === 'month'
      ? 'Compare-Month'
      : value.period.kind === 'asOf'
        ? 'Compare-AsOf'
        : 'Compare';
  switch (value.period.kind) {
    case 'custom':
      return 'Custom';
    case 'singleDay':
      return 'Single Day';
    case 'thisWeek':
      return 'This Week';
    case 'month':
      return 'Month';
    case 'asOf':
      return 'As Of';
  }
}

export interface DateSelectionErrors {
  period?: string;
  comparison?: string;
}

function rangeError(from: string, to: string): string | undefined {
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return 'Enter a valid date.';
  return from > to ? 'From must be on or before To.' : undefined;
}

function dateError(date: string): string | undefined {
  return isValidIsoDate(date) ? undefined : 'Enter a valid date.';
}

function monthError(month: string): string | undefined {
  return isValidMonth(month) ? undefined : 'Choose a month.';
}

function periodError(p: Period): string | undefined {
  return p.kind === 'custom' || p.kind === 'thisWeek'
    ? rangeError(p.from, p.to)
    : p.kind === 'month'
      ? monthError(p.month)
      : dateError(p.date);
}

function comparisonError(c: Comparison): string | undefined {
  return c.kind === 'range'
    ? rangeError(c.from, c.to)
    : c.kind === 'month'
      ? monthError(c.month)
      : dateError(c.date);
}

/**
 * Empty object when the value is usable. One message per problem: a period mistake is reported at
 * the period only, and the comparison is not checked until the period is valid.
 */
export function validateValue(value: DateSelectionValue): DateSelectionErrors {
  const period = periodError(value.period);
  if (period) return { period };
  const comparison = value.comparison ? comparisonError(value.comparison) : undefined;
  return comparison ? { comparison } : {};
}

export function isValidValue(value: DateSelectionValue): boolean {
  const e = validateValue(value);
  return !e.period && !e.comparison;
}

/** The concrete inclusive date range of a period (month: first..last day; one day: twice). */
export function periodRange(period: Period): DateRange {
  switch (period.kind) {
    case 'custom':
    case 'thisWeek':
      return { from: period.from, to: period.to };
    case 'month':
      return monthRange(period.month);
    case 'singleDay':
    case 'asOf':
      return { from: period.date, to: period.date };
  }
}

export function comparisonRange(comparison: Comparison): DateRange {
  switch (comparison.kind) {
    case 'range':
      return { from: comparison.from, to: comparison.to };
    case 'month':
      return monthRange(comparison.month);
    case 'date':
      return { from: comparison.date, to: comparison.date };
  }
}
