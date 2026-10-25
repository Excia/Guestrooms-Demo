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
import {
  checkInLevel,
  LOCATIONS_EDIT_PERMISSION,
  RESERVATION_EDIT_PERMISSION,
} from '../app/permissions';
import { clubClock } from '../lib/clubTime';
import { permissionsFromGrant } from './grant';
import { mockBookingRules, MOCK_BOOKING_RULES_OPTIONS } from './bookingRulesData';
import { previewRegistrationCardUrl } from './registrationCardData';
import { assertChangeLogQuery } from './changeLogValidation';
import { mockChangeLog, MOCK_EVENT_TYPES, queryChangeLog } from './changeLogData';
import { mockCustomReports } from './reportsData';
import { mockLocations, MOCK_LOCATION_AREAS } from './locationsData';
import { mockSystemSettings, MOCK_SYSTEM_SETTINGS_OPTIONS } from './systemSettingsData';
import { mockRoomTypes, mockRooms, MOCK_ROOM_SETUP_OPTIONS } from './roomSetupData';
import { mockAddOnOptions, mockAddOns } from './addOnData';
import { MOCK_RETRIEVED_ENCODERS, mockEncoderKeys } from './keycardData';
import { getFolio, postCharge, type FolioStore } from './folioData';
import { addMember, searchMembers, seedMembers } from './memberData';
import { buildDetail, createReservation, setEarlyLate } from './reservationDetailData';
import { addRoom, updateGuests, updateNotes } from './reservationEditData';
import {
  assertAddRoomRequest,
  assertUpdateGuestsRequest,
  assertUpdateNotesRequest,
} from './reservationEditApi';
import {
  cancelReservation,
  mockLastAuditedDate,
  undoCheckIn,
  type CancelledStore,
} from './reservationMenuData';
import {
  addPaymentMethod,
  checkInReservation,
  isMockOverrideCode,
  paymentOnFile,
  splitRoom,
} from './checkInData';
import { buildQuickStats, emptyQuickStats } from './quickStatsData';
import { buildListRows, checkInRoom, listOptions } from './reservationListData';
import { queryReservationList } from './reservationListQuery';
import { queryReservations } from './reservationQuery';
import {
  changeRoomDuringStay,
  createScheduleState,
  moveDates,
  createClosure,
  updateClosure,
  deleteClosure,
  moveRoom,
  setHousekeeping,
} from './scheduleData';
import type { ScheduleSize } from './scheduleData';
import { queryScheduleData } from './scheduleQuery';
import { assertNotHeldByOther, dropHold, holdsInWindow, placeHold, seedHolds } from './holdData';
import { normalizeAddOn, validateAddOn } from '../app/addOns';
import { validateEncoderKeys } from '../app/keycards';
import { holdFromRules, validateBookingRules } from '../app/bookingRules';
import { normalizeOnlineBooking } from '../app/onlineBookingSettings';
import { validateSystemSettings } from '../app/systemSettings';
import { checkRemoveLocation, validateLocations } from '../app/locations';
import {
  effectiveDetails,
  syncLinkedRooms,
  validateRoom,
  validateRoomType,
  withoutRoom,
} from '../app/roomSetup';
import { addDays } from '../lib/dates';
import type { ApiClient, IsoDate, PermissionGrant, RequestOptions, RoomChangeRule } from './types';
import { ApiError } from './types';
import {
  assertChangeRoomRequest,
  assertCheckInRoomRequest,
  assertCreateMemberRequest,
  assertCreateReservationRequest,
  assertHoldId,
  assertHoldSlotRequest,
  assertMemberQuery,
  assertEarlyLateRequest,
  assertMoveDatesRequest,
  assertSaveClosureRequest,
  assertUpdateClosureRequest,
  assertDeleteClosureRequest,
  assertMoveRoomRequest,
  assertSetHousekeepingRequest,
  assertPostChargeRequest,
  assertQuickStatsQuery,
  assertReservationListQuery,
  assertResourceId,
  assertScheduleQuery,
} from './validation';
import { assertCancelReservationRequest, assertUndoCheckInRequest } from './reservationMenuApi';
import {
  assertAddPaymentMethodRequest,
  assertCheckInReservationRequest,
  assertSplitRoomRequest,
  assertVerifyOverrideCodeRequest,
} from './checkInApi';

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
  /** The current instant, for the check in / out times (ticket 163); defaults to the real clock. */
  now?: () => Date;
  /** Slot holds (ticket 152): `seeded` (default) starts with another user's hold on a free slot, `none` with no holds. */
  holds?: 'seeded' | 'none';
}

/** Small non-cryptographic hash for the mock (the real backend uses a keyed hash or does not store the code). */
const hashCode = (text: string) => {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(16);
};

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
  now = () => new Date(),
  holds: holdsMode = 'seeded',
}: MockOptions = {}): ApiClient {
  // Per client: schedule moves mutate it, so every test and every page load starts fresh.
  const schedule = createScheduleState(today, scheduleSize);
  const members = seedMembers();
  const holdStore = holdsMode === 'seeded' ? seedHolds(schedule, today, now().getTime()) : [];
  const listCheckedIn = new Set<string>();
  const cancelledReservations: CancelledStore = new Map();
  let systemSettings = mockSystemSettings();
  let roomTypes = mockRoomTypes();
  let rooms = mockRooms(roomTypes);
  let nextSetupId = 1;
  let addOns = mockAddOns();
  let encoderKeys = mockEncoderKeys();
  let bookingRules = mockBookingRules();
  let locations = mockLocations();
  const changeLog = mockChangeLog(today);
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

  /** The details panel's data: the schedule's reservation plus what the audit and payment add. */
  function detailFor(id: string) {
    return {
      ...buildDetail(schedule, id),
      lastAuditedDate,
      paymentOnFile: paymentOnFile(schedule, id),
      // The night audit posts charges up to the last audited date; a later charge that
      // the mock folio shows as posted is reported as still waiting for the audit.
      folioCharges: getFolio(schedule, folioStore, id).charges.map((c) => ({
        type: c.type,
        status:
          c.status === 'posted' && c.type !== 'mpos' && c.date > lastAuditedDate
            ? ('unposted' as const)
            : c.status,
      })),
    };
  }
  const checkInEnv = () => ({
    now: now(),
    // The mock's "today" is configured; only the time of day follows the club's real clock.
    clock: { date: schedule.today, time: clubClock(systemSettings.timeZone, now()).time },
    checkOutTime: systemSettings.checkOutTime,
    level: checkInLevel(permissionsFromGrant(grant).can),
  });

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
            return detailFor(id);
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
            return replayable(request, () => {
              assertNotHeldByOther(holdStore, request, now().getTime());
              const detail = createReservation(schedule, request, (id) =>
                members.find((m) => m.id === id),
              );
              // The booking now occupies the slot: the holder's hold ends with it.
              if (request.holdId) dropHold(holdStore, request.holdId);
              return detail;
            });
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
      checkIn: (request, o) =>
        respond(
          () => {
            assertCheckInReservationRequest(request);
            // The override code is never kept: the replay fingerprint holds only a hash of it.
            const { overrideCode, ...rest } = request;
            const fingerprint = {
              ...rest,
              overrideCodeHash: overrideCode && hashCode(overrideCode),
            };
            return replayable(fingerprint, () => {
              const applied = checkInReservation(schedule, folioStore, checkInEnv(), request);
              return { ...applied, reservation: detailFor(request.reservationId) };
            });
          },
          () => {
            assertCheckInReservationRequest(request);
            throw notFound();
          },
          o,
        ),
      verifyOverrideCode: (request, o) =>
        respond(
          () => {
            assertVerifyOverrideCodeRequest(request);
            // Only a signed-in user holding a check-in grant may probe codes.
            if (checkInEnv().level === 'never') {
              throw new ApiError(403, 'You may not check in', { code: 'forbidden' });
            }
            return { valid: isMockOverrideCode(request.code) };
          },
          () => {
            assertVerifyOverrideCodeRequest(request);
            return { valid: false };
          },
          o,
        ),
      addRoom: (request, o) =>
        respond(
          () => {
            assertAddRoomRequest(request);
            // No permission check, as in legacy (D-LM-5, Q-LM-2).
            return replayable(request, () => {
              const added = addRoom(
                schedule,
                request,
                detailFor(request.reservationId),
                (id) => members.find((m) => m.id === id),
                (id) => folioStore.delete(id),
                holdsInWindow(
                  holdStore,
                  detailFor(request.reservationId).arrival,
                  detailFor(request.reservationId).departure,
                  now().getTime(),
                ),
                now().getTime(),
              );
              return detailFor(added.id);
            });
          },
          () => {
            assertAddRoomRequest(request);
            throw notFound();
          },
          o,
        ),
      updateGuests: (request, o) =>
        respond(
          () => {
            assertUpdateGuestsRequest(request);
            if (!canEditReservations()) {
              throw new ApiError(403, 'You may not change this reservation', { code: 'forbidden' });
            }
            return replayable(request, () => {
              updateGuests(schedule, request, (id) => members.find((m) => m.id === id));
              return detailFor(request.reservationId);
            });
          },
          () => {
            assertUpdateGuestsRequest(request);
            throw notFound();
          },
          o,
        ),
      updateNotes: (request, o) =>
        respond(
          () => {
            assertUpdateNotesRequest(request);
            if (!canEditReservations()) {
              throw new ApiError(403, 'You may not change this reservation', { code: 'forbidden' });
            }
            return replayable(request, () => {
              updateNotes(schedule, request);
              return detailFor(request.reservationId);
            });
          },
          () => {
            assertUpdateNotesRequest(request);
            throw notFound();
          },
          o,
        ),
      splitRoom: (request, o) =>
        respond(
          () => {
            assertSplitRoomRequest(request);
            if (!canEditReservations()) {
              throw new ApiError(403, 'You may not change this reservation', { code: 'forbidden' });
            }
            return replayable(request, () => {
              const created = splitRoom(schedule, folioStore, request);
              return detailFor(created.id);
            });
          },
          () => {
            assertSplitRoomRequest(request);
            throw notFound();
          },
          o,
        ),
      addPaymentMethod: (request, o) =>
        respond(
          () => {
            assertAddPaymentMethodRequest(request);
            return replayable(request, () => {
              addPaymentMethod(schedule, request);
              return detailFor(request.reservationId);
            });
          },
          () => {
            assertAddPaymentMethodRequest(request);
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
            const data = queryScheduleData(schedule, query);
            return structuredClone({
              ...data,
              holds: holdsInWindow(
                holdStore,
                query.startDate,
                addDays(query.startDate, query.days),
                now().getTime(),
              ),
            });
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
              unassigned: [],
              holds: [],
            };
          },
          o,
        ),
      createClosure: (request, o) =>
        respond(
          () => {
            assertSaveClosureRequest(request);
            if (!canEditReservations()) {
              throw new ApiError(403, 'You may not change closures', { code: 'forbidden' });
            }
            return replayable(request, () => createClosure(schedule, request));
          },
          () => {
            assertSaveClosureRequest(request);
            throw new ApiError(404, 'Room not found');
          },
          o,
        ),
      updateClosure: (request, o) =>
        respond(
          () => {
            assertUpdateClosureRequest(request);
            if (!canEditReservations()) {
              throw new ApiError(403, 'You may not change closures', { code: 'forbidden' });
            }
            return replayable(request, () => updateClosure(schedule, request));
          },
          () => {
            assertUpdateClosureRequest(request);
            throw new ApiError(404, 'Closure not found');
          },
          o,
        ),
      deleteClosure: (request, o) =>
        respond(
          () => {
            assertDeleteClosureRequest(request);
            if (!canEditReservations()) {
              throw new ApiError(403, 'You may not change closures', { code: 'forbidden' });
            }
            return replayable(request, () => deleteClosure(schedule, request));
          },
          () => {
            assertDeleteClosureRequest(request);
            throw new ApiError(404, 'Closure not found');
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
      setHousekeeping: (request, o) =>
        respond(
          () => {
            assertSetHousekeepingRequest(request);
            return { blocks: replayable(request, () => setHousekeeping(schedule, request)) };
          },
          () => {
            assertSetHousekeepingRequest(request);
            throw new ApiError(404, 'Reservation room not found');
          },
          o,
        ),
      holdSlot: (request, o) =>
        respond(
          () => {
            assertHoldSlotRequest(request);
            if (!canEditReservations()) throw new ApiError(403, 'Not allowed to hold a room');
            return placeHold(
              holdStore,
              schedule,
              request,
              now().getTime(),
              holdFromRules(bookingRules).employee,
            );
          },
          () => {
            assertHoldSlotRequest(request);
            throw new ApiError(404, 'Room not found');
          },
          o,
        ),
      releaseHold: (holdId, o) =>
        respond(
          () => {
            assertHoldId(holdId);
            dropHold(holdStore, holdId);
          },
          () => {
            assertHoldId(holdId);
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
    locations: {
      list: (o) =>
        respond(
          () => structuredClone(locations),
          () => [],
          o,
        ),
      listAreas: (o) =>
        respond(
          () => structuredClone(MOCK_LOCATION_AREAS),
          () => [],
          o,
        ),
      save: (rows, o) =>
        respond(
          () => {
            if (!permissionsFromGrant(grant).can(LOCATIONS_EDIT_PERMISSION)) {
              throw new ApiError(403, 'You may not change locations', { code: 'forbidden' });
            }
            // Like the backend: the area has to exist, not only be present.
            if (
              rows.length === 0 ||
              Object.keys(validateLocations(rows)).length > 0 ||
              rows.some((r) => !MOCK_LOCATION_AREAS.some((a) => a.id === r.area?.id))
            ) {
              throw new ApiError(422, 'Locations are not valid', { code: 'validation' });
            }
            const kept = new Set(rows.map((r) => r.id));
            if (locations.some((l) => !kept.has(l.id) && !checkRemoveLocation(l.usage).allowed)) {
              throw new ApiError(409, 'A location in use cannot be removed', {
                code: 'location-in-use',
              });
            }
            // A replace of the whole list: saving the same list again changes nothing.
            const before = locations;
            locations = rows.map((r) => ({
              id: r.id,
              name: r.name.trim(),
              area: r.area,
              usage: before.find((l) => l.id === r.id)?.usage ?? { roomTypes: [], roomCount: 0 },
            }));
            // One store for the whole mock: the schedule follows (names, new locations, and the
            // rooms and bookings of a removed location go with it).
            const remaining = new Set(locations.map((l) => l.id));
            schedule.locations = locations.map((l) => ({ id: l.id, name: l.name }));
            schedule.rooms = schedule.rooms.filter((r) => remaining.has(r.locationId));
            const roomIds = new Set(schedule.rooms.map((r) => r.id));
            schedule.blocks = schedule.blocks.filter((b) => roomIds.has(b.roomId));
            schedule.closures = schedule.closures.filter((c) => roomIds.has(c.roomId));
            return structuredClone(locations);
          },
          () => rows.map((r) => ({ ...r, usage: { roomTypes: [], roomCount: 0 } })),
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
            systemSettings = structuredClone({
              ...settings,
              onlineBooking: normalizeOnlineBooking(settings.onlineBooking),
            });
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
    registrationCard: {
      requestPreview: (request, o) =>
        respond(
          () => ({ url: previewRegistrationCardUrl(request) }),
          () => ({ url: previewRegistrationCardUrl(request) }),
          o,
        ),
    },
    changeLog: {
      list: (query, o) =>
        respond(
          () => {
            assertChangeLogQuery(query);
            return queryChangeLog(changeLog[query.page], query, today);
          },
          () => ({ items: [], total: 0 }),
          o,
        ),
      listEventTypes: (o) =>
        respond(
          () => structuredClone([...MOCK_EVENT_TYPES]),
          () => structuredClone([...MOCK_EVENT_TYPES]),
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
          () =>
            mockAddOnOptions(
              roomTypes.map((t) => ({ id: t.id, label: t.name })),
              locations,
            ),
          () => mockAddOnOptions([], locations),
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
            // Like the backend: the SKU and every association must exist in the options.
            const known = mockAddOnOptions(
              roomTypes.map((t) => ({ id: t.id, label: t.name })),
              locations,
            );
            if (
              (input.sku && !known.skus.some((k) => k.id === input.sku?.id)) ||
              input.locationIds.some((id) => !known.locations.some((k) => k.id === id)) ||
              input.roomTypeIds.some((id) => !known.roomTypes.some((k) => k.id === id))
            ) {
              throw new ApiError(422, 'Add-on refers to an unknown SKU, location or room type', {
                code: 'validation',
              });
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
    keycards: {
      listEncoders: (o) =>
        respond(
          () => [...encoderKeys],
          () => [],
          o,
        ),
      saveEncoders: (keys, o) =>
        respond(
          () => {
            if (!validateEncoderKeys(keys)) {
              throw new ApiError(422, 'Encoder keys are not valid', { code: 'validation' });
            }
            encoderKeys = [...keys];
            return [...encoderKeys];
          },
          () => [...keys],
          o,
        ),
      // The Visionline connection does not exist yet (Q-75-3): a fixed success response.
      retrieveEncoders: (o) =>
        respond(
          () => [...MOCK_RETRIEVED_ENCODERS],
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
