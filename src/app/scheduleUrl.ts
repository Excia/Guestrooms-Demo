// The schedule's view state in the URL query string, so reload, Back and shared links work.
// Parsing is tolerant: anything unknown or malformed falls back to the default for that field.
import { isValidIsoDate, type IsoDate } from '../lib/dates';
import type { ScheduleAvailability, ScheduleDays, SettableHousekeepingStatus } from '../api/types';
import { DEFAULT_SCHEDULE_DAYS, HOUSEKEEPING_FILTER_OPTIONS, parseScheduleDays } from './schedule';

export interface ScheduleViewState {
  /** First column's date; null means "today" (so a bookmark of the plain page keeps following it). */
  start: IsoDate | null;
  days: ScheduleDays;
  /** null: every location. [] ("Select None"): none. */
  locationIds: string[] | null;
  roomTypeIds: string[] | null;
  availability: ScheduleAvailability;
  /** Housekeeping statuses to keep; [] (the default) is no filter, as in the legacy menu. */
  housekeeping: SettableHousekeepingStatus[];
  /** Room features a room must all have; [] (the default) is no filter. */
  featureIds: string[];
}

export const DEFAULT_SCHEDULE_VIEW: ScheduleViewState = {
  start: null,
  days: DEFAULT_SCHEDULE_DAYS,
  locationIds: null,
  roomTypeIds: null,
  availability: 'all',
  housekeeping: [],
  featureIds: [],
};

const PARAMS = {
  start: 'start',
  days: 'view',
  locations: 'locations',
  types: 'types',
  rooms: 'rooms',
  housekeeping: 'housekeeping',
  features: 'features',
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

/** Unlike the Locations list, absent, empty and noise all mean "no filter" (the legacy default). */
const parseOptIn = (value: string | null): string[] => parseList(value) ?? [];

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
    housekeeping: HOUSEKEEPING_FILTER_OPTIONS.map((o) => o.id).filter((id) =>
      parseOptIn(params.get(PARAMS.housekeeping)).includes(id),
    ),
    featureIds: parseOptIn(params.get(PARAMS.features)),
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
  set(PARAMS.housekeeping, state.housekeeping.length > 0 ? state.housekeeping.join(',') : null);
  set(PARAMS.features, state.featureIds.length > 0 ? state.featureIds.join(',') : null);
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

/**
 * Number of applied filters, for the filter button. `hasLocationFilter` false (a club with one
 * location, where the group is hidden) leaves the location list out of the count.
 */
export function activeFilterCount(state: ScheduleViewState, hasLocationFilter = true): number {
  return (
    (hasLocationFilter && state.locationIds ? 1 : 0) +
    (state.roomTypeIds ? 1 : 0) +
    (state.availability !== 'all' ? 1 : 0) +
    (state.housekeeping.length > 0 ? 1 : 0) +
    (state.featureIds.length > 0 ? 1 : 0)
  );
}
