// Pure calendar-grid helpers for the themed date picker. Dates are ISO "yyyy-mm-dd" strings and
// arithmetic runs on UTC midnights (see dates.ts), so DST never shifts a day.
import {
  addDays,
  formatIsoDate,
  monthOf,
  monthRange,
  pad,
  parseIsoDate,
  parseMonth,
  type IsoDate,
  type IsoMonth,
} from './dates';

export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Column headers in display order: "Su" with the full "Sunday" for assistive technology. */
export function weekdayHeaders(weekStartsOn: WeekStartDay = 0) {
  return Array.from({ length: 7 }, (_, i) => {
    const name = DAY_NAMES[(weekStartsOn + i) % 7];
    return { short: name.slice(0, 2), long: name };
  });
}

/** Weeks of a month, each 7 cells in display order; days outside the month are null. */
export function monthGrid(month: IsoMonth, weekStartsOn: WeekStartDay = 0): (IsoDate | null)[][] {
  if (!parseMonth(month)) return [];
  const { from, to } = monthRange(month);
  const first = parseIsoDate(from);
  if (!first) return [];
  const lead = (first.getUTCDay() - weekStartsOn + 7) % 7;
  const total = lead + Number(to.slice(8));
  const cells: (IsoDate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: Number(to.slice(8)) }, (_, i) => `${month}-${pad(i + 1)}`),
    ...Array.from({ length: (7 - (total % 7)) % 7 }, () => null),
  ];
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** The same day `delta` months away, clamped to the month end. */
export function shiftMonths(iso: IsoDate, delta: number): IsoDate {
  const p = parseMonth(monthOf(iso));
  if (!p || !parseIsoDate(iso)) return iso;
  const total = p.year * 12 + p.index + delta;
  const month = `${pad(Math.floor(total / 12), 4)}-${pad((total % 12) + 1)}`;
  const last = Number(monthRange(month).to.slice(8));
  return `${month}-${pad(Math.min(Number(iso.slice(8)), last))}`;
}

/** Day a key moves the focus to (WAI-ARIA date grid), or null for keys that do not move it. */
export function moveFocus(
  iso: IsoDate,
  key: string,
  shift = false,
  weekStartsOn: WeekStartDay = 0,
): IsoDate | null {
  const d = parseIsoDate(iso);
  if (!d) return null;
  const offset = (d.getUTCDay() - weekStartsOn + 7) % 7;
  switch (key) {
    case 'ArrowLeft':
      return addDays(iso, -1);
    case 'ArrowRight':
      return addDays(iso, 1);
    case 'ArrowUp':
      return addDays(iso, -7);
    case 'ArrowDown':
      return addDays(iso, 7);
    case 'Home':
      return addDays(iso, -offset);
    case 'End':
      return addDays(iso, 6 - offset);
    case 'PageUp':
      return shiftMonths(iso, shift ? -12 : -1);
    case 'PageDown':
      return shiftMonths(iso, shift ? 12 : 1);
    default:
      return null;
  }
}

export function clampDate(iso: IsoDate, min?: IsoDate, max?: IsoDate): IsoDate {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/** "October 2026". */
export function monthTitle(month: IsoMonth): string {
  const p = parseMonth(month);
  return p ? `${MONTH_NAMES[p.index]} ${p.year}` : month;
}

/** "Tuesday, October 20, 2026" for a day button's accessible name. */
export function dayLabel(iso: IsoDate): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return `${DAY_NAMES[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export { formatIsoDate };
