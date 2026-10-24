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
import { mockRoomTypes, mockRooms, MOCK_ROOM_SETUP_OPTIONS } from './roomSetupData';
import { mockAddOnOptions, mockAddOns } from './addOnData';
import { getFolio, postCharge, type FolioStore } from './folioData';
import { addMember, searchMembers, seedMembers } from './memberData';
import { buildDetail, createReservation, setEarlyLate } from './reservationDetailData';
import {
  cancelReservation,
  mockLastAuditedDate,
  undoCheckIn,
  type CancelledStore,
} from './reservationMenuData';
import { buildQuickStats, emptyQuickStats } from './quickStatsData';
import { buildListRows, checkInRoom, listOptions } from './reservationListData';
import { queryReservationList } from './reservationListQuery';
import { queryReservations } from './reservationQuery';
import { changeRoomDuringStay, createScheduleState, moveDates, moveRoom } from './scheduleData';
import type { ScheduleSize } from './scheduleData';
import { queryScheduleData } from './scheduleQuery';
import { normalizeAddOn, validateAddOn } from '../app/addOns';
import { holdFromRules, validateBookingRules } from '../app/bookingRules';
import { validateSystemSettings } from '../app/systemSettings';
import {
  effectiveDetails,
  syncLinkedRooms,
  validateRoom,
  validateRoomType,
  withoutRoom,
} from '../app/roomSetup';
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
import { assertCancelReservationRequest, assertUndoCheckInRequest } from './reservationMenuApi';

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
  /** The latest business date a night audit has run for (ticket 2.5); defaults to the day before `today`. */
  lastAuditedDate?: IsoDate;
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
  lastAuditedDate = mockLastAuditedDate(today),
}: MockOptions = {}): ApiClient {
  // Per client: schedule moves mutate it, so every test and every page load starts fresh.
  const schedule = createScheduleState(today, scheduleSize);
  const members = seedMembers();
  const listCheckedIn = new Set<string>();
  const cancelledReservations: CancelledStore = new Map();
  let systemSettings = mockSystemSettings();
  let roomTypes = mockRoomTypes();
  let rooms = mockRooms(roomTypes);
  let nextSetupId = 1;
  let addOns = mockAddOns();
  let bookingRules = mockBookingRules();
  const folioStore: FolioStore = new Map();
  const canEditReservations = () => permissionsFromGrant(grant).can(RESERVATION_EDIT_PERMISSION);
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
            const cancelled = cancelledReservations.get(id);
            if (cancelled) return structuredClone(cancelled);
            return { ...buildDetail(schedule, id), lastAuditedDate };
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
      cancelReservation: (request, o) =>
        respond(
          () => {
            assertCancelReservationRequest(request);
            if (!canEditReservations()) {
              throw new ApiError(403, 'You may not change this reservation', { code: 'forbidden' });
            }
            return replayable(request, () =>
              cancelReservation(schedule, cancelledReservations, request, lastAuditedDate),
            );
          },
          () => {
            assertCancelReservationRequest(request);
            throw notFound();
          },
          o,
        ),
      undoCheckIn: (request, o) =>
        respond(
          () => {
            assertUndoCheckInRequest(request);
            if (!canEditReservations()) {
              throw new ApiError(403, 'You may not change this reservation', { code: 'forbidden' });
            }
            return replayable(request, () => undoCheckIn(schedule, request, lastAuditedDate));
          },
          () => {
            assertUndoCheckInRequest(request);
            throw notFound();
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
    roomSetup: {
      getOptions: (o) =>
        respond(
          () => structuredClone(MOCK_ROOM_SETUP_OPTIONS),
          () => structuredClone(MOCK_ROOM_SETUP_OPTIONS),
          o,
        ),
      listRoomTypes: (o) =>
        respond(
          () => structuredClone(roomTypes),
          () => [],
          o,
        ),
      saveRoomType: (input, o) =>
        respond(
          () => {
            if (Object.keys(validateRoomType(input)).length > 0) {
              throw new ApiError(422, 'Room type is not valid', { code: 'validation' });
            }
            const id = input.id ?? `rt-new-${nextSetupId++}`;
            const saved = { ...structuredClone(input), id };
            if (input.id && !roomTypes.some((t) => t.id === input.id)) {
              throw new ApiError(404, 'Room type not found', { code: 'not-found' });
            }
            roomTypes = input.id
              ? roomTypes.map((t) => (t.id === id ? saved : t))
              : [...roomTypes, saved];
            // Rooms that inherit details follow their room type.
            rooms = rooms.map((r) =>
              r.roomTypeId === id && r.inheritDetails
                ? { ...r, details: effectiveDetails(r, roomTypes) }
                : r,
            );
            return structuredClone(saved);
          },
          () => ({ ...structuredClone(input), id: input.id ?? 'rt-new' }),
          o,
        ),
      deleteRoomType: (id, o) =>
        respond(
          () => {
            if (rooms.some((r) => r.roomTypeId === id)) {
              throw new ApiError(409, 'Room type is in use', { code: 'in-use' });
            }
            if (!roomTypes.some((t) => t.id === id)) {
              throw new ApiError(404, 'Room type not found', { code: 'not-found' });
            }
            roomTypes = roomTypes.filter((t) => t.id !== id);
          },
          () => undefined,
          o,
        ),
      listRooms: (o) =>
        respond(
          () => structuredClone(rooms),
          () => [],
          o,
        ),
      saveRoom: (input, o) =>
        respond(
          () => {
            if (Object.keys(validateRoom(input)).length > 0) {
              throw new ApiError(422, 'Room is not valid', { code: 'validation' });
            }
            const existing = input.id ? rooms.find((r) => r.id === input.id) : undefined;
            if (input.id && !existing) {
              throw new ApiError(404, 'Room not found', { code: 'not-found' });
            }
            const id = input.id ?? `room-new-${nextSetupId++}`;
            const saved = {
              ...structuredClone(input),
              id,
              upcomingReservations: existing?.upcomingReservations ?? 0,
              details: effectiveDetails(input, roomTypes),
            };
            const linked = saved.linkedRoomIds;
            rooms = existing ? rooms.map((r) => (r.id === id ? saved : r)) : [...rooms, saved];
            rooms = syncLinkedRooms(rooms, id, linked);
            return structuredClone(rooms.find((r) => r.id === id) as typeof saved);
          },
          () => ({
            ...structuredClone(input),
            id: input.id ?? 'room-new',
            upcomingReservations: 0,
          }),
          o,
        ),
      deleteRoom: (id, o) =>
        respond(
          () => {
            if (!rooms.some((r) => r.id === id)) {
              throw new ApiError(404, 'Room not found', { code: 'not-found' });
            }
            rooms = withoutRoom(rooms, id);
          },
          () => undefined,
          o,
        ),
    },
    addOns: {
      getOptions: (o) =>
        respond(
          () => mockAddOnOptions(roomTypes.map((t) => ({ id: t.id, label: t.name }))),
          () => mockAddOnOptions([]),
          o,
        ),
      list: (o) =>
        respond(
          () => structuredClone(addOns),
          () => [],
          o,
        ),
      save: (input, o) =>
        respond(
          () => {
            if (Object.keys(validateAddOn(input)).length > 0) {
              throw new ApiError(422, 'Add-on is not valid', { code: 'validation' });
            }
            if (input.id && !addOns.some((a) => a.id === input.id)) {
              throw new ApiError(404, 'Add-on not found', { code: 'not-found' });
            }
            const id = input.id ?? `addon-new-${nextSetupId++}`;
            const saved = { ...structuredClone(normalizeAddOn(input)), id };
            addOns = input.id ? addOns.map((a) => (a.id === id ? saved : a)) : [...addOns, saved];
            return structuredClone(saved);
          },
          () => ({ ...structuredClone(normalizeAddOn(input)), id: input.id ?? 'addon-new' }),
          o,
        ),
      delete: (id, o) =>
        respond(
          () => {
            if (!addOns.some((a) => a.id === id)) {
              throw new ApiError(404, 'Add-on not found', { code: 'not-found' });
            }
            addOns = addOns.filter((a) => a.id !== id);
          },
          () => undefined,
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
