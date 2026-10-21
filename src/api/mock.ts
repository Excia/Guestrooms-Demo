import type { MockScenario } from './config';
import {
  emptyStats,
  fullGrant,
  MOCK_BOOKING_HOLD,
  MOCK_ROOM_CHANGE_RULE,
  MOCK_TODAY,
  mockReservations,
  mockStats,
  noGrant,
} from './mockData';
import { RESERVATION_EDIT_PERMISSION } from '../app/permissions';
import { permissionsFromGrant } from './grant';
import { mockBookingRules, MOCK_BOOKING_RULES_OPTIONS } from './bookingRulesData';
import { mockCustomReports } from './reportsData';
import { mockSystemSettings, MOCK_SYSTEM_SETTINGS_OPTIONS } from './systemSettingsData';
import { getFolio, postCharge, type FolioStore } from './folioData';
import { addMember, searchMembers, seedMembers } from './memberData';
import { buildDetail, createReservation, setEarlyLate } from './reservationDetailData';
import { buildQuickStats, emptyQuickStats } from './quickStatsData';
import { buildListRows, checkInRoom, listOptions } from './reservationListData';
import { queryReservationList } from './reservationListQuery';
import { queryReservations } from './reservationQuery';
import { changeRoomDuringStay, createScheduleState, moveDates, moveRoom } from './scheduleData';
import type { ScheduleSize } from './scheduleData';
import { queryScheduleData } from './scheduleQuery';
import { holdFromRules, validateBookingRules } from '../app/bookingRules';
import { validateSystemSettings } from '../app/systemSettings';
import type { ApiClient, IsoDate, PermissionGrant, RequestOptions, RoomChangeRule } from './types';
import { ApiError } from './types';
import {
  assertChangeRoomRequest,
  assertCheckInRoomRequest,
  assertCreateMemberRequest,
  assertCreateReservationRequest,
  assertMemberQuery,
  assertEarlyLateRequest,
  assertMoveDatesRequest,
  assertMoveRoomRequest,
  assertPostChargeRequest,
  assertQuickStatsQuery,
  assertReservationListQuery,
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
  /** The room-change rate setting (ticket 2.3); defaults to asking (PLACEHOLDER until ticket 7.1). */
  roomChangeRule?: RoomChangeRule;
}

export const MOCK_PAGE_SIZE = 4;
/** Reservation List default page size, as the backend would apply it. */
const LIST_PAGE_SIZE = 25;

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
  roomChangeRule = MOCK_ROOM_CHANGE_RULE,
}: MockOptions = {}): ApiClient {
  // Per client: schedule moves mutate it, so every test and every page load starts fresh.
  const schedule = createScheduleState(today, scheduleSize);
  const members = seedMembers();
  const listCheckedIn = new Set<string>();
  let systemSettings = mockSystemSettings();
  let bookingRules = mockBookingRules();
  const folioStore: FolioStore = new Map();
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
            return replayable(request, () =>
              createReservation(schedule, request, (id) => members.find((m) => m.id === id)),
            );
          },
          () => {
            assertCreateReservationRequest(request);
            throw new ApiError(404, 'Room not found');
          },
          o,
        ),
      changeRoomDuringStay: (request, o) =>
        respond(
          () => {
            assertChangeRoomRequest(request);
            if (!permissionsFromGrant(grant).can(RESERVATION_EDIT_PERMISSION)) {
              throw new ApiError(403, 'You may not change this reservation', { code: 'forbidden' });
            }
            return replayable(request, () =>
              changeRoomDuringStay(schedule, request, roomChangeRule),
            );
          },
          () => {
            assertChangeRoomRequest(request);
            throw new ApiError(404, 'Reservation room not found');
          },
          o,
        ),
    },
    reservationList: {
      list: (query, o) =>
        respond(
          () => {
            assertReservationListQuery(query ?? {});
            return queryReservationList(
              buildListRows(schedule, listCheckedIn),
              query,
              LIST_PAGE_SIZE,
            );
          },
          () => {
            assertReservationListQuery(query ?? {});
            return { items: [], total: 0 };
          },
          o,
        ),
      getOptions: (o) =>
        respond(
          () => listOptions(schedule),
          () => ({ locations: [], roomTypes: [] }),
          o,
        ),
      checkInRoom: (request, o) =>
        respond(
          () => {
            assertCheckInRoomRequest(request);
            return replayable(request, () => checkInRoom(schedule, listCheckedIn, request));
          },
          () => {
            assertCheckInRoomRequest(request);
            throw new ApiError(404, 'Reservation room not found');
          },
          o,
        ),
    },
    folios: {
      get: (id, o) =>
        respond(
          () => {
            assertResourceId(id, 'reservation');
            return getFolio(schedule, folioStore, id);
          },
          () => {
            throw notFound();
          },
          o,
        ),
      postCharge: (request, o) =>
        respond(
          () => {
            assertPostChargeRequest(request);
            return replayable(request, () => postCharge(schedule, folioStore, request));
          },
          () => {
            assertPostChargeRequest(request);
            throw notFound();
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
    members: {
      search: (query, o) =>
        respond(
          () => {
            assertMemberQuery(query ?? {});
            return searchMembers(members, query);
          },
          () => ({ items: [], total: 0 }),
          o,
        ),
      // Creating a person works in every scenario but "error": the directory is not "empty data".
      create: (request, o) =>
        respond(
          () => {
            assertCreateMemberRequest(request);
            return replayable(request, () => addMember(members, request));
          },
          () => {
            assertCreateMemberRequest(request);
            return replayable(request, () => addMember(members, request));
          },
          o,
        ),
    },
    settings: {
      // The hold minutes are the "Reservation Hold" row of Booking Rules (ticket 7.5).
      getBookingHold: (o) =>
        respond(
          () => holdFromRules(bookingRules),
          () => ({ ...MOCK_BOOKING_HOLD }),
          o,
        ),
      getRoomChangeRule: (o) =>
        respond(
          () => ({ ...roomChangeRule }),
          () => ({ ...roomChangeRule }),
          o,
        ),
    },
    bookingRules: {
      get: (o) =>
        respond(
          () => structuredClone(bookingRules),
          () => structuredClone(bookingRules),
          o,
        ),
      save: (rules, o) =>
        respond(
          () => {
            if (Object.keys(validateBookingRules(rules)).length > 0) {
              throw new ApiError(422, 'Booking rules are not valid', { code: 'validation' });
            }
            bookingRules = structuredClone(rules);
            return structuredClone(bookingRules);
          },
          () => structuredClone(rules),
          o,
        ),
      getOptions: (o) =>
        respond(
          () => structuredClone(MOCK_BOOKING_RULES_OPTIONS),
          () => structuredClone(MOCK_BOOKING_RULES_OPTIONS),
          o,
        ),
    },
    systemSettings: {
      get: (o) =>
        respond(
          () => structuredClone(systemSettings),
          () => structuredClone(systemSettings),
          o,
        ),
      save: (settings, o) =>
        respond(
          () => {
            const errors = validateSystemSettings(settings);
            if (Object.keys(errors).length > 0) {
              throw new ApiError(422, 'System settings are not valid', { code: 'validation' });
            }
            systemSettings = structuredClone(settings);
            return structuredClone(systemSettings);
          },
          () => structuredClone(settings),
          o,
        ),
      getOptions: (o) =>
        respond(
          () => structuredClone(MOCK_SYSTEM_SETTINGS_OPTIONS),
          () => structuredClone(MOCK_SYSTEM_SETTINGS_OPTIONS),
          o,
        ),
    },
    reports: {
      listCustom: (o) =>
        respond(
          () => mockCustomReports(),
          () => [],
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
