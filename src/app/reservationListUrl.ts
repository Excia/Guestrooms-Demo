// The Reservation List's view in the URL (ticket 3.1): reload, Back and shared links work.
// Parsing is tolerant: anything unknown or malformed falls back to the default for that field.
import {
  LIST_STATUSES,
  type ListStatus,
  type ReservationListQuery,
  type ReservationListSort,
  type ReservationListSortField,
} from '../api';
import { isValidIsoDate, type IsoDate } from '../lib/dates';
import { DEFAULT_ROWS_PER_PAGE_OPTIONS } from './pagination';
import { defaultCheckInRange } from './reservationList';

export type TextFilterKey = 'guest' | 'reserver' | 'resNumber' | 'block' | 'room';
export const TEXT_FILTER_KEYS: readonly TextFilterKey[] = [
  'guest',
  'reserver',
  'resNumber',
  'block',
  'room',
];

export interface ReservationListView {
  /** '' means no bound (the user cleared the date). */
  checkInFrom: IsoDate | '';
  checkInTo: IsoDate | '';
  unassignedOnly: boolean;
  /** Empty: all locations. */
  locationIds: string[];
  roomTypeIds: string[];
  statuses: ListStatus[];
  text: Record<TextFilterKey, string>;
  /** The header search button. */
  search: string;
  sort: ReservationListSort;
  page: number;
  rowsPerPage: number;
}

export const DEFAULT_LIST_SORT: ReservationListSort = { field: 'arrival', direction: 'asc' };
export const DEFAULT_LIST_ROWS = 25;

const SORT_FIELDS: readonly ReservationListSortField[] = [
  'arrival',
  'departure',
  'confirmationNumber',
  'guestName',
  'reserverName',
  'blockName',
  'locationName',
  'roomTypeName',
  'roomNumber',
  'status',
];

const KEYS = {
  from: 'from',
  to: 'to',
  unassigned: 'unassigned',
  locations: 'locations',
  types: 'types',
  status: 'status',
  search: 'q',
  sort: 'sort',
  page: 'page',
  rows: 'rows',
} as const;

const list = (value: string | null): string[] => [
  ...new Set(
    (value ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  ),
];

function parseSort(value: string | null): ReservationListSort {
  const [field, direction] = (value ?? '').split(':');
  return SORT_FIELDS.includes(field as ReservationListSortField) &&
    (direction === 'asc' || direction === 'desc')
    ? { field: field as ReservationListSortField, direction }
    : DEFAULT_LIST_SORT;
}

const positiveInt = (value: string | null, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
};

/** `today` resolves the default date range: absent dates mean the default, empty ones mean none. */
export function parseReservationListView(
  source: string | URLSearchParams,
  today: IsoDate,
): ReservationListView {
  const params = typeof source === 'string' ? new URLSearchParams(source) : source;
  const range = defaultCheckInRange(today);
  const date = (key: string, fallback: IsoDate): IsoDate | '' => {
    const v = params.get(key);
    if (v === null) return fallback;
    return v !== '' && isValidIsoDate(v) ? v : v === '' ? '' : fallback;
  };
  const rows = positiveInt(params.get(KEYS.rows), DEFAULT_LIST_ROWS);
  return {
    checkInFrom: date(KEYS.from, range.from),
    checkInTo: date(KEYS.to, range.to),
    unassignedOnly: params.get(KEYS.unassigned) === '1',
    locationIds: list(params.get(KEYS.locations)),
    roomTypeIds: list(params.get(KEYS.types)),
    statuses: list(params.get(KEYS.status)).filter((s): s is ListStatus =>
      (LIST_STATUSES as readonly string[]).includes(s),
    ),
    text: Object.fromEntries(
      TEXT_FILTER_KEYS.map((k) => [k, (params.get(k) ?? '').slice(0, 200)]),
    ) as Record<TextFilterKey, string>,
    search: (params.get(KEYS.search) ?? '').slice(0, 200),
    sort: parseSort(params.get(KEYS.sort)),
    page: positiveInt(params.get(KEYS.page), 1),
    rowsPerPage: (DEFAULT_ROWS_PER_PAGE_OPTIONS as readonly number[]).includes(rows)
      ? rows
      : DEFAULT_LIST_ROWS,
  };
}

/** `params` with the list's fields replaced; other parameters (e.g. ?mock=) are kept. Defaults are omitted. */
export function applyReservationListView(
  params: URLSearchParams,
  view: ReservationListView,
  today: IsoDate,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null) => {
    if (value === null || value === undefined) next.delete(key);
    else next.set(key, value);
  };
  const range = defaultCheckInRange(today);
  set(KEYS.from, view.checkInFrom === range.from ? null : view.checkInFrom);
  set(KEYS.to, view.checkInTo === range.to ? null : view.checkInTo);
  set(KEYS.unassigned, view.unassignedOnly ? '1' : null);
  set(KEYS.locations, view.locationIds.length ? view.locationIds.join(',') : null);
  set(KEYS.types, view.roomTypeIds.length ? view.roomTypeIds.join(',') : null);
  set(KEYS.status, view.statuses.length ? view.statuses.join(',') : null);
  for (const k of TEXT_FILTER_KEYS) set(k, view.text[k] ? view.text[k] : null);
  set(KEYS.search, view.search ? view.search : null);
  const isDefaultSort =
    view.sort.field === DEFAULT_LIST_SORT.field &&
    view.sort.direction === DEFAULT_LIST_SORT.direction;
  set(KEYS.sort, isDefaultSort ? null : `${view.sort.field}:${view.sort.direction}`);
  set(KEYS.page, view.page > 1 ? String(view.page) : null);
  set(KEYS.rows, view.rowsPerPage === DEFAULT_LIST_ROWS ? null : String(view.rowsPerPage));
  return next;
}

/** The API query for a view; empty filters are left out. */
export function toListQuery(view: ReservationListView): ReservationListQuery {
  const text = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    checkInFrom: view.checkInFrom || undefined,
    checkInTo: view.checkInTo || undefined,
    unassignedOnly: view.unassignedOnly || undefined,
    locationIds: view.locationIds.length ? view.locationIds : undefined,
    roomTypeIds: view.roomTypeIds.length ? view.roomTypeIds : undefined,
    statuses: view.statuses.length ? view.statuses : undefined,
    guest: text(view.text.guest),
    reserver: text(view.text.reserver),
    resNumber: text(view.text.resNumber),
    block: text(view.text.block),
    room: text(view.text.room),
    search: text(view.search),
    sort: view.sort,
    page: view.page,
    limit: view.rowsPerPage,
  };
}

/** True when any filter narrows the list beyond the default view (for "Clear filters"). */
export function hasActiveFilters(view: ReservationListView, today: IsoDate): boolean {
  const range = defaultCheckInRange(today);
  return (
    view.checkInFrom !== range.from ||
    view.checkInTo !== range.to ||
    view.unassignedOnly ||
    view.locationIds.length > 0 ||
    view.roomTypeIds.length > 0 ||
    view.statuses.length > 0 ||
    view.search !== '' ||
    TEXT_FILTER_KEYS.some((k) => view.text[k] !== '')
  );
}

/** The next sort when a column header is clicked: same column flips direction, a new one starts ascending. */
export function nextSort(
  current: ReservationListSort,
  field: ReservationListSortField,
): ReservationListSort {
  return current.field === field
    ? { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { field, direction: 'asc' };
}

/** Back to the default filters (date range, nothing else); sort and rows per page are kept. */
export function clearFilters(view: ReservationListView, today: IsoDate): ReservationListView {
  const range = defaultCheckInRange(today);
  return {
    ...view,
    checkInFrom: range.from,
    checkInTo: range.to,
    unassignedOnly: false,
    locationIds: [],
    roomTypeIds: [],
    statuses: [],
    text: { guest: '', reserver: '', resNumber: '', block: '', room: '' },
    search: '',
    page: 1,
  };
}
