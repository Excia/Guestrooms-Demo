import type { MockScenario } from './config';
import {
  emptyStats,
  fullGrant,
  MOCK_BOOKING_HOLD,
  MOCK_TODAY,
  mockReservations,
  mockStats,
  noGrant,
} from './mockData';
import { buildDetail, createReservation, setEarlyLate } from './reservationDetailData';
import { buildQuickStats, emptyQuickStats } from './quickStatsData';
import { queryReservations } from './reservationQuery';
import { createScheduleState, moveDates, moveRoom } from './scheduleData';
import type { ScheduleSize } from './scheduleData';
import { queryScheduleData } from './scheduleQuery';
import type { ApiClient, IsoDate, PermissionGrant, RequestOptions } from './types';
import { ApiError } from './types';
import {
  assertCreateReservationRequest,
  assertEarlyLateRequest,
  assertMoveDatesRequest,
  assertMoveRoomRequest,
  assertQuickStatsQuery,
  assertResourceId,
  assertScheduleQuery,
} from './validation';

export interface MockOptions {
  scenario?: MockScenario;
  /** Simulated network delay in ms. Tests pass 0. */
  latencyMs?: number;
  /** Default reservations page size; small so paging is exercisable with the sample data. */
  pageSize?: number;
  /** What `permissions.getGrant` returns in the normal scenario; defaults to an unrestricted user. */
  grant?: PermissionGrant;
  /** The schedule's "today": data is laid out around it and arrivals before it are the past. */
  today?: IsoDate;
  /** Schedule inventory: `default` (about 30 rooms) or `large` (200 rooms, for performance). */
  scheduleSize?: ScheduleSize;
}

export const MOCK_PAGE_SIZE = 4;

const abortError = () => new DOMException('The operation was aborted.', 'AbortError');

/**
 * In-memory ApiClient. Scenarios: "normal" data, "empty" data, "error" (every call rejects with
 * a 500) and "loading" (calls never settle, so the UI stays in its loading state). Every call
 * returns fresh copies and honours `options.signal` like the real client.
 */
export function createMockClient({
  scenario = 'normal',
  latencyMs = 0,
  pageSize = MOCK_PAGE_SIZE,
  grant = fullGrant,
  today = MOCK_TODAY,
  scheduleSize = 'default',
}: MockOptions = {}): ApiClient {
  // Per client: schedule moves mutate it, so every test and every page load starts fresh.
  const schedule = createScheduleState(today, scheduleSize);
  // Idempotency: the first result per `requestId`, replayed for a repeat of the same request.
  const replays = new Map<string, { fingerprint: string; result: unknown }>();
  function replayable<T>(request: { requestId: string }, apply: () => T): T {
    const fingerprint = JSON.stringify({ ...request, requestId: undefined });
    const previous = replays.get(request.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new ApiError(409, 'This request id was already used for a different request', {
          code: 'idempotency-conflict',
        });
      }
      return structuredClone(previous.result) as T;
    }
    const result = apply();
    replays.set(request.requestId, { fingerprint, result: structuredClone(result) });
    return result;
  }

  function respond<T>(normal: () => T, empty: () => T, options?: RequestOptions): Promise<T> {
    const signal = options?.signal;
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      function onAbort() {
        clearTimeout(timer);
        reject(abortError());
      }
      signal?.addEventListener('abort', onAbort, { once: true });
      // "loading" never settles, except by abort.
      const timer =
        scenario === 'loading'
          ? undefined
          : setTimeout(() => {
              signal?.removeEventListener('abort', onAbort);
              try {
                if (scenario === 'error') throw new ApiError(500, 'Mock server error');
                resolve(scenario === 'empty' ? empty() : normal());
              } catch (error) {
                reject(error);
              }
            }, latencyMs);
    });
  }

  const notFound = () => new ApiError(404, 'Reservation not found');

  return {
    dashboard: {
      getStats: (o) =>
        respond(
          () => structuredClone(mockStats),
          () => structuredClone(emptyStats),
          o,
        ),
      getQuickStats: (query, o) =>
        respond(
          () => {
            assertQuickStatsQuery(query);
            return buildQuickStats(query);
          },
          () => {
            assertQuickStatsQuery(query);
            return emptyQuickStats(query);
          },
          o,
        ),
    },
    reservations: {
      list: (query, o) =>
        respond(
          () => queryReservations(mockReservations, query, pageSize),
          () => ({ items: [], total: 0 }),
          o,
        ),
      get: (id, o) =>
        respond(
          () => {
            assertResourceId(id, 'reservation');
            const found = mockReservations.find((r) => r.id === id);
            if (!found) throw notFound();
            return structuredClone(found);
          },
          () => {
            throw notFound();
          },
          o,
        ),
      getDetail: (id, o) =>
        respond(
          () => {
            assertResourceId(id, 'reservation');
            return buildDetail(schedule, id);
          },
          () => {
            throw notFound();
          },
          o,
        ),
      setEarlyLate: (request, o) =>
        respond(
          () => {
            assertEarlyLateRequest(request);
            return replayable(request, () => setEarlyLate(schedule, request));
          },
          () => {
            assertEarlyLateRequest(request);
            throw notFound();
          },
          o,
        ),
      create: (request, o) =>
        respond(
          () => {
            assertCreateReservationRequest(request);
            return replayable(request, () => createReservation(schedule, request));
          },
          () => {
            assertCreateReservationRequest(request);
            throw new ApiError(404, 'Room not found');
          },
          o,
        ),
    },
    schedule: {
      get: (query, o) =>
        respond(
          () => {
            assertScheduleQuery(query);
            return structuredClone(queryScheduleData(schedule, query));
          },
          () => {
            assertScheduleQuery(query);
            return {
              startDate: query.startDate,
              days: query.days,
              locations: [],
              roomTypes: [],
              rooms: [],
              blocks: [],
              closures: [],
            };
          },
          o,
        ),
      moveRoom: (request, o) =>
        respond(
          () => {
            assertMoveRoomRequest(request);
            return { blocks: replayable(request, () => moveRoom(schedule, request)) };
          },
          () => {
            assertMoveRoomRequest(request);
            throw new ApiError(404, 'Reservation room not found');
          },
          o,
        ),
      moveDates: (request, o) =>
        respond(
          () => {
            assertMoveDatesRequest(request);
            return { blocks: replayable(request, () => moveDates(schedule, request)) };
          },
          () => {
            assertMoveDatesRequest(request);
            throw new ApiError(404, 'Reservation room not found');
          },
          o,
        ),
    },
    settings: {
      getBookingHold: (o) =>
        respond(
          () => ({ ...MOCK_BOOKING_HOLD }),
          () => ({ ...MOCK_BOOKING_HOLD }),
          o,
        ),
    },
    permissions: {
      getGrant: (o) =>
        respond(
          () => structuredClone(grant),
          () => structuredClone(noGrant),
          o,
        ),
    },
  };
}
