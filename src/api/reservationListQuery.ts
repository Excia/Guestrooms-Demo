// Pure filter, sort and paging of list rows, as the backend is expected to answer (ticket 3.1).
import { hasUnassignedRoom } from './reservationListRules';
import type {
  ReservationListQuery,
  ReservationListRow,
  ReservationListSort,
  ReservationListSortField,
} from './reservationListTypes';
import type { Page } from './types';

const DEFAULT_SORT: ReservationListSort = { field: 'arrival', direction: 'asc' };

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const STATUS_ORDER = { 'not-checked-in': 0, 'checked-in': 1, 'checked-out': 2, canceled: 3 };

/** Unassigned sorts before every room number; rows without a value sort first ascending. */
function sortKey(row: ReservationListRow, field: ReservationListSortField): string {
  switch (field) {
    case 'roomNumber':
      return (row.rooms[0]?.roomNumber ?? '').toLowerCase();
    case 'status':
      return String(STATUS_ORDER[row.status]);
    case 'arrival':
    case 'departure':
    case 'confirmationNumber':
      return row[field];
    default:
      return (row[field] ?? '').toLowerCase();
  }
}

const contains = (value: string | null | undefined, needle: string | undefined) => {
  const n = needle?.trim().toLowerCase();
  return !n || (value ?? '').toLowerCase().includes(n);
};

export function filterListRows(
  all: readonly ReservationListRow[],
  query: ReservationListQuery,
): ReservationListRow[] {
  return all.filter(
    (r) =>
      (!query.checkInFrom || r.arrival >= query.checkInFrom) &&
      (!query.checkInTo || r.arrival <= query.checkInTo) &&
      (!query.unassignedOnly || hasUnassignedRoom(r.rooms)) &&
      (!query.locationIds?.length || query.locationIds.includes(r.locationId ?? '')) &&
      (!query.roomTypeIds?.length || query.roomTypeIds.includes(r.roomTypeId ?? '')) &&
      (!query.statuses?.length || query.statuses.includes(r.status)) &&
      contains(r.guestName, query.guest) &&
      contains(r.reserverName, query.reserver) &&
      contains(r.confirmationNumber, query.resNumber) &&
      contains(r.blockName, query.block) &&
      (!query.room?.trim() ||
        r.rooms.some((x) => contains(x.roomNumber ?? 'unassigned', query.room))) &&
      (!query.search?.trim() ||
        [r.guestName, r.reserverName, r.confirmationNumber, r.blockName].some((v) =>
          contains(v, query.search),
        )),
  );
}

export function queryReservationList(
  all: readonly ReservationListRow[],
  query: ReservationListQuery = {},
  defaultLimit = 25,
  maxLimit = 100,
): Page<ReservationListRow> {
  const { field, direction } = query.sort ?? DEFAULT_SORT;
  const matches = filterListRows(all, query).sort((a, b) => {
    const result = cmp(sortKey(a, field), sortKey(b, field)) || cmp(a.id, b.id);
    return direction === 'desc' ? -result || 0 : result;
  });
  const limit = Math.min(
    Math.max(Math.floor(query.limit ?? defaultLimit) || defaultLimit, 1),
    maxLimit,
  );
  const page = Math.max(1, Math.floor(query.page ?? 1) || 1);
  const start = (page - 1) * limit;
  return {
    items: matches.slice(start, start + limit).map((r) => structuredClone(r)),
    total: matches.length,
  };
}
