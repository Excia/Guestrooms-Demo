// The schedule's view state in the URL query string, so reload, Back and shared links work.
// Parsing is tolerant: anything unknown or malformed falls back to the default for that field.
import { isValidIsoDate, type IsoDate } from '../lib/dates';
import type { ScheduleAvailability, ScheduleDays } from '../api/types';
import { DEFAULT_SCHEDULE_DAYS, parseScheduleDays } from './schedule';

export interface ScheduleViewState {
  /** First column's date; null means "today" (so a bookmark of the plain page keeps following it). */
  start: IsoDate | null;
  days: ScheduleDays;
  /** null: every location. [] ("Select None"): none. */
  locationIds: string[] | null;
  roomTypeIds: string[] | null;
  availability: ScheduleAvailability;
}

export const DEFAULT_SCHEDULE_VIEW: ScheduleViewState = {
  start: null,
  days: DEFAULT_SCHEDULE_DAYS,
  locationIds: null,
  roomTypeIds: null,
  availability: 'all',
};

const PARAMS = {
  start: 'start',
  days: 'view',
  locations: 'locations',
  types: 'types',
  rooms: 'rooms',
};
const AVAILABILITY: readonly ScheduleAvailability[] = ['all', 'available', 'booked'];

/**
 * Absent: all. Present but empty (`?types=`): none. Only separators or blanks (`?types=,,`) is
 * noise, not a choice: all. Duplicates and blanks are dropped.
 */
function parseList(value: string | null): string[] | null {
  if (value === null) return null;
  if (value === '') return [];
  const ids = [
    ...new Set(
      value
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
  return ids.length > 0 ? ids : null;
}

export function parseScheduleView(source: string | URLSearchParams): ScheduleViewState {
  const params = typeof source === 'string' ? new URLSearchParams(source) : source;
  const start = params.get(PARAMS.start);
  const rooms = params.get(PARAMS.rooms);
  return {
    start: start && isValidIsoDate(start) ? start : null,
    days: parseScheduleDays(params.get(PARAMS.days)),
    locationIds: parseList(params.get(PARAMS.locations)),
    roomTypeIds: parseList(params.get(PARAMS.types)),
    availability: AVAILABILITY.find((a) => a === rooms) ?? 'all',
  };
}

/** `params` with the schedule's fields replaced; other parameters (e.g. ?mock=) are kept. Defaults are omitted. */
export function applyScheduleView(
  params: URLSearchParams,
  state: ScheduleViewState,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null) => {
    if (value === null) next.delete(key);
    else next.set(key, value);
  };
  set(PARAMS.start, state.start);
  set(PARAMS.days, state.days === DEFAULT_SCHEDULE_DAYS ? null : String(state.days));
  set(PARAMS.locations, state.locationIds && state.locationIds.join(','));
  set(PARAMS.types, state.roomTypeIds && state.roomTypeIds.join(','));
  set(PARAMS.rooms, state.availability === 'all' ? null : state.availability);
  return next;
}

/** Checkbox toggle of one id in a filter list (null = all selected). Selecting everything gives null. */
export function toggleFilterId(
  current: readonly string[] | null,
  allIds: readonly string[],
  id: string,
): string[] | null {
  const base = current ?? allIds;
  const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
  return next.length >= allIds.length && allIds.every((x) => next.includes(x)) ? null : next;
}

/** Number of narrowed filters, for the filter button's badge. */
export function activeFilterCount(state: ScheduleViewState): number {
  return (
    (state.locationIds ? 1 : 0) +
    (state.roomTypeIds ? 1 : 0) +
    (state.availability !== 'all' ? 1 : 0)
  );
}
