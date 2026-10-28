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
  ADMIN_PERMISSION,
  adminEditPermission,
  type AdminPageId,
  type Permissions,
  CHECK_IN_ANY_TIME_PERMISSION,
  checkInLevel,
  LOCATIONS_EDIT_PERMISSION,
  RESERVATION_EDIT_PERMISSION,
} from '../app/permissions';
import { clubClock } from '../lib/clubTime';
import { permissionsFromGrant } from './grant';
import { mockPermissionSets } from './permissionSetsData';
import {
  grantFromSet,
  normalizeSet,
  summarizeSets,
  validateSets,
  type PermissionSet,
} from '../app/permissionSets';
import { mockBookingRules, MOCK_BOOKING_RULES_OPTIONS } from './bookingRulesData';
import { previewRegistrationCardUrl } from './registrationCardData';
import { assertChangeLogQuery } from './changeLogValidation';
import { mockChangeLog, MOCK_EVENT_TYPES, queryChangeLog } from './changeLogData';
import { mockCustomReports } from './reportsData';
import { mockLocations, MOCK_LOCATION_AREAS } from './locationsData';
import { mockEmployeeCandidates, mockEmployees } from './employeesData';
import {
  mockSystemSettings,
  MOCK_HOUSE_ACCOUNTS,
  MOCK_SYSTEM_SETTINGS_OPTIONS,
  searchHouseAccounts,
} from './systemSettingsData';
import { mockRoomTypes, mockRooms, MOCK_ROOM_SETUP_OPTIONS } from './roomSetupData';
import { mockRoomOptions } from './roomOptionsData';
import { mockAddOnOptions, mockAddOns } from './addOnData';
import { mockRateCategories, mockRateCategoryOptions } from './rateCategoryData';
import { MOCK_RETRIEVED_ENCODERS, mockEncoderKeys } from './keycardData';
import {
  mockStoredApiKeys,
  mockStoredAuths,
  mockStoredPayCloudTokens,
  type StoredApiKey,
  type StoredAuth,
  type StoredPayCloudToken,
} from './integrationsData';
import {
  generateApiKeySecret,
  maskSecret,
  mockConnectionWorks,
  normalizeKeyName,
  validateAuth,
  validateKeyName,
  validatePayCloudKey,
} from '../app/apiIntegrations';
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
import { addPaymentMethod, checkInReservation, paymentOnFile, splitRoom } from './checkInData';
import { missingFields, UNLOCK_PERMISSION } from '../app/overrideUnlock';
import { createPinGuard, MOCK_PIN_HOLDERS } from './overridePin';
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
import {
  duplicateNameError,
  hasErrors,
  isNameTaken,
  normalizeRateCategory,
  seasonSkuShapesValid,
  validateRateCategory,
} from '../app/rateCategories';
import { validateEncoderKeys } from '../app/keycards';
import { applyRoomOrder, orderScheduleRooms } from '../app/roomOrder';
import { holdFromRules, validateBookingRules } from '../app/bookingRules';
import { normalizeOnlineBooking } from '../app/onlineBookingSettings';
import { validateSystemSettings } from '../app/systemSettings';
import { checkRemoveLocation, validateLocations } from '../app/locations';
import { isEmployeeRole, lastAdministratorProblem, needsPermissionSet } from '../app/employees';
import {
  unknownOptionIds,
  normalizeLabel,
  optionUsage,
  removedIds,
  validateRoomOptions,
  hasOptionErrors,
  type RoomOptionKind,
} from '../app/featureBedOptions';
import {
  effectiveDetails,
  syncLinkedRooms,
  validateRoom,
  validateRoomType,
  withoutRoom,
} from '../app/roomSetup';
import { acceptPhotoFiles, storedPhotoName } from '../app/photos';
import { newRequestId } from '../lib/requestId';
import { addDays } from '../lib/dates';
import type {
  ApiClient,
  EmployeeSetup,
  IsoDate,
  PermissionGrant,
  RequestOptions,
  RoomChangeRule,
  SystemSettingsOptions,
} from './types';
import { ApiError } from './types';
import type { IntegrationAuthInput } from './types';
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
  assertRoomOrder,
  assertScheduleQuery,
} from './validation';
import { assertCancelReservationRequest, assertUndoCheckInRequest } from './reservationMenuApi';
import {
  assertAddPaymentMethodRequest,
  assertCheckInReservationRequest,
  assertSplitRoomRequest,
  assertVerifyOverridePinRequest,
} from './checkInApi';

export interface MockOptions {
  scenario?: MockScenario;
  /** Simulated network delay in ms. Tests pass 0. */
  latencyMs?: number;
  /** Default reservations page size; small so paging is exercisable with the sample data. */
  pageSize?: number;
  /** What `permissions.getGrant` returns in the normal scenario; defaults to an unrestricted user. */
  grant?: PermissionGrant;
  /**
   * The permission set the signed-in user belongs to (`management`, `staff`). When given, the grant
   * is derived from the saved set on every call, so editing the set changes `can()` after a reload.
   */
  permissionSetId?: string;
  /** Keeps the edited sets between page loads (the dev app uses localStorage; tests pass nothing). */
  permissionSetsStore?: {
    load(): readonly PermissionSet[] | null;
    save(sets: PermissionSet[]): void;
  };
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
  grant: staticGrant = fullGrant,
  permissionSetId,
  permissionSetsStore,
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
  // The rate categories follow the Rate Categories list; the member types are the Booking Rules ones.
  const systemSettingsOptions = (): SystemSettingsOptions => ({
    ...structuredClone(MOCK_SYSTEM_SETTINGS_OPTIONS),
    rateCategories: rateCategories.map((c) => ({ id: c.id, label: c.name })),
    memberTypes: structuredClone(MOCK_BOOKING_RULES_OPTIONS.memberTypes),
  });
  let roomTypes = mockRoomTypes();
  let rooms = mockRooms(roomTypes);
  let nextSetupId = 1;
  // The one source of Features and Bed Sizes: Room Types, Rooms and the Schedule filter read it.
  let roomOptions = mockRoomOptions();
  let nextOptionId = 1;
  let optionsVersion = 1;
  let addOns = mockAddOns();
  let rateCategories = mockRateCategories();
  let encoderKeys = mockEncoderKeys();
  // API Integrations (ticket 188): stored secrets stay in here; the API only returns masked ones.
  let apiKeys = mockStoredApiKeys(today);
  let nextApiKeyId = 3;
  let payCloudTokens = mockStoredPayCloudTokens();
  let nextPayCloudId = 3;
  let auths = mockStoredAuths();
  let bookingRules = mockBookingRules();
  let locations = mockLocations();
  let employees = mockEmployees();
  // The club directory: people with access and people without (the add type-ahead source).
  const directory = [
    ...employees.map((e) => ({ id: e.id, label: e.name })),
    ...mockEmployeeCandidates(),
  ];
  const changeLog = mockChangeLog(today);
  const folioStore: FolioStore = new Map();
  let permissionSets = (permissionSetsStore?.load() ?? mockPermissionSets()).map((s) =>
    normalizeSet(s),
  );
  // The signed-in user's grant: derived from their (saved) permission set, else the fixed one.
  const currentGrant = (): PermissionGrant => {
    const set = permissionSetId ? permissionSets.find((s) => s.id === permissionSetId) : undefined;
    return set ? { role: set.name, permissions: grantFromSet(set) } : staticGrant;
  };
  const canEditReservations = () =>
    permissionsFromGrant(currentGrant()).can(RESERVATION_EDIT_PERMISSION);
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

  // Room Types and Rooms may only use Features and Bed Sizes that exist in Room Options.
  function assertKnownOptions(details: { featureIds: string[]; bedTypes: Record<string, number> }) {
    const unknown = unknownOptionIds(details, roomOptions);
    if (unknown.features.length > 0 || unknown.bedSizes.length > 0) {
      throw new ApiError(422, 'A Feature or Bed Size is not in Room Options', {
        code: 'validation',
        details: { featureIds: unknown.features, bedTypes: unknown.bedSizes },
      });
    }
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

  const apiKeySummary = (k: StoredApiKey) => ({
    id: k.id,
    name: k.name,
    maskedKey: maskSecret(k.secret),
    createdAt: k.createdAt,
  });
  const payCloudSummary = (t: StoredPayCloudToken) => ({
    id: t.id,
    maskedKey: maskSecret(t.apiKey),
    environment: t.environment,
  });
  const authSummary = (a: StoredAuth) => ({
    provider: a.provider,
    enabled: a.enabled,
    baseUrl: a.baseUrl,
    userName: a.userName,
    hasPassword: a.password !== '',
    ...(a.provider === 'assa-abloy' ? { accessId: a.accessId, uuid: a.uuid } : {}),
  });
  const mergeAuth = (stored: StoredAuth, input: IntegrationAuthInput): StoredAuth => ({
    ...stored,
    enabled: input.enabled,
    baseUrl: input.baseUrl,
    userName: input.userName,
    // A saved password is kept only for the URL and username it was saved with.
    password:
      input.password ??
      (input.baseUrl.trim() === stored.baseUrl.trim() &&
      input.userName.trim() === stored.userName.trim()
        ? stored.password
        : ''),
    accessId: input.accessId ?? stored.accessId,
    uuid: input.uuid ?? stored.uuid,
  });
  // Create / rotate replays: a repeated request id answers the key WITHOUT its secret (it was shown
  // once and is not kept). Forgotten when the key is rotated or revoked; bounded to the last 100.
  const issued = new Map<string, { fingerprint: string; keyId: string }>();
  const ISSUED_LIMIT = 100;
  function forgetIssued(keyId: string) {
    for (const [id, entry] of issued) if (entry.keyId === keyId) issued.delete(id);
  }
  function issue(
    request: { requestId: string },
    fingerprint: string,
    apply: () => { key: ReturnType<typeof apiKeySummary>; secret: string },
  ): { key: ReturnType<typeof apiKeySummary>; secret: string | null } {
    const previous = issued.get(request.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new ApiError(409, 'This request id was already used for a different request', {
          code: 'idempotency-conflict',
        });
      }
      const found = apiKeys.find((k) => k.id === previous.keyId);
      if (!found) throw new ApiError(404, 'API key not found', { code: 'not-found' });
      return { key: apiKeySummary(found), secret: null };
    }
    const result = apply();
    issued.set(request.requestId, { fingerprint, keyId: result.key.id });
    if (issued.size > ISSUED_LIMIT) issued.delete(issued.keys().next().value as string);
    return result;
  }
  const authDraft = (a: StoredAuth) => ({
    provider: a.provider,
    enabled: a.enabled,
    baseUrl: a.baseUrl,
    userName: a.userName,
    password: '',
    hasPassword: a.password !== '',
    accessId: a.accessId,
    uuid: a.uuid,
  });
  const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

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
  // One caller in the mock, so one rate limit and lockout for every PIN test.
  const pinGuard = createPinGuard(
    MOCK_PIN_HOLDERS,
    now,
    undefined,
    // A holder in a permission set counts only while the saved set allows PIN override and grants the
    // permission (ticket 186); the Administrator (no set) always counts.
    (holder) => {
      if (!holder.permissionSetId) return holder.grant;
      const set = permissionSets.find((s) => s.id === holder.permissionSetId);
      return set?.pinOverride ? { role: set.name, permissions: grantFromSet(set) } : null;
    },
  );
  const checkInEnv = () => ({
    now: now(),
    // The mock's "today" is configured; only the time of day follows the club's real clock.
    clock: { date: schedule.today, time: clubClock(systemSettings.timeZone, now()).time },
    checkOutTime: systemSettings.checkOutTime,
    level: checkInLevel(permissionsFromGrant(currentGrant()).can),
    checkPin: (pin: string) => pinGuard.check(CHECK_IN_ANY_TIME_PERMISSION, pin),
  });

  const client: ApiClient = {
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
            return buildQuickStats(
              query,
              rateCategories.map((c) => ({ id: c.id, name: c.name })),
            );
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
            if (!permissionsFromGrant(currentGrant()).can(RESERVATION_EDIT_PERMISSION)) {
              throw new ApiError(403, 'You may not change this reservation', { code: 'forbidden' });
            }
            // The override PINs are never kept: the replay fingerprint holds only hashes of them.
            const { overrideCodes, ...rest } = request;
            const fingerprint = {
              ...rest,
              overrideCodeHashes: Object.fromEntries(
                Object.entries(overrideCodes ?? {}).map(([field, code]) => [field, hashCode(code)]),
              ),
            };
            return replayable(fingerprint, () =>
              changeRoomDuringStay(schedule, request, roomChangeRule, (fields) => {
                // A field whose function the user lacks needs the PIN of someone who holds it.
                for (const field of missingFields(
                  fields,
                  permissionsFromGrant(currentGrant()).can,
                )) {
                  const code = overrideCodes?.[field];
                  if (!code) {
                    throw new ApiError(403, 'An override code is needed to change this', {
                      code: 'override-required',
                    });
                  }
                  const pin = pinGuard.check(UNLOCK_PERMISSION[field], code);
                  if (pin.kind === 'locked') {
                    throw new ApiError(429, 'Too many wrong override PINs; try again later', {
                      code: 'override-locked',
                      details: { retryAfterSeconds: [String(pin.retryAfterSeconds)] },
                    });
                  }
                  if (pin.kind !== 'valid') {
                    throw new ApiError(403, 'That override code is not valid', {
                      code: 'override-invalid',
                    });
                  }
                }
              }),
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
            // The saved room order (Rooms setup) decides the order of the rows.
            data.rooms = orderScheduleRooms(
              data.rooms,
              rooms.map((r) => r.name),
            );
            const featureIds = new Set(roomOptions.features.map((f) => f.id));
            return structuredClone({
              ...data,
              features: roomOptions.features.map((f) => ({ id: f.id, name: f.label })),
              rooms: data.rooms.map((r) =>
                r.featureIds
                  ? { ...r, featureIds: r.featureIds.filter((f) => featureIds.has(f)) }
                  : r,
              ),
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
              features: [],
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
    employees: {
      list: (o) =>
        respond(
          () => structuredClone(employees),
          () => [],
          o,
        ),
      listCandidates: (o) =>
        respond(
          () =>
            directory.filter((p) => !employees.some((e) => e.id === p.id)).map((p) => ({ ...p })),
          () => [],
          o,
        ),
      save: (input, o) =>
        respond(
          () => {
            // Only an administrator changes employees (and so permissions): nobody edits their own.
            if (!permissionsFromGrant(currentGrant()).can(ADMIN_PERMISSION)) {
              throw new ApiError(403, 'Only an administrator may change employees', {
                code: 'forbidden',
              });
            }
            const person = directory.find((p) => p.id === input.id);
            const setOk =
              input.permissionSetId === null
                ? !needsPermissionSet(input.role)
                : needsPermissionSet(input.role) &&
                  permissionSets.some((s) => s.id === input.permissionSetId);
            if (!person || !isEmployeeRole(input.role) || !setOk) {
              throw new ApiError(422, 'Employee is not valid', { code: 'validation' });
            }
            if (lastAdministratorProblem(employees, input.id, input)) {
              throw new ApiError(409, 'The club needs an active administrator', {
                code: 'last-administrator',
              });
            }
            const stored = {
              id: person.id,
              name: person.label,
              role: input.role,
              permissionSetId: input.permissionSetId,
              active: input.active,
            };
            // A replace of this person's assignment: repeating the save changes nothing.
            employees = employees.some((e) => e.id === input.id)
              ? employees.map((e) => (e.id === input.id ? stored : e))
              : [...employees, stored];
            return { ...stored };
          },
          () => ({ name: '', ...input }),
          o,
        ),
      saveRoles: (inputs, o) =>
        respond(
          () => {
            // Only an administrator changes employees (and so permissions): nobody edits their own.
            if (!permissionsFromGrant(currentGrant()).can(ADMIN_PERMISSION)) {
              throw new ApiError(403, 'Only an administrator may change employees', {
                code: 'forbidden',
              });
            }
            const ids = inputs.map((i) => i.id);
            if (
              inputs.length === 0 ||
              new Set(ids).size !== ids.length ||
              inputs.some((i) => !isEmployeeRole(i.role) || !directory.some((p) => p.id === i.id))
            ) {
              throw new ApiError(422, 'Employees are not valid', { code: 'validation' });
            }
            // All or nothing: the whole list is built first, then the administrator rule is checked.
            // The legacy screen has no permission set, so keep the data consistent for the extended
            // variant: an administrator has none, a manager or staff without one gets the set of that type.
            const setFor = (role: EmployeeSetup['role'], current: string | null | undefined) =>
              role === 'administrator'
                ? null
                : (current ??
                  permissionSets.find((s) => s.id === (role === 'manager' ? 'management' : 'staff'))
                    ?.id ??
                  null);
            const next: EmployeeSetup[] = [
              ...employees.map((e) => {
                const change = inputs.find((i) => i.id === e.id);
                if (!change) return e;
                return {
                  ...e,
                  role: change.role,
                  permissionSetId: setFor(change.role, e.permissionSetId),
                };
              }),
              ...inputs
                .filter((i) => !employees.some((e) => e.id === i.id))
                .map((i) => ({
                  id: i.id,
                  name: directory.find((p) => p.id === i.id)?.label ?? '',
                  role: i.role,
                  permissionSetId: setFor(i.role, undefined),
                })),
            ];
            const hadAdmin = employees.some(
              (e) => e.active !== false && e.role === 'administrator',
            );
            if (hadAdmin && !next.some((e) => e.active !== false && e.role === 'administrator')) {
              throw new ApiError(409, 'The club needs an active administrator', {
                code: 'last-administrator',
              });
            }
            employees = next;
            return structuredClone(employees);
          },
          () => [],
          o,
        ),
      remove: (id, o) =>
        respond(
          () => {
            // Only an administrator changes employees (and so permissions): nobody edits their own.
            if (!permissionsFromGrant(currentGrant()).can(ADMIN_PERMISSION)) {
              throw new ApiError(403, 'Only an administrator may change employees', {
                code: 'forbidden',
              });
            }
            if (!employees.some((e) => e.id === id)) {
              throw new ApiError(404, 'Employee not found', { code: 'not-found' });
            }
            if (lastAdministratorProblem(employees, id, null)) {
              throw new ApiError(409, 'The club needs an active administrator', {
                code: 'last-administrator',
              });
            }
            employees = employees.filter((e) => e.id !== id);
          },
          () => undefined,
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
            if (!permissionsFromGrant(currentGrant()).can(LOCATIONS_EDIT_PERMISSION)) {
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
            const errors = validateSystemSettings(settings, {
              rateCategoryIds: new Set(rateCategories.map((c) => c.id)),
              memberTypeIds: new Set(MOCK_BOOKING_RULES_OPTIONS.memberTypes.map((m) => m.id)),
            });
            const house = settings.houseAccount;
            if (house && !MOCK_HOUSE_ACCOUNTS.some((a) => a.id === house.id)) {
              throw new ApiError(422, 'House account not found', { code: 'unknown-house-account' });
            }
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
          () => systemSettingsOptions(),
          () => systemSettingsOptions(),
          o,
        ),
      listHouseAccounts: (query, o) =>
        respond(
          () => searchHouseAccounts(query),
          () => [],
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
          () =>
            structuredClone({
              ...MOCK_ROOM_SETUP_OPTIONS,
              features: roomOptions.features,
              bedSizes: roomOptions.bedSizes,
            }),
          () => structuredClone({ ...MOCK_ROOM_SETUP_OPTIONS, features: [], bedSizes: [] }),
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
            assertKnownOptions(input.details);
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
            if (!input.inheritDetails) assertKnownOptions(input.details);
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
      saveRoomOrder: (roomIds, o) =>
        respond(
          () => {
            assertRoomOrder(roomIds);
            const unknown = roomIds.find((id) => !rooms.some((r) => r.id === id));
            if (unknown !== undefined) {
              throw new ApiError(404, 'Room not found', { code: 'not-found' });
            }
            rooms = applyRoomOrder(rooms, roomIds);
            return structuredClone(rooms);
          },
          () => [],
          o,
        ),
    },
    photos: {
      // Stores metadata only (no file bytes), and re-checks the rules like the backend would.
      upload: (request, o) => {
        const store = () => {
          const { accepted, errors } = acceptPhotoFiles(request.files, request.existingCount);
          if (errors.length > 0 || request.files.length === 0) {
            throw new ApiError(422, 'Photos are not valid', {
              code: 'validation',
              details: { photos: errors },
            });
          }
          return accepted.map((f) => ({
            id: newRequestId(),
            name: storedPhotoName(f.name),
            url: '',
          }));
        };
        return respond(store, store, o);
      },
    },
    roomOptions: {
      get: (o) =>
        respond(
          () => structuredClone(roomOptions),
          () => ({ features: [], bedSizes: [], version: 'ro-0' }),
          o,
        ),
      save: (request, o) =>
        respond(
          () =>
            replayable(request, () => {
              const errors = validateRoomOptions(request);
              if (hasOptionErrors(errors)) {
                throw new ApiError(422, 'Room options are not valid', {
                  code: 'validation',
                  details: {
                    features: errors.features.filter((e): e is string => e !== undefined),
                    bedSizes: errors.bedSizes.filter((e): e is string => e !== undefined),
                  },
                });
              }
              if (request.version !== roomOptions.version) {
                throw new ApiError(409, 'The Room Options changed since they were loaded', {
                  code: 'stale',
                });
              }
              const kinds: RoomOptionKind[] = ['features', 'bedSizes'];
              const inUse: Record<string, string[]> = {};
              for (const kind of kinds) {
                const known = new Set(roomOptions[kind].map((i) => i.id));
                if (request[kind].some((i) => i.id !== undefined && !known.has(i.id))) {
                  throw new ApiError(404, 'Room option not found', { code: 'not-found' });
                }
                const used = removedIds(roomOptions[kind], request[kind]).filter((id) => {
                  const usage = optionUsage(kind, id, roomTypes, rooms);
                  return usage.roomTypes.length + usage.rooms.length > 0;
                });
                if (used.length > 0) inUse[kind] = used;
              }
              if (Object.keys(inUse).length > 0) {
                throw new ApiError(409, 'A removed Feature or Bed Size is still in use', {
                  code: 'in-use',
                  details: inUse,
                });
              }
              const next = {} as Omit<typeof roomOptions, 'version'>;
              for (const kind of kinds) {
                const prefix = kind === 'features' ? 'feature-new' : 'bed-new';
                next[kind] = request[kind].map((i) => ({
                  id: i.id ?? `${prefix}-${nextOptionId++}`,
                  label: normalizeLabel(i.label),
                }));
              }
              // A removed Bed Size is no longer a key of any room's counts.
              const goneBeds = removedIds(roomOptions.bedSizes, request.bedSizes);
              if (goneBeds.length > 0) {
                const prune = <T extends { details: { bedTypes: Record<string, number> } }>(
                  x: T,
                ): T => ({
                  ...x,
                  details: {
                    ...x.details,
                    bedTypes: Object.fromEntries(
                      Object.entries(x.details.bedTypes).filter(([id]) => !goneBeds.includes(id)),
                    ),
                  },
                });
                roomTypes = roomTypes.map(prune);
                rooms = rooms.map(prune);
              }
              optionsVersion += 1;
              roomOptions = { ...next, version: `ro-${optionsVersion}` };
              return structuredClone(roomOptions);
            }),
          () => ({
            version: 'ro-0',
            features: request.features.map((i, n) => ({
              id: i.id ?? `feature-new-${n}`,
              label: i.label,
            })),
            bedSizes: request.bedSizes.map((i, n) => ({
              id: i.id ?? `bed-new-${n}`,
              label: i.label,
            })),
          }),
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
    rateCategories: {
      getOptions: (o) =>
        respond(
          () => mockRateCategoryOptions(roomTypes.map((t) => ({ id: t.id, label: t.name }))),
          () => mockRateCategoryOptions([]),
          o,
        ),
      list: (o) =>
        respond(
          () => structuredClone(rateCategories),
          () => [],
          o,
        ),
      save: (input, o) =>
        respond(
          () => {
            const create = () => {
              const known = mockRateCategoryOptions(
                roomTypes.map((t) => ({ id: t.id, label: t.name })),
              );
              if (isNameTaken(input.name, rateCategories, input.id)) {
                throw new ApiError(409, 'A rate category with this name exists', {
                  code: 'duplicate-name',
                });
              }
              if (
                hasErrors(validateRateCategory(input, [], known.skus)) ||
                !seasonSkuShapesValid(input.seasons) ||
                input.roomTypeIds.some((id) => !known.roomTypes.some((k) => k.id === id))
              ) {
                throw new ApiError(422, 'Rate category is not valid', { code: 'validation' });
              }
              const current = input.id ? rateCategories.find((c) => c.id === input.id) : undefined;
              if (input.id && !current) {
                throw new ApiError(404, 'Rate category not found', { code: 'not-found' });
              }
              const rest = normalizeRateCategory(input);
              const id = input.id ?? `rc-new-${nextSetupId++}`;
              const saved = {
                ...structuredClone(rest),
                id,
                reservationCount: current?.reservationCount ?? 0,
                settingNames: current?.settingNames ?? [],
              };
              rateCategories = input.id
                ? rateCategories.map((c) => (c.id === id ? saved : c))
                : [...rateCategories, saved];
              return structuredClone(saved);
            };
            // A retried create (same request id) returns the first result instead of a second category.
            return !input.id && input.requestId
              ? replayable({ ...input, requestId: input.requestId }, create)
              : create();
          },
          () => ({
            ...structuredClone(normalizeRateCategory(input)),
            id: input.id ?? 'rc-new',
            reservationCount: 0,
            settingNames: [],
          }),
          o,
        ),
      duplicate: (request, o) =>
        respond(
          () =>
            replayable(request, () => {
              const source = rateCategories.find((c) => c.id === request.sourceId);
              if (!source)
                throw new ApiError(404, 'Rate category not found', { code: 'not-found' });
              const problem = duplicateNameError(request.name, rateCategories);
              if (problem) {
                throw new ApiError(isNameTaken(request.name, rateCategories) ? 409 : 422, problem, {
                  code: isNameTaken(request.name, rateCategories) ? 'duplicate-name' : 'validation',
                });
              }
              const id = `rc-new-${nextSetupId++}`;
              const copy = {
                ...structuredClone(source),
                id,
                name: request.name.trim(),
                reservationCount: 0,
                settingNames: [],
                seasons: source.seasons.map((s) => ({
                  ...structuredClone(s),
                  id: `${id}-${s.id}`,
                })),
              };
              rateCategories = [...rateCategories, copy];
              return structuredClone(copy);
            }),
          () => {
            throw new ApiError(404, 'Rate category not found', { code: 'not-found' });
          },
          o,
        ),
      delete: (id, o) =>
        respond(
          () => {
            const found = rateCategories.find((c) => c.id === id);
            if (!found) throw new ApiError(404, 'Rate category not found', { code: 'not-found' });
            if (found.reservationCount > 0 || found.settingNames.length > 0) {
              throw new ApiError(409, 'Rate category is in use', { code: 'in-use' });
            }
            rateCategories = rateCategories.filter((c) => c.id !== id);
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
    integrations: {
      listApiKeys: (o) =>
        respond(
          () => apiKeys.map(apiKeySummary),
          () => [],
          o,
        ),
      createApiKey: (request, o) =>
        respond(
          () =>
            issue(request, `create:${normalizeKeyName(request.name).toLowerCase()}`, () => {
              const message = validateKeyName(
                request.name,
                apiKeys.map((k) => k.name),
              );
              if (message === 'A key with this name already exists.') {
                throw new ApiError(409, 'Key name in use', { code: 'duplicate' });
              }
              if (message) {
                throw new ApiError(422, 'Key name is not valid', {
                  code: 'validation',
                  details: { name: [message] },
                });
              }
              const stored = {
                id: `key-${nextApiKeyId++}`,
                name: normalizeKeyName(request.name),
                secret: generateApiKeySecret(randomBytes),
                createdAt: today,
              };
              apiKeys = [...apiKeys, stored];
              return { key: apiKeySummary(stored), secret: stored.secret };
            }),
          () => {
            throw new ApiError(404, 'API key not found', { code: 'not-found' });
          },
          o,
        ),
      rotateApiKey: (request, o) =>
        respond(
          () =>
            issue(request, `rotate:${request.id}`, () => {
              const found = apiKeys.find((k) => k.id === request.id);
              if (!found) throw new ApiError(404, 'API key not found', { code: 'not-found' });
              forgetIssued(found.id);
              const next = { ...found, secret: generateApiKeySecret(randomBytes) };
              apiKeys = apiKeys.map((k) => (k.id === found.id ? next : k));
              return { key: apiKeySummary(next), secret: next.secret };
            }),
          () => {
            throw new ApiError(404, 'API key not found', { code: 'not-found' });
          },
          o,
        ),
      revokeApiKey: (id, o) =>
        respond(
          () => {
            if (!apiKeys.some((k) => k.id === id)) {
              throw new ApiError(404, 'API key not found', { code: 'not-found' });
            }
            apiKeys = apiKeys.filter((k) => k.id !== id);
            forgetIssued(id);
          },
          () => undefined,
          o,
        ),
      listPayCloudTokens: (o) =>
        respond(
          () => payCloudTokens.map(payCloudSummary),
          () => [],
          o,
        ),
      savePayCloudTokens: (tokens, o) =>
        respond(
          () => {
            const next = tokens.map((t) => {
              const existing = t.id ? payCloudTokens.find((x) => x.id === t.id) : undefined;
              if (t.id && !existing) {
                throw new ApiError(404, 'PayCloud token not found', { code: 'not-found' });
              }
              const apiKey = t.apiKey ?? existing?.apiKey ?? '';
              const bad = validatePayCloudKey({
                id: t.id ?? '',
                apiKey,
                environment: t.environment,
                replacing: true,
              });
              if (bad || !['local', 'test', 'staging', 'production'].includes(t.environment)) {
                throw new ApiError(422, 'PayCloud token is not valid', { code: 'validation' });
              }
              return {
                id: existing?.id ?? `paycloud-${nextPayCloudId++}`,
                apiKey,
                environment: t.environment,
              };
            });
            payCloudTokens = next;
            return payCloudTokens.map(payCloudSummary);
          },
          () => [],
          o,
        ),
      listAuthentications: (o) =>
        respond(
          () => auths.map(authSummary),
          () => auths.map(authSummary),
          o,
        ),
      saveAuthentications: (inputs, o) =>
        respond(
          () => {
            const next = auths.map((stored) => {
              const input = inputs.find((i) => i.provider === stored.provider);
              if (!input) return stored;
              const merged = mergeAuth(stored, input);
              const errors = validateAuth(
                { ...authDraft(merged), password: input.password ?? '' },
                { saved: authDraft(stored) },
              );
              if (Object.keys(errors).length > 0) {
                throw new ApiError(422, 'Authentication is not valid', {
                  code: 'validation',
                  details: Object.fromEntries(
                    Object.entries(errors).map(([field, message]) => [field, [message]]),
                  ),
                });
              }
              return merged;
            });
            auths = next;
            return {
              authentications: auths.map(authSummary),
              tests: auths
                .filter((a) => a.enabled)
                .map((a) => ({
                  provider: a.provider,
                  success: mockConnectionWorks(a.baseUrl, a.password !== ''),
                })),
            };
          },
          () => ({ authentications: auths.map(authSummary), tests: [] }),
          o,
        ),
      testConnection: (input, o) =>
        respond(
          () => {
            const stored = auths.find((a) => a.provider === input.provider);
            if (!stored) throw new ApiError(404, 'Integration not found', { code: 'not-found' });
            const merged = mergeAuth(stored, input);
            return {
              provider: input.provider,
              success: mockConnectionWorks(merged.baseUrl, merged.password !== ''),
            };
          },
          () => ({ provider: input.provider, success: false }),
          o,
        ),
    },
    overrides: {
      verifyPin: (request, o) =>
        respond(
          () => {
            assertVerifyOverridePinRequest(request);
            // Only a signed-in user who may check in (or edit a reservation, for the change
            // functions) may probe PINs.
            const mayProbe =
              request.permission === 'reservation.check-in.any-time'
                ? checkInEnv().level !== 'never'
                : canEditReservations();
            if (!mayProbe) {
              throw new ApiError(
                403,
                request.permission === 'reservation.check-in.any-time'
                  ? 'You may not check in'
                  : 'You may not change this reservation',
                { code: 'forbidden' },
              );
            }
            const check = pinGuard.check(request.permission, request.pin);
            if (check.kind === 'locked') {
              return { valid: false, lockedForSeconds: check.retryAfterSeconds };
            }
            return { valid: check.kind === 'valid' };
          },
          () => {
            assertVerifyOverridePinRequest(request);
            return { valid: false };
          },
          o,
        ),
    },
    permissions: {
      getGrant: (o) =>
        respond(
          () => structuredClone(currentGrant()),
          () => structuredClone(noGrant),
          o,
        ),
      listPermissionSets: (o) =>
        respond(
          () => {
            // Employees needs the list without `permissions.edit`: any user who may open Employees
            // or Permissions (or an administrator) may read it.
            const can = permissionsFromGrant(currentGrant()).can;
            if (!can(ADMIN_PERMISSION) && !can('page.employees') && !can('page.permissions')) {
              throw new ApiError(403, 'You may not read permission sets', { code: 'forbidden' });
            }
            return summarizeSets(permissionSets);
          },
          () => summarizeSets([]),
          o,
        ),
      getPermissionSets: (o) =>
        respond(
          () => {
            const can = permissionsFromGrant(currentGrant()).can;
            if (!can(ADMIN_PERMISSION) && !can('page.permissions')) {
              throw new ApiError(403, 'You may not read permissions', { code: 'forbidden' });
            }
            return structuredClone(permissionSets);
          },
          () => [],
          o,
        ),
      savePermissionSets: (sets, o) =>
        respond(
          () => {
            // Only an administrator changes permissions: a set can never grant more than its editor holds.
            if (!permissionsFromGrant(currentGrant()).can(ADMIN_PERMISSION)) {
              throw new ApiError(403, 'You may not change permissions', { code: 'forbidden' });
            }
            // Like the backend: only the existing editable sets, each valid.
            if (
              validateSets(sets).length > 0 ||
              sets.some((s) => !permissionSets.some((p) => p.id === s.id))
            ) {
              throw new ApiError(422, 'Permission sets are not valid', { code: 'validation' });
            }
            // A replace: the stored list is exactly what was sent (the names stay as they were).
            permissionSets = sets.map((next) =>
              normalizeSet({
                ...next,
                name: permissionSets.find((p) => p.id === next.id)?.name ?? next.name,
              }),
            );
            permissionSetsStore?.save(structuredClone(permissionSets));
            return structuredClone(permissionSets);
          },
          () => [],
          o,
        ),
    },
  };
  return guardAdminWrites(client, () => permissionsFromGrant(currentGrant()).can);
}

// The Admin Setup writes a View-only user must be refused (ticket 186): like the backend, each needs
// `admin` or `<page>.edit`. Locations and Employees check inside their own methods.
const ADMIN_WRITES: readonly [keyof ApiClient, readonly string[], AdminPageId][] = [
  ['roomSetup', ['saveRoomType', 'deleteRoomType'], 'room-types'],
  ['roomSetup', ['saveRoom', 'deleteRoom', 'saveRoomOrder'], 'rooms'],
  ['roomOptions', ['save'], 'room-options'],
  ['addOns', ['save', 'delete'], 'add-on-items'],
  ['rateCategories', ['save', 'duplicate', 'delete'], 'rate-categories'],
  ['bookingRules', ['save'], 'booking-rules'],
  ['systemSettings', ['save'], 'primary-setup'],
  ['keycards', ['saveEncoders', 'retrieveEncoders'], 'keycard-integration'],
];

// API Integrations hold secrets, so every method (reads of nothing secret excepted) needs `admin`
// itself: `api-integrations.edit` grants nothing (Q-188-2). Test Connection sends a saved password
// to a host, so it is guarded like a write.
const ADMIN_ONLY: readonly [keyof ApiClient, readonly string[]][] = [
  [
    'integrations',
    [
      'createApiKey',
      'rotateApiKey',
      'revokeApiKey',
      'savePayCloudTokens',
      'saveAuthentications',
      'testConnection',
    ],
  ],
];

function guardAdminWrites(client: ApiClient, can: () => Permissions['can']): ApiClient {
  for (const [area, methods] of ADMIN_ONLY) {
    const target = client[area] as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const name of methods) {
      const original = target[name];
      target[name] = (...args: unknown[]) =>
        can()(ADMIN_PERMISSION)
          ? original(...args)
          : Promise.reject(
              new ApiError(403, 'Only administrators may change API integrations', {
                code: 'forbidden',
              }),
            );
    }
  }
  for (const [area, methods, page] of ADMIN_WRITES) {
    const target = client[area] as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const name of methods) {
      const original = target[name];
      if (!original) continue;
      target[name] = (...args: unknown[]) =>
        can()(ADMIN_PERMISSION) || can()(adminEditPermission(page))
          ? original(...args)
          : Promise.reject(new ApiError(403, `You may not change ${page}`, { code: 'forbidden' }));
    }
  }
  return client;
}
