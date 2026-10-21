// Wire mapping of the Reservation List endpoints (ticket 3.1): query to URL parameters and light
// shape guards on the answers, like the rest of http.ts.
import { LIST_STATUSES } from './reservationListTypes';
import type {
  CheckInRoomResult,
  ReservationListOptions,
  ReservationListQuery,
  ReservationListRow,
} from './reservationListTypes';
import type { Page } from './types';
import { ApiError } from './types';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const nullableString = (v: unknown) => v === null || isString(v);
const listOf = (v: unknown, guard: (x: unknown) => boolean) => Array.isArray(v) && v.every(guard);
const isStatus = (v: unknown) => isString(v) && (LIST_STATUSES as readonly string[]).includes(v);

const invalid = (status: number, what: string) =>
  new ApiError(status, `Malformed ${what} response`, { code: 'invalid-response' });

/** Lists are comma-separated; empty and unset values are left out by the caller's `request`. */
export function listParams(q: ReservationListQuery): Record<string, string | undefined> {
  const join = (v: readonly string[] | undefined) => (v?.length ? v.join(',') : undefined);
  return {
    checkInFrom: q.checkInFrom,
    checkInTo: q.checkInTo,
    unassignedOnly: q.unassignedOnly ? 'true' : undefined,
    locationIds: join(q.locationIds),
    roomTypeIds: join(q.roomTypeIds),
    statuses: join(q.statuses),
    guest: q.guest?.trim(),
    reserver: q.reserver?.trim(),
    resNumber: q.resNumber?.trim(),
    block: q.block?.trim(),
    room: q.room?.trim(),
    search: q.search?.trim(),
    sort: q.sort && `${q.sort.field}:${q.sort.direction}`,
    page: q.page === undefined ? undefined : String(q.page),
    limit: q.limit === undefined ? undefined : String(q.limit),
  };
}

function isRow(v: unknown): v is ReservationListRow {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.confirmationNumber) &&
    isString(v.arrival) &&
    isString(v.departure) &&
    isString(v.guestName) &&
    nullableString(v.reserverName) &&
    nullableString(v.blockName) &&
    nullableString(v.locationId) &&
    nullableString(v.locationName) &&
    nullableString(v.roomTypeId) &&
    nullableString(v.roomTypeName) &&
    isStatus(v.status) &&
    Array.isArray(v.rooms) &&
    v.rooms.length >= 1 &&
    listOf(
      v.rooms,
      (r) => isObject(r) && isString(r.id) && nullableString(r.roomNumber) && isStatus(r.status),
    )
  );
}

export function parseListPage(body: unknown, status: number): Page<ReservationListRow> {
  if (
    !isObject(body) ||
    !listOf(body.items, isRow) ||
    typeof body.total !== 'number' ||
    !Number.isFinite(body.total)
  ) {
    throw invalid(status, 'reservation list');
  }
  return body as unknown as Page<ReservationListRow>;
}

export function parseListOptions(body: unknown, status: number): ReservationListOptions {
  const named = (x: unknown) => isObject(x) && isString(x.id) && isString(x.name);
  if (!isObject(body) || !listOf(body.locations, named) || !listOf(body.roomTypes, named)) {
    throw invalid(status, 'reservation list options');
  }
  return body as unknown as ReservationListOptions;
}

/** The answer names the room it checked in, and says it is checked in. */
export const parseCheckIn =
  (reservationRoomId: string) =>
  (body: unknown, status: number): CheckInRoomResult => {
    if (
      !isObject(body) ||
      body.reservationRoomId !== reservationRoomId ||
      body.status !== 'checked-in'
    ) {
      throw invalid(status, 'check-in');
    }
    return { reservationRoomId, status: 'checked-in' };
  };
