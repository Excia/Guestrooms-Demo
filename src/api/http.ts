import type {
  ApiClient,
  BookingHold,
  CancelReservationRequest,
  UndoCheckInRequest,
  ChangeRoomRequest,
  ChangeRoomResult,
  CreateMemberRequest,
  CustomReportSummary,
  Member,
  MemberQuery,
  CreateReservationRequest,
  DashboardStats,
  EarlyLateRequest,
  EarlyLateResult,
  Folio,
  PostChargeRequest,
  ReservationDetail,
  Page,
  PermissionGrant,
  QuickStats,
  QuickStatsQuery,
  Reservation,
  ReservationQuery,
  RequestOptions,
  RoomChangeRule,
  MoveDatesRequest,
  MoveRoomRequest,
  ScheduleBlock,
  ScheduleData,
  ScheduleMoveResult,
  ScheduleQuery,
  AddOnOptions,
  AddOnSetup,
  SetHousekeepingRequest,
  RoomSetup,
  RoomSetupOptions,
  RoomTypeSetup,
  BookingRules,
  BookingRulesOptions,
  SystemSettings,
  SystemSettingsOptions,
} from './types';
import { normalizeRuns } from '../lib/stayPlan';
import { expectedLeadOccupantName } from './createRules';
import { listParams, parseCheckIn, parseListOptions, parseListPage } from './httpReservationList';
import type { CheckInRoomRequest } from './reservationListTypes';
import { ApiError, SETTABLE_HOUSEKEEPING_STATUSES } from './types';
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
  assertSetHousekeepingRequest,
} from './validation';
import { assertCancelReservationRequest, assertUndoCheckInRequest } from './reservationMenuApi';
import { parseIsoDate } from '../lib/dates';

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

const isFlag = (v: unknown): v is boolean => typeof v === 'boolean';
const ROOM_STATUSES: readonly string[] = ['nyci', 'checked-in', 'checked-out'];

const isPartialStays = (v: unknown) =>
  v === undefined ||
  listOf(
    v,
    (p) =>
      isObject(p) &&
      isString(p.roomId) &&
      (p.roomNumber === null || isString(p.roomNumber)) &&
      isString(p.arrival) &&
      isString(p.departure),
  );

// Light shape guard on what the details panel reads. A mismatch is an invalid-response error.
function isReservationDetail(v: unknown): v is ReservationDetail {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.confirmationNumber) &&
    isString(v.status) &&
    STATUSES.includes(v.status) &&
    isString(v.arrival) &&
    isString(v.departure) &&
    isCount(v.nights) &&
    isCount(v.adults) &&
    isCount(v.children) &&
    isObject(v.leadOccupant) &&
    isString(v.leadOccupant.name) &&
    isString(v.leadOccupant.guestType) &&
    GUEST_TYPES.includes(v.leadOccupant.guestType) &&
    (v.leadOccupant.memberNumber === null || isString(v.leadOccupant.memberNumber)) &&
    listOf(
      v.rooms,
      (r) =>
        isObject(r) &&
        isString(r.id) &&
        (r.roomId === null || isString(r.roomId)) &&
        (r.roomNumber === null || isString(r.roomNumber)) &&
        (r.locationName === null || isString(r.locationName)) &&
        (r.roomTypeName === null || isString(r.roomTypeName)) &&
        isString(r.arrival) &&
        isString(r.departure) &&
        isString(r.status) &&
        ROOM_STATUSES.includes(r.status) &&
        isPartialStays(r.previousStays) &&
        isPartialStays(r.upcomingStays),
    ) &&
    (v.rooms as unknown[]).length >= 1 &&
    isFlag(v.earlyCheckIn) &&
    isFlag(v.lateCheckOut) &&
    listOf(
      v.addOns,
      (a) =>
        isObject(a) &&
        isString(a.id) &&
        isString(a.name) &&
        isCount(a.quantity) &&
        isCount(a.priceCents),
    ) &&
    isString(v.publicNotes) &&
    isString(v.privateNotes) &&
    isObject(v.stay) &&
    isCount(v.stay.folioTotalCents) &&
    listOf(
      v.stay.lines,
      (l) =>
        isObject(l) &&
        isString(l.roomType) &&
        isString(l.date) &&
        isCount(l.amountCents) &&
        isString(l.reservationRoomId) &&
        l.reservationRoomId !== '',
    ) &&
    isString(v.version) &&
    v.version !== '' &&
    (v.lastAuditedDate === undefined ||
      v.lastAuditedDate === null ||
      isString(v.lastAuditedDate)) &&
    (v.folioCharges === undefined ||
      listOf(
        v.folioCharges,
        (c) =>
          isObject(c) &&
          isString(c.type) &&
          CHARGE_TYPES.includes(c.type) &&
          isString(c.status) &&
          CHARGE_STATUSES.includes(c.status),
      ))
  );
}

const CHECK_IN_STATUSES: readonly string[] = ['not-checked-in', 'checked-in', 'checked-out'];
const CHARGE_TYPES: readonly string[] = [
  'room-rate',
  'mpos',
  'manual',
  'add-on',
  'surcharge',
  'service-fee',
  'split-parent',
  'split-child',
];
const CHARGE_STATUSES: readonly string[] = ['posted', 'unposted', 'settled', 'split'];
const isNullableString = (v: unknown) => v === null || isString(v);

// Light shape guard on what the folio screen reads.
function isFolio(v: unknown): v is Folio {
  return (
    isObject(v) &&
    isString(v.reservationId) &&
    isString(v.confirmationNumber) &&
    isString(v.checkInStatus) &&
    CHECK_IN_STATUSES.includes(v.checkInStatus) &&
    isFlag(v.open) &&
    isFlag(v.mposVisible) &&
    isCount(v.nights) &&
    isCount(v.guests) &&
    listOf(v.rooms, (r) => isObject(r) && isString(r.id) && isNullableString(r.number)) &&
    listOf(
      v.occupants,
      (o) => isObject(o) && isString(o.id) && isString(o.name) && isString(o.roomId),
    ) &&
    listOf(
      v.charges,
      (c) =>
        isObject(c) &&
        isString(c.id) &&
        isString(c.type) &&
        CHARGE_TYPES.includes(c.type) &&
        isString(c.date) &&
        isString(c.description) &&
        isCount(c.amountCents) &&
        isString(c.status) &&
        CHARGE_STATUSES.includes(c.status) &&
        Array.isArray(c.references) &&
        c.references.every(isString) &&
        isNullableString(c.roomId) &&
        isNullableString(c.occupantId),
    ) &&
    listOf(
      v.payments,
      (p) =>
        isObject(p) &&
        isString(p.id) &&
        isString(p.typeLabel) &&
        isString(p.date) &&
        isString(p.reference) &&
        isNullableString(p.ticket) &&
        isString(p.description) &&
        isCount(p.amountCents) &&
        isString(p.status),
    )
  );
}

// The answer must be for the reservation that was asked for.
const parseFolio =
  (reservationId: string) =>
  (body: unknown, status: number): Folio => {
    if (!isFolio(body) || body.reservationId !== reservationId) throw invalid(status, 'folio');
    return body;
  };

// A malformed `lastAuditedDate` is treated as unknown (absent): Undo Check In stays hidden.
function withKnownAudit(detail: ReservationDetail): ReservationDetail {
  const date = detail.lastAuditedDate;
  if (typeof date === 'string' && parseIsoDate(date) === null) {
    const rest = { ...detail };
    delete rest.lastAuditedDate;
    return rest;
  }
  return detail;
}

// The answer must be for the reservation that was asked for.
const parseDetail =
  (id: string) =>
  (body: unknown, status: number): ReservationDetail => {
    if (!isReservationDetail(body) || body.id !== id) throw invalid(status, 'reservation detail');
    return withKnownAudit(body);
  };

// The answer must carry the flags the request asked for (a changed flag that did not stick is a
// failed save, not a success) and a new version.
const parseEarlyLate =
  (request: EarlyLateRequest) =>
  (body: unknown, status: number): EarlyLateResult => {
    if (
      !isObject(body) ||
      !isFlag(body.earlyCheckIn) ||
      !isFlag(body.lateCheckOut) ||
      !isString(body.version) ||
      body.version === '' ||
      (request.earlyCheckIn !== undefined && body.earlyCheckIn !== request.earlyCheckIn) ||
      (request.lateCheckOut !== undefined && body.lateCheckOut !== request.lateCheckOut)
    ) {
      throw invalid(status, 'early/late');
    }
    return body as unknown as EarlyLateResult;
  };

// The cancel answer is the reservation, and it must say it is cancelled.
const parseCancelled =
  (request: CancelReservationRequest) =>
  (body: unknown, status: number): ReservationDetail => {
    if (
      !isReservationDetail(body) ||
      body.id !== request.reservationId ||
      body.status !== 'cancelled'
    ) {
      throw invalid(status, 'cancelled reservation');
    }
    return withKnownAudit(body);
  };

const parseCreated =
  (request: CreateReservationRequest) =>
  (body: unknown, status: number): ReservationDetail => {
    if (!isReservationDetail(body)) throw invalid(status, 'created reservation');
    const detail = body;
    if (
      detail.adults !== request.adults ||
      detail.children !== request.children ||
      detail.leadOccupant.name !== expectedLeadOccupantName(request) ||
      detail.rooms.length !== 1 ||
      detail.rooms[0].roomId !== (request.roomId ?? null) ||
      detail.arrival !== request.arrival ||
      detail.departure !== request.departure
    ) {
      throw invalid(status, 'created reservation');
    }
    return detail;
  };

const isMember = (v: unknown): v is Member =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.memberNumber) &&
  isString(v.name) &&
  isString(v.email) &&
  isString(v.phone);

function parseMembers(body: unknown, status: number): Page<Member> {
  if (
    !isObject(body) ||
    !Array.isArray(body.items) ||
    !body.items.every(isMember) ||
    !isCount(body.total) ||
    !(body.nextCursor === undefined || isString(body.nextCursor))
  ) {
    throw invalid(status, 'members');
  }
  return body as unknown as Page<Member>;
}

// The answer must be the person that was asked for.
const parseCreatedMember =
  (request: CreateMemberRequest) =>
  (body: unknown, status: number): Member => {
    if (!isMember(body) || body.name !== request.name.trim()) throw invalid(status, 'member');
    return body;
  };

const isHoldMinutes = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 99;

function parseBookingHold(body: unknown, status: number): BookingHold {
  if (
    !isObject(body) ||
    !isHoldMinutes(body.employee) ||
    !isHoldMinutes(body.member) ||
    !isHoldMinutes(body.nonMember)
  ) {
    throw invalid(status, 'booking hold');
  }
  return body as unknown as BookingHold;
}

function parseRoomChangeRule(body: unknown, status: number): RoomChangeRule {
  if (!isObject(body) || !isFlag(body.askRateOnRoomChange)) {
    throw invalid(status, 'room change rule');
  }
  return { askRateOnRoomChange: body.askRateOnRoomChange };
}

const isCustomReport = (v: unknown): v is CustomReportSummary =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.name) &&
  isString(v.creatorName) &&
  isString(v.updatedAt) &&
  !Number.isNaN(Date.parse(v.updatedAt));

function parseCustomReports(body: unknown, status: number): CustomReportSummary[] {
  if (!Array.isArray(body) || !body.every(isCustomReport)) throw invalid(status, 'custom reports');
  return body;
}

const isLookup = (v: unknown) => isObject(v) && isString(v.id) && isString(v.label);

const isOnlineBooking = (v: unknown) =>
  isObject(v) &&
  isString(v.globalMessage) &&
  isString(v.cancellationAgreement) &&
  isString(v.policyUrl) &&
  typeof v.includePolicyLink === 'boolean' &&
  typeof v.chargeCancellationFee === 'boolean' &&
  typeof v.showAddOnsPopup === 'boolean';

// Checks the shape the form relies on; the rules themselves are the backend's to enforce.
function parseSystemSettings(body: unknown, status: number): SystemSettings {
  if (
    !isObject(body) ||
    !isString(body.timeZone) ||
    !isString(body.checkInTime) ||
    !isString(body.checkOutTime) ||
    !isString(body.lateCheckOutTime) ||
    typeof body.earlyLateEnabled !== 'boolean' ||
    !isObject(body.mposVisibleBefore) ||
    !isObject(body.mposVisibleAfter) ||
    !isObject(body.closeSettledFolios) ||
    !isString(body.nightAuditRunTime) ||
    (body.nightAudit !== 'manual' && body.nightAudit !== 'automatic') ||
    !isObject(body.alternativeBaseRate1) ||
    !isObject(body.alternativeBaseRate2) ||
    !isString(body.serviceChargeLabel) ||
    !isObject(body.folio) ||
    !isOnlineBooking(body.onlineBooking) ||
    !(body.transferItem === null || isLookup(body.transferItem)) ||
    !(body.guestRoomsArea === null || isLookup(body.guestRoomsArea)) ||
    !(body.guestMember === null || isLookup(body.guestMember))
  ) {
    throw invalid(status, 'system settings');
  }
  return body as unknown as SystemSettings;
}

const isAudience = (v: unknown) => isObject(v) && isObject(v.opens) && isCount(v.holdMinutes);

// Checks the shape the form relies on; the rules themselves are the backend's to enforce.
function parseBookingRules(body: unknown, status: number): BookingRules {
  if (
    !isObject(body) ||
    !isAudience(body.employee) ||
    !(body.member === null || isAudience(body.member)) ||
    !(body.nonMember === null || isAudience(body.nonMember)) ||
    typeof body.uniqueMemberTypeRules !== 'boolean' ||
    !Array.isArray(body.memberTypeRules)
  ) {
    throw invalid(status, 'booking rules');
  }
  return body as unknown as BookingRules;
}

function parseBookingRulesOptions(body: unknown, status: number): BookingRulesOptions {
  if (!isObject(body) || !listOf(body.roomTypes, isLookup) || !listOf(body.memberTypes, isLookup)) {
    throw invalid(status, 'booking rules options');
  }
  return body as unknown as BookingRulesOptions;
}

function parseSystemSettingsOptions(body: unknown, status: number): SystemSettingsOptions {
  if (
    !isObject(body) ||
    !(['timeZones', 'cardReaders', 'items', 'areas', 'members'] as const).every((k) =>
      listOf(body[k], isLookup),
    )
  ) {
    throw invalid(status, 'system settings options');
  }
  return body as unknown as SystemSettingsOptions;
}

const isRoomDetails = (v: unknown) =>
  isObject(v) &&
  isCount(v.maxOccupancy) &&
  isObject(v.bedTypes) &&
  isString(v.description) &&
  Array.isArray(v.photos) &&
  Array.isArray(v.featureIds) &&
  Array.isArray(v.addOnIds);

const parseRoomSetupOptions = (body: unknown, status: number): RoomSetupOptions => {
  if (
    !isObject(body) ||
    !(['skus', 'features', 'addOns', 'bedSizes', 'members'] as const).every((k) =>
      listOf(body[k], isLookup),
    )
  ) {
    throw invalid(status, 'room setup options');
  }
  return body as unknown as RoomSetupOptions;
};

const isSetupItem = (v: unknown) =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.name) &&
  isString(v.startDate) &&
  isRoomDetails(v.details);

const parseRoomTypeSetup = (body: unknown, status: number): RoomTypeSetup => {
  if (!isSetupItem(body)) throw invalid(status, 'room type');
  return body as unknown as RoomTypeSetup;
};
const parseRoomTypeList = (body: unknown, status: number): RoomTypeSetup[] => {
  if (!Array.isArray(body) || !body.every(isSetupItem)) throw invalid(status, 'room types');
  return body as unknown as RoomTypeSetup[];
};
const parseRoomSetup = (body: unknown, status: number): RoomSetup => {
  if (!isSetupItem(body) || !Array.isArray((body as { linkedRoomIds?: unknown }).linkedRoomIds)) {
    throw invalid(status, 'room');
  }
  return body as unknown as RoomSetup;
};
const parseRoomList = (body: unknown, status: number): RoomSetup[] => {
  if (!Array.isArray(body)) throw invalid(status, 'rooms');
  body.forEach((room) => parseRoomSetup(room, status));
  return body as RoomSetup[];
};
const parseNothing = () => undefined;

const isAddOn = (v: unknown) =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.name) &&
  isString(v.startDate) &&
  (v.endDate === null || isString(v.endDate)) &&
  (v.sku === null || isLookup(v.sku)) &&
  typeof v.onlineBooking === 'boolean' &&
  isString(v.description) &&
  (v.kind === 'item' || v.kind === 'combo') &&
  typeof v.trackNightly === 'boolean' &&
  isCount(v.nightlyQty) &&
  Array.isArray(v.photos) &&
  Array.isArray(v.locationIds) &&
  Array.isArray(v.roomTypeIds);
const parseAddOn = (body: unknown, status: number): AddOnSetup => {
  if (!isAddOn(body)) throw invalid(status, 'add-on');
  return body as unknown as AddOnSetup;
};
const parseAddOnList = (body: unknown, status: number): AddOnSetup[] => {
  if (!Array.isArray(body) || !body.every(isAddOn)) throw invalid(status, 'add-ons');
  return body as unknown as AddOnSetup[];
};
const parseAddOnOptions = (body: unknown, status: number): AddOnOptions => {
  if (
    !isObject(body) ||
    !(['skus', 'locations', 'roomTypes'] as const).every((k) => listOf(body[k], isLookup))
  ) {
    throw invalid(status, 'add-on options');
  }
  return body as unknown as AddOnOptions;
};

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

const HOUSEKEEPING: readonly string[] = ['clean', 'dirty'];
const BLOCK_STATUSES: readonly string[] = ['confirmed', 'nyci', 'checked-in', 'checked-out'];
const GUEST_TYPES: readonly string[] = ['guest', 'member', 'owner', 'none'];
const HOUSEKEEPING_STATUSES: readonly string[] = [...SETTABLE_HOUSEKEEPING_STATUSES, 'nyci'];
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
    v.version !== '' &&
    (v.housekeeping === undefined ||
      (isString(v.housekeeping) && HOUSEKEEPING_STATUSES.includes(v.housekeeping))) &&
    (v.housekeepingNotes === undefined || isString(v.housekeepingNotes)) &&
    (v.linkedTo === undefined ||
      (isObject(v.linkedTo) &&
        isString(v.linkedTo.roomNumber) &&
        isString(v.linkedTo.reserverName) &&
        (v.linkedTo.multilinkageCount === undefined ||
          (Number.isInteger(v.linkedTo.multilinkageCount) &&
            (v.linkedTo.multilinkageCount as number) >= 0)))) &&
    (v.roomChange === undefined ||
      (isObject(v.roomChange) &&
        (v.roomChange.part === 'previous' ||
          v.roomChange.part === 'current' ||
          v.roomChange.part === 'next') &&
        Number.isInteger(v.roomChange.index) &&
        Number.isInteger(v.roomChange.count) &&
        (v.roomChange.index as number) >= 1 &&
        (v.roomChange.index as number) <= (v.roomChange.count as number) &&
        isString(v.roomChange.stayId) &&
        v.roomChange.stayId !== ''))
  );
}

// The answer must be for the query that was sent, and every block and closure must sit in a listed
// room (the grid indexes by room id). Unassigned blocks have no room, so they skip that check.
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
          isString(r.roomTypeId) &&
          (r.housekeeping === undefined || HOUSEKEEPING.includes(r.housekeeping as string)),
      ) &&
      listOf(body.blocks, isScheduleBlock) &&
      listOf(body.unassigned, isScheduleBlock) &&
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
      !unique([
        ...data.blocks.map((b) => b.id),
        ...data.unassigned.map((b) => b.id),
        ...data.closures.map((c) => c.id),
      ]) ||
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
      // A room-only move (no new dates) legitimately answers with just the moved block.
      if (rule.scope === 'all-rooms' && rule.shifted && group.length !== moved.roomCount) {
        throw invalid(status, 'move');
      }
      if (rule.scope === 'this-room' && rule.shifted && moved.roomCount !== 1) {
        throw invalid(status, 'move');
      }
    }
    return result;
  };

// The answer must describe the change that was asked for: the blocks of the stay are exactly the
// segments of the normalized plan. From the first remaining night on there is one block per run of
// the plan (the first, which keeps the request's id, may also hold earlier nights spent in the same
// room); stayed nights in another room are checked-out `previous` blocks that end where it begins
// and never share its room (runs in one room are merged). Several blocks are numbered 1..count and
// linked by `stayId`; a single block carries no `roomChange`. The vacated room (if any) is the room
// of the first night.
const parseChangeRoom =
  (request: ChangeRoomRequest) =>
  (body: unknown, status: number): ChangeRoomResult => {
    const bad = () => invalid(status, 'room change');
    if (
      !isObject(body) ||
      !listOf(body.blocks, isScheduleBlock) ||
      !listOf(body.removedBlockIds, isString) ||
      !isObject(body.folio) ||
      !Number.isInteger(body.folio.deltaCents) ||
      !Number.isInteger(body.folio.repricedNights) ||
      (body.folio.repricedNights as number) < 0 ||
      !Number.isInteger(body.folio.roomChargesCents) ||
      !(body.vacatedRoom === null || isObject(body.vacatedRoom))
    ) {
      throw bad();
    }
    const result = body as unknown as ChangeRoomResult;
    const first = request.nights[0];
    const vacated = result.vacatedRoom;
    if (
      vacated &&
      (vacated.roomId !== request.fromRoomId ||
        vacated.roomId === first.roomId ||
        !HOUSEKEEPING.includes(vacated.housekeeping) ||
        vacated.since !== first.date)
    ) {
      throw bad();
    }
    const ids = result.blocks.map((b) => b.id);
    const moved = result.blocks.find((b) => b.id === request.reservationRoomId);
    const sorted = [...result.blocks].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const before = sorted.filter((b) => b.roomChange?.part === 'previous');
    const after = sorted.filter((b) => b.roomChange?.part !== 'previous');
    const plan = normalizeRuns(request.nights);
    const single = sorted.length === 1;
    if (
      !moved ||
      new Set(ids).size !== ids.length ||
      result.removedBlockIds.some((id) => ids.includes(id)) ||
      sorted.some((b) => b.reservationId !== moved.reservationId) ||
      // one block has no link; several are numbered 1..count in date order and share the stay id
      (single
        ? moved.roomChange !== undefined
        : !sorted.every(
            (b, i) =>
              b.roomChange?.stayId === moved.id &&
              b.roomChange.index === i + 1 &&
              b.roomChange.count === sorted.length,
          )) ||
      // the stayed part comes first and ends where the rest begins, in another room
      sorted.slice(0, before.length).some((b) => b.roomChange?.part !== 'previous') ||
      before.some((b) => b.status !== 'checked-out') ||
      after.length === 0 ||
      (before.length > 0 &&
        (before[before.length - 1].endDate !== after[0].startDate ||
          before[before.length - 1].roomId === after[0].roomId)) ||
      // the rest equals the plan: the first run may start earlier (earlier nights in the same room)
      after.length !== plan.length ||
      !after.every(
        (b, i) =>
          b.roomId === plan[i].roomId &&
          b.endDate === plan[i].endDate &&
          (i === 0 ? b.startDate <= plan[0].startDate : b.startDate === plan[i].startDate) &&
          b.status === 'checked-in' &&
          (single || b.roomChange?.part === (i === 0 ? 'current' : 'next')),
      ) ||
      after[0].id !== request.reservationRoomId
    ) {
      throw bad();
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
    send?: { method: 'POST' | 'PUT' | 'DELETE'; body?: unknown; headers?: Record<string, string> },
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
        body: send?.body !== undefined ? JSON.stringify(send.body) : undefined,
        headers: {
          Accept: 'application/json',
          ...(send?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
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
      getDetail: (id, o) =>
        Promise.resolve().then(() => {
          assertResourceId(id, 'reservation');
          return request(`/reservations/${encodeURIComponent(id)}/detail`, {}, o, parseDetail(id));
        }),
      setEarlyLate: (r: EarlyLateRequest, o) =>
        Promise.resolve().then(() => {
          assertEarlyLateRequest(r);
          return request(
            `/reservations/${encodeURIComponent(r.reservationId)}/early-late`,
            {},
            o,
            parseEarlyLate(r),
            { method: 'POST', body: r, headers: { 'Idempotency-Key': r.requestId } },
          );
        }),
      create: (r: CreateReservationRequest, o) =>
        Promise.resolve().then(() => {
          assertCreateReservationRequest(r);
          return request('/reservations', {}, o, parseCreated(r), {
            method: 'POST',
            body: r,
            headers: { 'Idempotency-Key': r.requestId },
          });
        }),
      changeRoomDuringStay: (r: ChangeRoomRequest, o) =>
        Promise.resolve().then(() => {
          assertChangeRoomRequest(r);
          return request(
            `/reservation-rooms/${encodeURIComponent(r.reservationRoomId)}/change-room`,
            {},
            o,
            parseChangeRoom(r),
            { method: 'POST', body: r, headers: { 'Idempotency-Key': r.requestId } },
          );
        }),
      cancelReservation: (r: CancelReservationRequest, o) =>
        Promise.resolve().then(() => {
          assertCancelReservationRequest(r);
          return request(
            `/reservations/${encodeURIComponent(r.reservationId)}/cancel`,
            {},
            o,
            parseCancelled(r),
            { method: 'POST', body: r, headers: { 'Idempotency-Key': r.requestId } },
          );
        }),
      undoCheckIn: (r: UndoCheckInRequest, o) =>
        Promise.resolve().then(() => {
          assertUndoCheckInRequest(r);
          return request(
            `/reservations/${encodeURIComponent(r.reservationId)}/undo-check-in`,
            {},
            o,
            parseDetail(r.reservationId),
            { method: 'POST', body: r, headers: { 'Idempotency-Key': r.requestId } },
          );
        }),
    },
    reservationList: {
      list: (q = {}, o) =>
        Promise.resolve().then(() => {
          assertReservationListQuery(q);
          return request('/reservation-list', listParams(q), o, parseListPage);
        }),
      getOptions: (o) => request('/reservation-list/options', {}, o, parseListOptions),
      checkInRoom: (r: CheckInRoomRequest, o) =>
        Promise.resolve().then(() => {
          assertCheckInRoomRequest(r);
          return request(
            `/reservation-rooms/${encodeURIComponent(r.reservationRoomId)}/check-in`,
            {},
            o,
            parseCheckIn(r.reservationRoomId),
            { method: 'POST', body: {}, headers: { 'Idempotency-Key': r.requestId } },
          );
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
      setHousekeeping: (r: SetHousekeepingRequest, o) =>
        Promise.resolve().then(() => {
          assertSetHousekeepingRequest(r);
          return request(
            '/schedule/housekeeping',
            {},
            o,
            parseMove(
              r.reservationRoomId,
              (b) =>
                b.housekeeping === r.status &&
                (r.notes === undefined || (b.housekeepingNotes ?? '') === r.notes),
            ),
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
    members: {
      search: (q: MemberQuery = {}, o) =>
        Promise.resolve().then(() => {
          assertMemberQuery(q);
          return request(
            '/members',
            { q: q.q?.trim(), limit: q.limit === undefined ? undefined : String(q.limit) },
            o,
            parseMembers,
          );
        }),
      create: (r: CreateMemberRequest, o) =>
        Promise.resolve().then(() => {
          assertCreateMemberRequest(r);
          return request('/members', {}, o, parseCreatedMember(r), {
            method: 'POST',
            body: r,
            headers: { 'Idempotency-Key': r.requestId },
          });
        }),
    },
    folios: {
      get: (id, o) =>
        Promise.resolve().then(() => {
          assertResourceId(id, 'reservation');
          return request(`/reservations/${encodeURIComponent(id)}/folio`, {}, o, parseFolio(id));
        }),
      postCharge: (r: PostChargeRequest, o) =>
        Promise.resolve().then(() => {
          assertPostChargeRequest(r);
          return request(
            `/reservations/${encodeURIComponent(r.reservationId)}/folio/post`,
            {},
            o,
            parseFolio(r.reservationId),
            { method: 'POST', body: r, headers: { 'Idempotency-Key': r.requestId } },
          );
        }),
    },
    settings: {
      getBookingHold: (o) => request('/settings/booking-hold', {}, o, parseBookingHold),
      getRoomChangeRule: (o) => request('/settings/room-change-rule', {}, o, parseRoomChangeRule),
    },
    bookingRules: {
      get: (o) => request('/settings/booking-rules', {}, o, parseBookingRules),
      save: (rules, o) =>
        request('/settings/booking-rules', {}, o, parseBookingRules, {
          method: 'PUT',
          body: rules,
        }),
      getOptions: (o) =>
        request('/settings/booking-rules/options', {}, o, parseBookingRulesOptions),
    },
    systemSettings: {
      get: (o) => request('/settings/system', {}, o, parseSystemSettings),
      save: (settings, o) =>
        request('/settings/system', {}, o, parseSystemSettings, { method: 'PUT', body: settings }),
      getOptions: (o) => request('/settings/system/options', {}, o, parseSystemSettingsOptions),
    },
    roomSetup: {
      getOptions: (o) => request('/room-setup/options', {}, o, parseRoomSetupOptions),
      listRoomTypes: (o) => request('/room-types', {}, o, parseRoomTypeList),
      saveRoomType: (input, o) =>
        input.id
          ? request(`/room-types/${encodeURIComponent(input.id)}`, {}, o, parseRoomTypeSetup, {
              method: 'PUT',
              body: input,
            })
          : request('/room-types', {}, o, parseRoomTypeSetup, { method: 'POST', body: input }),
      deleteRoomType: (id, o) =>
        request(`/room-types/${encodeURIComponent(id)}`, {}, o, parseNothing, {
          method: 'DELETE',
        }),
      listRooms: (o) => request('/rooms', {}, o, parseRoomList),
      saveRoom: (input, o) =>
        input.id
          ? request(`/rooms/${encodeURIComponent(input.id)}`, {}, o, parseRoomSetup, {
              method: 'PUT',
              body: input,
            })
          : request('/rooms', {}, o, parseRoomSetup, { method: 'POST', body: input }),
      deleteRoom: (id, o) =>
        request(`/rooms/${encodeURIComponent(id)}`, {}, o, parseNothing, { method: 'DELETE' }),
    },
    addOns: {
      getOptions: (o) => request('/add-ons/options', {}, o, parseAddOnOptions),
      list: (o) => request('/add-ons', {}, o, parseAddOnList),
      save: (input, o) =>
        input.id
          ? request(`/add-ons/${encodeURIComponent(input.id)}`, {}, o, parseAddOn, {
              method: 'PUT',
              body: input,
            })
          : request('/add-ons', {}, o, parseAddOn, { method: 'POST', body: input }),
      delete: (id, o) =>
        request(`/add-ons/${encodeURIComponent(id)}`, {}, o, parseNothing, { method: 'DELETE' }),
    },
    permissions: { getGrant: (o) => request('/permissions/me', {}, o, parseGrant) },
    reports: { listCustom: (o) => request('/reports/custom', {}, o, parseCustomReports) },
  };
}
