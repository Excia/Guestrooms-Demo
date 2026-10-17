import type { Page, Reservation, ReservationQuery, ReservationSort } from './types';
import { ApiError } from './types';

const DEFAULT_SORT: ReservationSort = { field: 'arrival', direction: 'asc' };

// Code-unit comparison: deterministic regardless of the runtime's locale.
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function compare(a: Reservation, b: Reservation, { field, direction }: ReservationSort): number {
  const result = cmp(a[field], b[field]) || cmp(a.id, b.id);
  return direction === 'desc' ? -result || 0 : result;
}

/**
 * Filter, sort and page reservations the way the backend is expected to. Cursors are opaque to
 * callers; here they encode an offset. Date bounds are inclusive ISO dates.
 */
export function queryReservations(
  all: readonly Reservation[],
  query: ReservationQuery = {},
  defaultLimit = 20,
  maxLimit = 100,
): Page<Reservation> {
  const needle = query.search?.trim().toLowerCase();
  const matches = all
    .filter(
      (r) =>
        (!query.status || r.status === query.status) &&
        (!needle ||
          r.guestName.toLowerCase().includes(needle) ||
          r.confirmationNumber.toLowerCase().includes(needle)) &&
        (!query.arrivalFrom || r.arrival >= query.arrivalFrom) &&
        (!query.arrivalTo || r.arrival <= query.arrivalTo) &&
        (!query.departureFrom || r.departure >= query.departureFrom) &&
        (!query.departureTo || r.departure <= query.departureTo),
    )
    .sort((a, b) => compare(a, b, query.sort ?? DEFAULT_SORT));

  const offset = query.cursor === undefined ? 0 : Number(query.cursor);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ApiError(400, 'Invalid cursor', { code: 'invalid-cursor' });
  }
  const limit = Math.min(
    Math.max(Math.floor(query.limit ?? defaultLimit) || defaultLimit, 1),
    maxLimit,
  );
  const end = offset + limit;
  return {
    items: matches.slice(offset, end).map((r) => ({ ...r })),
    total: matches.length,
    ...(end < matches.length ? { nextCursor: String(end) } : {}),
  };
}
