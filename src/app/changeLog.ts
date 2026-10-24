// Business rules of the Change Log overlay (ticket 7.10): display formats, one-year retention,
// sort toggling and filter bookkeeping. Pure functions; the overlay and the mock call them.
import {
  CHANGE_LOG_PAGES,
  type ChangeLogPageId,
  type ChangeLogQuery,
  type ChangeLogSort,
  type ChangeLogSortField,
} from '../api/changeLogTypes';

export const DEFAULT_CHANGE_LOG_SORT: ChangeLogSort = { field: 'date', direction: 'desc' };
export const CHANGE_LOG_ROWS_PER_PAGE = 25;
/** "Updates are retained for one year on admin setup screens." */
export const RETENTION_YEARS = 1;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function parseIso(date: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
    ? { y, m, d }
    : null;
}

/** "2026-10-21" becomes "Wed, 10/21/26" (the ticket's "Day, MM/DD/YY"). Invalid input comes back unchanged. */
export function formatLogDate(date: string): string {
  const p = parseIso(date);
  if (!p) return date;
  const day = WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  const two = (n: number) => String(n).padStart(2, '0');
  return `${day}, ${two(p.m)}/${two(p.d)}/${two(p.y % 100)}`;
}

/** "16:05" becomes "04:05 PM" (the ticket's "HH:MM XM"). Invalid input comes back unchanged. */
export function formatLogTime(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return time;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${match[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** The oldest date still kept: one year before `today` (29 Feb falls back to 28 Feb). */
export function retentionCutoff(today: string): string {
  const p = parseIso(today);
  if (!p) return today;
  const year = p.y - RETENTION_YEARS;
  const lastDay = new Date(Date.UTC(year, p.m, 0)).getUTCDate();
  const two = (n: number) => String(n).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${two(p.m)}-${two(Math.min(p.d, lastDay))}`;
}

export const isWithinRetention = (date: string, today: string): boolean =>
  date >= retentionCutoff(today);

export const changeLogPageLabel = (id: ChangeLogPageId): string =>
  CHANGE_LOG_PAGES.find((p) => p.id === id)?.label ?? id;

/** "[Page] Change Log": the overlay title names the page it was opened from. */
export const changeLogTitle = (id: ChangeLogPageId): string =>
  `${changeLogPageLabel(id)} Change Log`;

/** Choosing a column's sort: the same field flips direction; a new field starts ascending (date and time: newest first). */
export function toggleSort(current: ChangeLogSort, field: ChangeLogSortField): ChangeLogSort {
  if (current.field === field) {
    return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { field, direction: field === 'date' || field === 'time' ? 'desc' : 'asc' };
}

/** Value for `aria-sort` on a column header. */
export const ariaSortFor = (
  sort: ChangeLogSort,
  field: ChangeLogSortField,
): 'ascending' | 'descending' | 'none' =>
  sort.field !== field ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending';

export type ChangeLogFilters = Pick<
  ChangeLogQuery,
  'dateFrom' | 'dateTo' | 'timeFrom' | 'timeTo' | 'changeTypes' | 'actionBy' | 'search'
>;

/** Which columns have an active filter (drives the dot on the header icons and the clear button). */
export function activeFilterColumns(f: ChangeLogFilters): Set<ChangeLogSortField | 'search'> {
  const on = new Set<ChangeLogSortField | 'search'>();
  if (f.dateFrom || f.dateTo) on.add('date');
  if (f.timeFrom || f.timeTo) on.add('time');
  if (f.changeTypes?.length) on.add('changeType');
  if (f.actionBy?.trim()) on.add('actionBy');
  if (f.search?.trim()) on.add('search');
  return on;
}

/** A message when the range is back to front, or null. */
export function rangeProblem(
  from: string | undefined,
  to: string | undefined,
  what: 'date' | 'time',
) {
  return from && to && from > to ? `The "to" ${what} must not be before the "from" ${what}.` : null;
}
