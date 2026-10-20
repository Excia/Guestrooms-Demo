import { isValidMonth, parseIsoDate } from '../lib/dates';
import type { MoveDatesRequest, MoveRoomRequest, QuickStatsQuery, ScheduleQuery } from './types';
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

const AVAILABILITIES: readonly unknown[] = ['all', 'available', 'booked'];

const invalidQuery = (what: string) =>
  new ApiError(400, `Invalid ${what}`, { code: 'invalid-query' });

/** Filter ids travel as a comma-separated query value: non-empty lists of non-empty, comma-free ids. */
const validIdList = (ids: unknown) =>
  ids === undefined ||
  (Array.isArray(ids) &&
    ids.length > 0 &&
    ids.every((id) => typeof id === 'string' && id.trim() !== '' && !id.includes(',')));

export function assertScheduleQuery(query: ScheduleQuery): void {
  const ok =
    parseIsoDate(query.startDate) !== null &&
    SCHEDULE_DAYS.includes(query.days) &&
    validIdList(query.locationIds) &&
    validIdList(query.roomTypeIds) &&
    (query.availability === undefined || AVAILABILITIES.includes(query.availability));
  if (!ok) throw invalidQuery('schedule query');
}

export function assertMoveRoomRequest(request: MoveRoomRequest): void {
  assertResourceId(request.reservationRoomId, 'reservation room');
  assertResourceId(request.toRoomId, 'room');
}

export function assertMoveDatesRequest(request: MoveDatesRequest): void {
  assertResourceId(request.reservationRoomId, 'reservation room');
  if (request.toRoomId !== undefined) assertResourceId(request.toRoomId, 'room');
  if (
    parseIsoDate(request.toStartDate) === null ||
    (request.scope !== 'all-rooms' && request.scope !== 'this-room')
  ) {
    throw invalidQuery('move dates request');
  }
}
