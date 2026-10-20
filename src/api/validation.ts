import { isValidMonth, parseIsoDate } from '../lib/dates';
import type {
  CreateReservationRequest,
  EarlyLateRequest,
  MoveDatesRequest,
  MoveGuard,
  MoveRoomRequest,
  QuickStatsQuery,
  ScheduleQuery,
} from './types';
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

function assertRequestId(requestId: unknown): void {
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

export const MAX_PARTY = 20;
export const MAX_NOTES_LENGTH = 2000;

export function assertCreateReservationRequest(request: CreateReservationRequest): void {
  assertRequestId(request.requestId);
  assertResourceId(request.roomId, 'room');
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
    !text(request.publicNotes) ||
    !text(request.privateNotes)
  ) {
    throw invalidQuery('reservation');
  }
}
