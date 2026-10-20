import type {
  ApiClient,
  DashboardStats,
  Page,
  PermissionGrant,
  QuickStats,
  QuickStatsQuery,
  Reservation,
  ReservationQuery,
  RequestOptions,
  MoveDatesRequest,
  MoveRoomRequest,
  ScheduleBlock,
  ScheduleData,
  ScheduleMoveResult,
  ScheduleQuery,
} from './types';
import { ApiError } from './types';
import {
  assertMoveDatesRequest,
  assertMoveRoomRequest,
  assertQuickStatsQuery,
  assertResourceId,
  assertScheduleQuery,
} from './validation';

export interface HttpClientOptions {
  fetch?: typeof fetch;
  /** Fetch credentials mode. Default "same-origin"; "include" for a cross-origin cookie API. */
  credentials?: RequestCredentials;
  /** Per-request timeout. Default 15 s. */
  timeoutMs?: number;
  /** Called on any 401, before the ApiError is thrown (e.g. to start a sign-in redirect). */
  onUnauthorized?: () => void;
  /** Extra headers for every request (e.g. an auth token). */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

function invalid(status: number, what: string): ApiError {
  return new ApiError(status, `Malformed ${what} response`, { code: 'invalid-response' });
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const STATUSES: readonly string[] = [
  'pending',
  'confirmed',
  'checked-in',
  'checked-out',
  'cancelled',
];

// These are light shape guards on the fields consumers rely on, not full schema validation.
function isReservation(v: unknown): v is Reservation {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.confirmationNumber) &&
    isString(v.guestName) &&
    isString(v.arrival) &&
    isString(v.departure) &&
    isString(v.status) &&
    STATUSES.includes(v.status)
  );
}

function parseGrant(body: unknown, status: number): PermissionGrant {
  if (
    !isObject(body) ||
    !isString(body.role) ||
    !(
      body.permissions === 'all' ||
      (Array.isArray(body.permissions) && body.permissions.every(isString))
    )
  ) {
    throw invalid(status, 'permissions');
  }
  return body as unknown as PermissionGrant;
}

function parsePage(body: unknown, status: number): Page<Reservation> {
  if (
    !isObject(body) ||
    !Array.isArray(body.items) ||
    !body.items.every(isReservation) ||
    !isCount(body.total) ||
    !(body.nextCursor === undefined || isString(body.nextCursor))
  ) {
    throw invalid(status, 'reservations');
  }
  return body as unknown as Page<Reservation>;
}

function parseReservation(body: unknown, status: number): Reservation {
  if (!isReservation(body)) throw invalid(status, 'reservation');
  return body;
}

const STAT_COUNTS = [
  'arrivalsToday',
  'departuresToday',
  'inHouse',
  'occupancyPercent',
  'unassignedChargesCount',
  'totalRevenue',
  'totalNights',
  'averageRate',
] as const;

function parseStats(body: unknown, status: number): DashboardStats {
  const listOk = (v: unknown) => Array.isArray(v) && v.every((x) => isObject(x) && isString(x.id));
  if (
    !isObject(body) ||
    !STAT_COUNTS.every((k) => isCount(body[k])) ||
    !listOk(body.rateCategories) ||
    !listOk(body.roomBlocks)
  ) {
    throw invalid(status, 'dashboard stats');
  }
  return body as unknown as DashboardStats;
}

const isCounts = (v: unknown) =>
  isObject(v) && isCount(v.booked) && isCount(v.available) && isCount(v.percent);
const listOf = (v: unknown, guard: (x: unknown) => boolean) => Array.isArray(v) && v.every(guard);

// Light shape guards, like the others: the fields the panel reads.
// The answer must be for the query that was sent: the view and the echoed period have to match.
const parseQuickStats =
  (query: QuickStatsQuery) =>
  (body: unknown, status: number): QuickStats => {
    const revenue = isObject(body) ? body.revenue : undefined;
    const ok =
      isObject(body) &&
      isCounts(body.occupancy) &&
      isObject(revenue) &&
      isCount(revenue.totalRevenue) &&
      isCount(revenue.totalNights) &&
      (revenue.averageRate === null || isCount(revenue.averageRate)) &&
      listOf(
        revenue.rows,
        (r) =>
          isObject(r) &&
          isString(r.id) &&
          isString(r.name) &&
          isCount(r.nights) &&
          isCount(r.revenue),
      ) &&
      body.view === query.view &&
      (query.view === 'week'
        ? body.startDate === query.startDate &&
          isCounts(body.daysTotal) &&
          listOf(body.days, (d) => isObject(d) && isString(d.date) && isCounts(d.counts))
        : (query.view === 'day' ? body.date === query.date : body.month === query.month) &&
          isCounts(body.roomBlocksTotal) &&
          listOf(
            body.roomBlocks,
            (b) =>
              isObject(b) &&
              isString(b.id) &&
              isString(b.name) &&
              isCount(b.nights) &&
              isString(b.startDate) &&
              isCounts(b.counts),
          ));
    if (!ok) throw invalid(status, 'quick stats');
    return body as unknown as QuickStats;
  };

const BLOCK_STATUSES: readonly string[] = ['confirmed', 'nyci', 'checked-in', 'checked-out'];
const GUEST_TYPES: readonly string[] = ['guest', 'member', 'owner', 'none'];
const isDated = (v: Record<string, unknown>) =>
  isString(v.startDate) && isString(v.endDate) && v.startDate < v.endDate;

function isScheduleBlock(v: unknown): v is ScheduleBlock {
  return (
    isObject(v) &&
    v.kind === 'reservation' &&
    isString(v.id) &&
    isString(v.reservationId) &&
    isString(v.confirmationNumber) &&
    isString(v.guestName) &&
    isString(v.guestType) &&
    GUEST_TYPES.includes(v.guestType) &&
    isString(v.roomId) &&
    isDated(v) &&
    isString(v.status) &&
    BLOCK_STATUSES.includes(v.status) &&
    isCount(v.roomCount) &&
    v.roomCount >= 1 &&
    typeof v.roomTypeLocked === 'boolean' &&
    isString(v.version) &&
    v.version !== ''
  );
}

// The answer must be for the query that was sent, and every block and closure must sit in a listed
// room (the grid indexes by room id).
const parseSchedule =
  (query: ScheduleQuery) =>
  (body: unknown, status: number): ScheduleData => {
    const named = (x: unknown) => isObject(x) && isString(x.id) && isString(x.name);
    const ok =
      isObject(body) &&
      body.startDate === query.startDate &&
      body.days === query.days &&
      listOf(body.locations, named) &&
      listOf(body.roomTypes, named) &&
      listOf(
        body.rooms,
        (r) =>
          isObject(r) &&
          isString(r.id) &&
          isString(r.number) &&
          isString(r.locationId) &&
          isString(r.roomTypeId),
      ) &&
      listOf(body.blocks, isScheduleBlock) &&
      listOf(
        body.closures,
        (c) =>
          isObject(c) &&
          c.kind === 'closure' &&
          isString(c.id) &&
          isString(c.roomId) &&
          isDated(c) &&
          isString(c.reason) &&
          typeof c.endMarker === 'boolean',
      );
    if (!ok) throw invalid(status, 'schedule');
    const data = body as unknown as ScheduleData;
    const roomIds = new Set(data.rooms.map((r) => r.id));
    // The grid indexes by id: duplicates would draw or move the wrong thing.
    const unique = (ids: string[]) => new Set(ids).size === ids.length;
    if (
      !unique(data.rooms.map((r) => r.id)) ||
      !unique([...data.blocks.map((b) => b.id), ...data.closures.map((c) => c.id)]) ||
      !data.blocks.every((b) => roomIds.has(b.roomId)) ||
      !data.closures.every((c) => roomIds.has(c.roomId))
    ) {
      throw invalid(status, 'schedule');
    }
    return data;
  };

// A move answers with the changed blocks. The moved block must be where the request put it. For
// 'all-rooms' the answer must carry every room of the reservation, consistently counted; for a
// split ('this-room' with new dates) the moved room must have left the reservation (roomCount 1).
const parseMove =
  (
    reservationRoomId: string,
    expect: (moved: ScheduleBlock) => boolean,
    rule?: { scope: 'all-rooms' | 'this-room'; shifted: boolean },
  ) =>
  (body: unknown, status: number): ScheduleMoveResult => {
    if (!isObject(body) || !listOf(body.blocks, isScheduleBlock)) throw invalid(status, 'move');
    const result = body as unknown as ScheduleMoveResult;
    const moved = result.blocks.find((b) => b.id === reservationRoomId);
    if (!moved || !expect(moved)) throw invalid(status, 'move');
    if (new Set(result.blocks.map((b) => b.id)).size !== result.blocks.length) {
      throw invalid(status, 'move');
    }
    if (rule) {
      const group = result.blocks.filter((b) => b.reservationId === moved.reservationId);
      const consistent = group.every((b) => b.roomCount === moved.roomCount);
      if (!consistent) throw invalid(status, 'move');
      if (rule.scope === 'all-rooms' && group.length !== moved.roomCount) {
        throw invalid(status, 'move');
      }
      if (rule.scope === 'this-room' && rule.shifted && moved.roomCount !== 1) {
        throw invalid(status, 'move');
      }
    }
    return result;
  };

function errorFromBody(status: number, statusText: string, text: string): ApiError {
  let message = statusText || 'Request failed';
  let code: string | undefined;
  let details: Record<string, string[]> | undefined;
  try {
    const body: unknown = JSON.parse(text);
    if (isObject(body)) {
      if (typeof body.message === 'string') message = body.message;
      else if (typeof body.error === 'string') message = body.error;
      if (typeof body.code === 'string') code = body.code;
      if (isObject(body.details)) details = body.details as Record<string, string[]>;
    }
  } catch {
    // Not JSON (e.g. an HTML error page): keep the status text.
  }
  return new ApiError(status, message, { code, details });
}

/**
 * Real client: JSON over fetch against `baseUrl`. The paths are the contract for the backend.
 * `credentials: 'include'` is a placeholder decision until auth is designed.
 */
export function createHttpClient(baseUrl: string, options: HttpClientOptions = {}): ApiClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const credentials = options.credentials ?? 'same-origin';

  async function request<T>(
    path: string,
    params: Record<string, string | undefined>,
    requestOptions: RequestOptions | undefined,
    parse: (body: unknown, status: number) => T,
    send?: { method: 'POST'; body: unknown; headers?: Record<string, string> },
  ): Promise<T> {
    const url = new URL(baseUrl + path, globalThis.location?.origin);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }

    // Abort on the caller's signal or on timeout; remember which, to tell them apart.
    const controller = new AbortController();
    const callerSignal = requestOptions?.signal;
    let timedOut = false;
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) onCallerAbort();
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    let response: Response;
    let text: string;
    let headersCause: { error: unknown } | undefined;
    try {
      let extra: Record<string, string> = {};
      try {
        extra = (await options.getHeaders?.()) ?? {};
      } catch (error) {
        headersCause = { error };
        throw error;
      }
      if (controller.signal.aborted)
        throw new DOMException('The operation was aborted.', 'AbortError');
      response = await (options.fetch ?? fetch)(url, {
        method: send?.method,
        body: send ? JSON.stringify(send.body) : undefined,
        headers: {
          Accept: 'application/json',
          ...(send ? { 'Content-Type': 'application/json' } : {}),
          ...send?.headers,
          ...extra,
        },
        credentials,
        signal: controller.signal,
      });
      text = await response.text();
    } catch (error) {
      // The caller's intent wins over a racing timeout; a failed header hook is not a network error.
      if (callerSignal?.aborted) {
        throw error instanceof Error && isAbort(error)
          ? error
          : new DOMException('The operation was aborted.', 'AbortError');
      }
      if (timedOut) throw new ApiError(0, 'Request timed out', { code: 'timeout' });
      if (headersCause) {
        throw new ApiError(0, 'Could not build request headers', {
          code: 'headers',
          cause: headersCause.error,
        });
      }
      if (isAbort(error)) throw error;
      throw new ApiError(0, 'Network error', { code: 'network', cause: error });
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }

    if (!response.ok) {
      if (response.status === 401) options.onUnauthorized?.();
      throw errorFromBody(response.status, response.statusText, text);
    }

    // 204 and empty bodies parse as `undefined`; each parser decides whether that is valid.
    let body: unknown;
    if (text.trim() !== '') {
      try {
        body = JSON.parse(text);
      } catch {
        throw new ApiError(response.status, 'Response was not JSON', { code: 'invalid-response' });
      }
    }
    return parse(body, response.status);
  }

  return {
    dashboard: {
      getStats: (o) => request('/dashboard/stats', {}, o, parseStats),
      getQuickStats: (q, o) =>
        Promise.resolve().then(() => {
          assertQuickStatsQuery(q);
          return request(
            '/dashboard/quick-stats',
            {
              view: q.view,
              date: q.view === 'day' ? q.date : undefined,
              startDate: q.view === 'week' ? q.startDate : undefined,
              month: q.view === 'month' ? q.month : undefined,
            },
            o,
            parseQuickStats(q),
          );
        }),
    },
    reservations: {
      list: (q: ReservationQuery = {}, o) =>
        request(
          '/reservations',
          {
            status: q.status,
            search: q.search?.trim(),
            arrivalFrom: q.arrivalFrom,
            arrivalTo: q.arrivalTo,
            departureFrom: q.departureFrom,
            departureTo: q.departureTo,
            sort: q.sort && `${q.sort.field}:${q.sort.direction}`,
            cursor: q.cursor,
            limit: q.limit === undefined ? undefined : String(q.limit),
          },
          o,
          parsePage,
        ),
      get: (id, o) =>
        Promise.resolve().then(() => {
          assertResourceId(id, 'reservation');
          return request(`/reservations/${encodeURIComponent(id)}`, {}, o, parseReservation);
        }),
    },
    schedule: {
      get: (q, o) =>
        Promise.resolve().then(() => {
          assertScheduleQuery(q);
          return request(
            '/schedule',
            { startDate: q.startDate, days: String(q.days) },
            o,
            parseSchedule(q),
          );
        }),
      moveRoom: (r: MoveRoomRequest, o) =>
        Promise.resolve().then(() => {
          assertMoveRoomRequest(r);
          return request(
            '/schedule/move-room',
            {},
            o,
            parseMove(r.reservationRoomId, (b) => b.roomId === r.toRoomId),
            { method: 'POST', body: r, headers: { 'Idempotency-Key': r.requestId } },
          );
        }),
      moveDates: (r: MoveDatesRequest, o) =>
        Promise.resolve().then(() => {
          assertMoveDatesRequest(r);
          return request(
            '/schedule/move-dates',
            {},
            o,
            parseMove(
              r.reservationRoomId,
              (b) => b.startDate === r.toStartDate && (!r.toRoomId || b.roomId === r.toRoomId),
              { scope: r.scope, shifted: r.toStartDate !== r.fromStartDate },
            ),
            { method: 'POST', body: r, headers: { 'Idempotency-Key': r.requestId } },
          );
        }),
    },
    permissions: { getGrant: (o) => request('/permissions/me', {}, o, parseGrant) },
  };
}
