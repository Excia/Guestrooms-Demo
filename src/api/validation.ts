import { daysBetween, isValidMonth, parseIsoDate } from '../lib/dates';
import type {
  ChangeRoomRequest,
  CreateMemberRequest,
  CreateReservationRequest,
  EarlyLateRequest,
  MoveDatesRequest,
  MoveGuard,
  MoveRoomRequest,
  PostChargeRequest,
  QuickStatsQuery,
  ScheduleQuery,
} from './types';
import type { CheckInRoomRequest, ReservationListQuery } from './reservationListTypes';
import { LIST_STATUSES } from './reservationListTypes';
import { SCHEDULE_DAYS } from './types';
import { ApiError } from './types';

/** Ids go into URL paths; "." and ".." would escape the resource path even after encoding. */
export function assertResourceId(id: string, what: string): void {
  if (typeof id !== 'string' || id.trim() === '' || id === '.' || id === '..') {
    throw new ApiError(400, `Invalid ${what} id`, { code: 'invalid-id' });
  }
}

/** Quick Stats queries carry dates and months into URLs and the mock: reject anything malformed. */
export function assertQuickStatsQuery(query: QuickStatsQuery): void {
  const ok =
    query.view === 'day'
      ? parseIsoDate(query.date) !== null
      : query.view === 'week'
        ? parseIsoDate(query.startDate) !== null
        : query.view === 'month'
          ? isValidMonth(query.month)
          : false;
  if (!ok) throw new ApiError(400, 'Invalid quick stats query', { code: 'invalid-query' });
}

const invalidQuery = (what: string) =>
  new ApiError(400, `Invalid ${what}`, { code: 'invalid-query' });

export function assertScheduleQuery(query: ScheduleQuery): void {
  if (parseIsoDate(query.startDate) === null || !SCHEDULE_DAYS.includes(query.days)) {
    throw invalidQuery('schedule query');
  }
}

/** Idempotency keys: 8 to 128 URL-safe characters (a UUID fits). */
const REQUEST_ID = /^[A-Za-z0-9_-]{8,128}$/;

export function assertRequestId(requestId: unknown): void {
  if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId)) {
    throw invalidQuery('request id');
  }
}

function assertMoveGuard(request: MoveGuard): void {
  assertRequestId(request.requestId);
  if (
    typeof request.version !== 'string' ||
    request.version === '' ||
    request.version.length > 128
  ) {
    throw invalidQuery('move version');
  }
  assertResourceId(request.fromRoomId, 'room');
}

export function assertMoveRoomRequest(request: MoveRoomRequest): void {
  assertMoveGuard(request);
  assertResourceId(request.reservationRoomId, 'reservation room');
  assertResourceId(request.toRoomId, 'room');
}

export function assertCheckInRoomRequest(request: CheckInRoomRequest): void {
  assertRequestId(request.requestId);
  assertResourceId(request.reservationRoomId, 'reservation room');
}

export function assertMoveDatesRequest(request: MoveDatesRequest): void {
  assertMoveGuard(request);
  assertResourceId(request.reservationRoomId, 'reservation room');
  if (request.toRoomId !== undefined) assertResourceId(request.toRoomId, 'room');
  if (
    parseIsoDate(request.toStartDate) === null ||
    parseIsoDate(request.fromStartDate) === null ||
    (request.scope !== 'all-rooms' && request.scope !== 'this-room')
  ) {
    throw invalidQuery('move dates request');
  }
}

/** A stay has at most this many nights in a plan (the New Reservation limit is 365). */
export const MAX_PLAN_NIGHTS = 400;

export function assertChangeRoomRequest(request: ChangeRoomRequest): void {
  assertMoveGuard(request);
  assertResourceId(request.reservationRoomId, 'reservation room');
  if (
    !Array.isArray(request.nights) ||
    request.nights.length === 0 ||
    request.nights.length > MAX_PLAN_NIGHTS ||
    (request.rateChoice !== null &&
      request.rateChoice !== 'retain' &&
      request.rateChoice !== 'update')
  ) {
    throw invalidQuery('room change request');
  }
  request.nights.forEach((night, i) => {
    if (typeof night !== 'object' || night === null || typeof night.date !== 'string') {
      throw invalidQuery('room change request');
    }
    assertResourceId(night.roomId, 'room');
    // One night per day, in date order: a plan names every remaining night exactly once.
    if (
      parseIsoDate(night.date) === null ||
      (i > 0 && daysBetween(request.nights[i - 1].date, night.date) !== 1)
    ) {
      throw invalidQuery('room change request');
    }
  });
}

export function assertEarlyLateRequest(request: EarlyLateRequest): void {
  assertRequestId(request.requestId);
  assertResourceId(request.reservationId, 'reservation');
  if (
    typeof request.version !== 'string' ||
    request.version === '' ||
    request.version.length > 128
  ) {
    throw invalidQuery('reservation version');
  }
  const flag = (v: unknown) => v === undefined || typeof v === 'boolean';
  if (
    !flag(request.earlyCheckIn) ||
    !flag(request.lateCheckOut) ||
    (request.earlyCheckIn === undefined && request.lateCheckOut === undefined)
  ) {
    throw invalidQuery('early/late request');
  }
}

const shortId = (v: unknown) => typeof v === 'string' && v.trim() !== '' && v.length <= 128;

export const MAX_PARTY = 20;
export const MAX_NOTES_LENGTH = 2000;

export function assertCreateReservationRequest(request: CreateReservationRequest): void {
  assertRequestId(request.requestId);
  if (request.roomId !== undefined && request.roomId !== null) {
    assertResourceId(request.roomId, 'room');
  }
  const count = (n: unknown, min: number) =>
    typeof n === 'number' && Number.isInteger(n) && n >= min && n <= MAX_PARTY;
  const text = (v: unknown) =>
    v === undefined || (typeof v === 'string' && v.length <= MAX_NOTES_LENGTH);
  if (
    parseIsoDate(request.arrival) === null ||
    parseIsoDate(request.departure) === null ||
    request.arrival >= request.departure ||
    !count(request.adults, 1) ||
    !count(request.children, 0) ||
    typeof request.guestName !== 'string' ||
    request.guestName.trim() === '' ||
    request.guestName.length > 200 ||
    (request.bookingGuestRole !== 'occupant' && request.bookingGuestRole !== 'reserver') ||
    (request.bookingGuestId !== undefined && !shortId(request.bookingGuestId)) ||
    (request.leadOccupant !== undefined &&
      (typeof request.leadOccupant.name !== 'string' ||
        request.leadOccupant.name.trim() === '' ||
        request.leadOccupant.name.length > 200 ||
        (request.leadOccupant.memberId !== undefined &&
          !shortId(request.leadOccupant.memberId)))) ||
    !text(request.publicNotes) ||
    !text(request.privateNotes)
  ) {
    throw invalidQuery('reservation');
  }
}

export const MAX_NAME_LENGTH = 200;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (v: string) => EMAIL.test(v);

export function assertCreateMemberRequest(request: CreateMemberRequest): void {
  assertRequestId(request.requestId);
  const optional = (v: unknown, max: number) =>
    v === undefined || (typeof v === 'string' && v.length <= max);
  if (
    typeof request.name !== 'string' ||
    request.name.trim() === '' ||
    request.name.length > MAX_NAME_LENGTH ||
    !optional(request.email, 200) ||
    (request.email !== undefined && request.email !== '' && !isEmail(request.email)) ||
    !optional(request.phone, 40)
  ) {
    throw invalidQuery('member');
  }
}

export function assertMemberQuery(query: { q?: string; limit?: number }): void {
  if (
    (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 200)) ||
    (query.limit !== undefined &&
      (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 50))
  ) {
    throw invalidQuery('member query');
  }
}

const LIST_SORT_FIELDS = [
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
export const MAX_LIST_FILTER_LENGTH = 200;

/** The Reservation List query reaches the mock and the URL of the real API: reject anything malformed. */
export function assertReservationListQuery(query: ReservationListQuery): void {
  const date = (v: unknown) =>
    v === undefined || (typeof v === 'string' && parseIsoDate(v) !== null);
  const text = (v: unknown) =>
    v === undefined || (typeof v === 'string' && v.length <= MAX_LIST_FILTER_LENGTH);
  const ids = (v: unknown) =>
    v === undefined || (Array.isArray(v) && v.length <= 100 && v.every(shortId));
  if (
    !date(query.checkInFrom) ||
    !date(query.checkInTo) ||
    (query.unassignedOnly !== undefined && typeof query.unassignedOnly !== 'boolean') ||
    !ids(query.locationIds) ||
    !ids(query.roomTypeIds) ||
    (query.statuses !== undefined &&
      !(Array.isArray(query.statuses) && query.statuses.every((s) => LIST_STATUSES.includes(s)))) ||
    !text(query.guest) ||
    !text(query.reserver) ||
    !text(query.resNumber) ||
    !text(query.block) ||
    !text(query.room) ||
    !text(query.search) ||
    (query.sort !== undefined &&
      (!LIST_SORT_FIELDS.includes(query.sort.field) ||
        (query.sort.direction !== 'asc' && query.sort.direction !== 'desc'))) ||
    (query.page !== undefined && (!Number.isInteger(query.page) || query.page < 1)) ||
    (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1))
  ) {
    throw invalidQuery('reservation list query');
  }
}

export function assertPostChargeRequest(request: PostChargeRequest): void {
  assertRequestId(request.requestId);
  assertResourceId(request.reservationId, 'reservation');
  assertResourceId(request.chargeId, 'charge');
}
