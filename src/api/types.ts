import type { RegistrationCardApi, RegistrationCardSettings } from './registrationCardTypes';
import type { ChangeLogApi } from './changeLogTypes';
import type { ReservationListApi } from './reservationListTypes';

/** ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;
/** Money is always integer cents; the backend owns currency formatting rules. */
export type Cents = number;

/**
 * Every client method takes these last. Aborting rejects with a DOMException named "AbortError"
 * (never an ApiError), so callers can ignore it.
 */
export interface RequestOptions {
  signal?: AbortSignal;
}

// ---- dashboard -------------------------------------------------------------------------------

export interface RateCategoryStat {
  id: string;
  name: string;
  nights: number;
  /** Excludes taxes and service charges (reporting decision, 2026-10-16). */
  revenue: Cents;
}

export interface RoomBlock {
  id: string;
  roomName: string;
  startDate: IsoDate;
  endDate: IsoDate;
  reason: string;
}

export interface DashboardStats {
  date: IsoDate;
  arrivalsToday: number;
  departuresToday: number;
  inHouse: number;
  /** 0 to 100, one decimal at most. */
  occupancyPercent: number;
  rateCategories: RateCategoryStat[];
  roomBlocks: RoomBlock[];
  /** Charges posted to folios without a room; shown as a warning row on the dashboard. */
  unassignedChargesCount: number;
  totalRevenue: Cents;
  totalNights: number;
  /** Weighted: totalRevenue / totalNights, rounded to whole cents. */
  averageRate: Cents;
}

// ---- quick stats (dashboard column, report landing page) -----------------------------------------

export type QuickStatsView = 'day' | 'week' | 'month';

/** What to fetch: one day, the 7 days from `startDate`, or a calendar month (`yyyy-mm`). */
export type QuickStatsQuery =
  | { view: 'day'; date: IsoDate }
  | { view: 'week'; startDate: IsoDate }
  | { view: 'month'; month: string };

/**
 * Booked and available rooms; `percent` is 0 to 100 with one decimal at most. The backend owns the
 * rounding (the mock rounds booked / (booked + available) to one decimal; the UI never recomputes
 * a percent). In every TOTAL row the percent is the mean of the row percents, not total booked over
 * total rooms: this is what Figma's "(avg)" shows.
 */
export interface OccupancyCounts {
  booked: number;
  available: number;
  percent: number;
}

export interface QuickStatsRevenue {
  /** One row per rate category in the data (not a fixed list). */
  rows: RateCategoryStat[];
  totalRevenue: Cents;
  totalNights: number;
  /** Weighted: totalRevenue / totalNights. Null when there are no nights. */
  averageRate: Cents | null;
}

export interface QuickStatsRoomBlock {
  id: string;
  name: string;
  nights: number;
  startDate: IsoDate;
  counts: OccupancyCounts;
}

export interface QuickStatsDayOccupancy {
  date: IsoDate;
  counts: OccupancyCounts;
}

interface QuickStatsBase {
  /** The summary bar above the tables. */
  occupancy: OccupancyCounts;
  revenue: QuickStatsRevenue;
}

export interface DayQuickStats extends QuickStatsBase {
  view: 'day';
  date: IsoDate;
  roomBlocks: QuickStatsRoomBlock[];
  /** Sums of booked and available; percent is the average of the block percents. */
  roomBlocksTotal: OccupancyCounts;
}

export interface WeekQuickStats extends QuickStatsBase {
  view: 'week';
  startDate: IsoDate;
  days: QuickStatsDayOccupancy[];
  /** Sums of booked and available; percent is the average of the daily percents. */
  daysTotal: OccupancyCounts;
}

export interface MonthQuickStats extends QuickStatsBase {
  view: 'month';
  month: string;
  roomBlocks: QuickStatsRoomBlock[];
  roomBlocksTotal: OccupancyCounts;
}

/**
 * "Empty" (the UI shows "No stats for this period."): `revenue.rows` is empty AND there are no
 * `roomBlocks` (day, month) or `days` (week). A period that has rows or days but all zeros is not
 * empty: the tables render with zeros, and a zero-night average rate is `null`. So a week with no
 * data should answer `days: []`, not seven zero days. See `isQuickStatsEmpty`.
 * The echoed `date`, `startDate` or `month` must equal the query; the HTTP client rejects a
 * mismatch as `invalid-response`.
 */
export type QuickStats = DayQuickStats | WeekQuickStats | MonthQuickStats;

export interface DashboardApi {
  getStats(options?: RequestOptions): Promise<DashboardStats>;
  /** Quick Stats for one view; the result's `view` matches the query's. */
  getQuickStats(query: QuickStatsQuery, options?: RequestOptions): Promise<QuickStats>;
}

// ---- reservations ----------------------------------------------------------------------------

export type ReservationStatus =
  'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';

export interface Reservation {
  id: string;
  confirmationNumber: string;
  guestName: string;
  roomType: string;
  /** Null until a room is assigned. */
  roomNumber: string | null;
  arrival: IsoDate;
  departure: IsoDate;
  adults: number;
  children: number;
  status: ReservationStatus;
  rateCategoryId: string;
  hasUnassignedCharges: boolean;
}

export type ReservationSortField = 'arrival' | 'departure' | 'guestName' | 'confirmationNumber';

export interface ReservationSort {
  field: ReservationSortField;
  direction: 'asc' | 'desc';
}

export interface ReservationQuery {
  status?: ReservationStatus;
  /** Matches guest name or confirmation number, case-insensitive. */
  search?: string;
  /** Inclusive ISO-date bounds. */
  arrivalFrom?: IsoDate;
  arrivalTo?: IsoDate;
  departureFrom?: IsoDate;
  departureTo?: IsoDate;
  /** Default: arrival ascending. The server breaks ties by id so paging is stable. */
  sort?: ReservationSort;
  /** Opaque; pass back a previous page's `nextCursor`. */
  cursor?: string;
  /** Server default and maximum apply when omitted or too large. */
  limit?: number;
}

/** One page of a list. `total` counts all matches, not just this page. */
export interface Page<T> {
  items: T[];
  total: number;
  /** Absent on the last page. */
  nextCursor?: string;
}

/** One room of a reservation as the details panel shows it. */
export interface ReservationRoomDetail {
  /** The reservation-room id (the schedule block id). */
  id: string;
  /** Null while no room is assigned ("UNASSIGNED"). */
  roomId: string | null;
  roomNumber: string | null;
  locationName: string | null;
  roomTypeName: string | null;
  status: 'nyci' | 'checked-in' | 'checked-out';
  arrival: IsoDate;
  /** Departure, exclusive. */
  departure: IsoDate;
  /**
   * This room's party (ticket 151): the lead occupant counts as one adult. Absent when the backend
   * does not say; the UI then falls back to the reservation's totals for a one-room reservation.
   */
  adults?: number;
  children?: number;
  /** The named guests besides the lead occupant; the rest of the party is "TBD" (ticket 151). */
  guests?: ReservationGuest[];
  /** The lead occupant of a room added later (ticket 151); absent: the reservation's. */
  leadOccupant?: { name: string; memberNumber: string | null };
  /**
   * Housekeeping state of the assigned room (ticket 163): a `dirty` room cannot be checked in.
   * Absent when the backend does not track it (PLACEHOLDER until ticket 6.4); the UI then lets the
   * check in try and the backend decides.
   */
  housekeeping?: RoomHousekeepingStatus;
  /** When the room was checked in / out: ISO-8601 instants, recorded by the backend (ticket 163). */
  checkedInAt?: string;
  checkedOutAt?: string;
  /**
   * When the stay has several parts (ticket 2.3) `roomId` / `roomNumber` are the room of the first
   * night not yet stayed, `arrival` is where that run of nights starts and `departure` is the
   * departure of the whole stay (also when later nights are in other rooms). The two lists below are
   * absent whenever the stay is a single block.
   */
  previousStays?: ReservationPartialStay[];
  /** Rooms of the nights after the current run, oldest first (planned room changes). */
  upcomingStays?: ReservationPartialStay[];
}

/** A run of consecutive nights in one room: [arrival, departure). */
export interface ReservationPartialStay {
  roomId: string;
  roomNumber: string | null;
  arrival: IsoDate;
  /** Departure from that room, exclusive. */
  departure: IsoDate;
}

/** A named guest of one room besides its lead occupant (ticket 151). */
export interface ReservationGuest {
  /** Stable within the room; assigned by the backend. */
  id: string;
  kind: 'adult' | 'child';
  /**
   * Position among the room's adult (or child) guests, from 0: "Guest 2" is adult slot 0, and a
   * guest in slot 1 with slot 0 empty is "Guest 3" with "Guest 2" still TBD.
   */
  slot: number;
  name: string;
  /** The directory person, when picked from it. */
  memberId?: string;
  memberNumber: string | null;
  email?: string;
  /** A confirmation email was sent to this guest when they were saved. */
  confirmationSent?: boolean;
}

export interface ReservationAddOn {
  id: string;
  name: string;
  quantity: number;
  /** Per unit, excluding taxes and service charges. */
  priceCents: Cents;
}

export interface ReservationStayLine {
  roomType: string;
  date: IsoDate;
  /** Per night, excluding taxes and service charges. */
  amountCents: Cents;
  /**
   * The reservation room (the id of its `current` schedule block, the "stay id") the night belongs
   * to, so a multi-room reservation's lines can be told apart: the change-room dialog prices the
   * remaining nights of one room. Required; the backend sums nights and revenue per night, not per block.
   */
  reservationRoomId: string;
}

/**
 * Everything the reservation details panel shows (Figma "Res Details Panel"). `status` is the
 * reservation's: 'checked-in' while any room is in house, 'checked-out' once every room has left,
 * 'cancelled' for a cancelled one, else 'confirmed'/'pending'. `version` is the opaque revision
 * the early/late mutation echoes back (409 `stale` when it is out of date); it is separate from the
 * schedule block versions.
 */
export interface ReservationDetail {
  id: string;
  confirmationNumber: string;
  status: ReservationStatus;
  arrival: IsoDate;
  /** Departure, exclusive. */
  departure: IsoDate;
  nights: number;
  adults: number;
  children: number;
  leadOccupant: { name: string; memberNumber: string | null; guestType: ScheduleGuestType };
  rooms: ReservationRoomDetail[];
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
  addOns: ReservationAddOn[];
  publicNotes: string;
  privateNotes: string;
  /** Excludes taxes and service charges. */
  stay: { lines: ReservationStayLine[]; folioTotalCents: Cents };
  version: string;
  /**
   * The latest business date a night audit has run for (ticket 2.5); null when none has. Absent
   * when the backend does not say: the UI then treats the audit as unknown and hides actions that
   * only exist before it (Undo Check In).
   */
  lastAuditedDate?: IsoDate | null;
  /**
   * The folio's lines, only their type and status (the legacy rule for "the night audit has run"
   * reads them). Absent when the backend does not say: Add Another Room then stays offered.
   */
  folioCharges?: Pick<FolioCharge, 'type' | 'status'>[];
  /**
   * A payment method is on file (check in requires one, decision D-008). Absent when the backend
   * does not say: the check in then goes ahead and the backend answers 409 `no-payment-method`.
   */
  paymentOnFile?: boolean;
}

/**
 * Early Check In / Late Check Out, saved as the user ticks them (no Save button). Send only the
 * flag(s) that changed. `requestId` is the idempotency key (body and `Idempotency-Key` header,
 * like the schedule moves); `version` is the `ReservationDetail.version` the user saw.
 */
export interface EarlyLateRequest {
  requestId: string;
  reservationId: string;
  version: string;
  earlyCheckIn?: boolean;
  lateCheckOut?: boolean;
}

/**
 * The reservation's flags after the change and its new `version`. Errors: 400 `invalid-id` /
 * `invalid-query`; 404; 409 `stale` (the version is out of date; nothing applied); 409
 * `not-editable` (checked out or cancelled); 409 `idempotency-conflict`.
 */
export interface EarlyLateResult {
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
  version: string;
}

/** TBD: the booking guest (or lead occupant) is not known yet. */
export const GUEST_TBD = 'TBD';

/**
 * Create a one-room reservation from the New Reservation panel. Idempotent on `requestId`. Errors:
 * 400 `invalid-query`; 404 unknown room; 409 `conflict` (the room is booked or closed on those
 * nights; only checked when a room is given); 409 `idempotency-conflict`. Answers the new
 * reservation's detail. `roomId` null or absent creates an UNASSIGNED reservation: it has no lane
 * on the schedule grid until a room is assigned (a future schedule ticket). `guestName` is the
 * booking guest, "TBD" when not chosen yet. The lead occupant is the booking guest when the role is
 * 'occupant'; for 'reserver' it is `leadOccupant`, or "TBD" when absent.
 */
export interface CreateReservationRequest {
  requestId: string;
  /** The hold placed on the slot while the form was open (ticket 152); the server releases it on success. */
  holdId?: string;
  roomId?: string | null;
  arrival: IsoDate;
  departure: IsoDate;
  adults: number;
  children: number;
  guestName: string;
  /** The booking guest's directory id, when they were picked from the member directory. */
  bookingGuestId?: string;
  bookingGuestRole: 'occupant' | 'reserver';
  leadOccupant?: { name: string; memberId?: string };
  publicNotes?: string;
  privateNotes?: string;
}

/**
 * Add another room to a reservation (ticket 151; Figma 16593:31892). The new room takes the
 * reservation's dates (never sent: the backend owns them). `roomId` null or absent adds an
 * UNASSIGNED room. `adults` (at least 1, the lead occupant) and `children` are this room's party.
 * `leadOccupant` names the room's lead occupant (TBD when absent). `version` is the
 * `ReservationDetail.version` the user saw. Idempotent on `requestId`. Answers the reservation as it
 * is now (one more room, new version). Errors: 400 `invalid-id` / `invalid-query`; 403 `forbidden`;
 * 404 (reservation or room); 409 `stale`; 409 `conflict` (the room is booked or closed on a night of
 * the stay); 409 `held` (another user holds the room on a night of the stay, ticket 152); 409 `not-editable` (cancelled, or every room checked out, or the night audit has run:
 * the same cases that hide the menu item); 409 `idempotency-conflict`.
 */
export interface AddRoomRequest {
  requestId: string;
  reservationId: string;
  version: string;
  roomId?: string | null;
  adults: number;
  children: number;
  leadOccupant?: { name: string; memberId?: string };
}

/** One guest of a room as sent: the lead occupant is not part of the list. */
export interface GuestInput {
  kind: 'adult' | 'child';
  /** The slot this guest takes (see `ReservationGuest.slot`); slots left out stay TBD. */
  slot: number;
  name: string;
  memberId?: string;
  email?: string;
  /** Send the confirmation email now; ignored without an email. Off by default. */
  sendConfirmation?: boolean;
}

/**
 * Set the party of one room and its named guests (ticket 151). `guests` replaces the list: at most
 * `adults - 1` adults and `children` children (the lead occupant is the first adult), each with its
 * own `slot` (adults 0 to `adults - 2`, children 0 to `children - 1`, no slot twice per kind); the
 * rest of the party stays TBD. Idempotent on `requestId`. Answers the reservation as it is now. Errors: 400;
 * 403 `forbidden`; 404; 409 `stale`; 409 `not-editable` (the room is checked in or out, or the
 * reservation is cancelled: guests are read-only then); 409 `idempotency-conflict`.
 */
export interface UpdateGuestsRequest {
  requestId: string;
  reservationId: string;
  reservationRoomId: string;
  version: string;
  adults: number;
  children: number;
  guests: GuestInput[];
}

/**
 * Save the reservation's notes (ticket 151). Both texts are sent whole (at most MAX_NOTES_LENGTH
 * each). Idempotent on `requestId`. Answers the reservation as it is now. Errors: 400; 403
 * `forbidden`; 404; 409 `stale`; 409 `not-editable` (checked out or cancelled); 409
 * `idempotency-conflict`.
 */
export interface UpdateNotesRequest {
  requestId: string;
  reservationId: string;
  version: string;
  publicNotes: string;
  privateNotes: string;
}

/** Which rate a room change keeps for the nights whose room changed (ticket 2.3, decision D-015). */
export type RateChoice = 'retain' | 'update';

/** One night of a stay and the room it is spent in. */
export interface NightRoom {
  /** The night's date (the stay occupies [arrival, departure)). */
  date: IsoDate;
  roomId: string;
}

/**
 * Change the rooms of a checked-in reservation room for the rest of its stay, night by night (ticket
 * 2.3; Figma 1326:19431, requirements 27.9.1.2). `nights` is the **whole remaining stay**: one entry
 * per night from the first night not yet stayed (today, or the arrival if later) to the night before
 * the departure, in date order, each with the room it should be spent in (unchanged nights repeat
 * their current room). Nights before that are stayed and cannot be changed. The backend merges
 * consecutive nights in one room into segments.
 * - `requestId`: idempotency key (body and `Idempotency-Key` header), as for the schedule moves.
 * - `reservationRoomId`, `fromRoomId`, `version`: the schedule block as the user saw it (the room of
 *   the first remaining night); 409 `stale` when its room or version has changed since.
 * - `rateChoice`: 'retain' keeps the current nightly price of the nights whose room changed, 'update'
 *   uses their new rooms' rates, `null` means the question was not asked (the "ask" setting is off, or
 *   the rates do not differ): the new rates apply. When the setting is on and the rates differ, the
 *   backend answers 400 `invalid-query` (details.rateChoice) for `null`.
 */
export interface ChangeRoomRequest {
  requestId: string;
  reservationRoomId: string;
  fromRoomId: string;
  nights: NightRoom[];
  rateChoice: RateChoice | null;
  version: string;
}

/**
 * Housekeeping state of a room. PLACEHOLDER until the Housekeeping report (ticket 6.4) defines the
 * real types and statuses (the requirements call the state after a checkout "Needs Cleaning").
 * Named RoomHousekeepingStatus: the block-level `HousekeepingStatus` of the schedule's "H" chip
 * (ticket 2.4) uses the shorter name.
 */
export type RoomHousekeepingStatus = 'clean' | 'dirty';

/**
 * What the change did. `blocks` is the whole stay of that reservation room after the change: one
 * block per run of consecutive nights in one room, oldest first (see `ScheduleBlock.roomChange`);
 * the block with the request's `reservationRoomId` is the run holding the first remaining night.
 * `removedBlockIds` are blocks of the stay that no longer exist (merged or replaced). `folio`
 * summarizes the room charges (integer cents, excluding taxes and service charges): `deltaCents` is
 * the change of this reservation room's total, `repricedNights` how many nights got another price.
 * `vacatedRoom` is the room the guest sleeps in tonight when it changed (dirty from that night), else
 * null. When every night ends up in one room the answer is a single block without `roomChange`.
 * Errors: 400 `invalid-id` / `invalid-query` (`details.nights`, `details.rateChoice`); 403 (no
 * `reservation.edit`); 404; 409 `stale` (the block's version or room changed, or the effective date
 * differs: `details.reason` ['effective-date'] and `details.today`, the club's today, which the
 * server owns); 409 `not-movable` (not checked in, locked room type); 409 `conflict` (a room is
 * booked or closed on a night it was given, `details.roomId`); 409 `idempotency-conflict`. Nothing
 * is applied on an error. A replay of the same request returns the original answer (versions and
 * `removedBlockIds` included).
 */
export interface ChangeRoomResult {
  blocks: ScheduleBlock[];
  removedBlockIds: string[];
  folio: { deltaCents: Cents; repricedNights: number; roomChargesCents: Cents };
  vacatedRoom: { roomId: string; housekeeping: RoomHousekeepingStatus; since: IsoDate } | null;
}

/**
 * Cancel a whole reservation (ticket 2.5). `requestId` is the idempotency key (body and
 * `Idempotency-Key` header); `version` is the `ReservationDetail.version` the user saw. Fees are
 * out of scope. Answers the reservation as it is now (status 'cancelled', new `version`). Errors:
 * 400 `invalid-id` / `invalid-query`; 403 `forbidden` (no `reservation.edit`); 404; 409 `stale`;
 * 409 `not-cancellable` (a room is checked in or out, or it is already cancelled); 409
 * `idempotency-conflict`.
 */
export interface CancelReservationRequest {
  requestId: string;
  reservationId: string;
  version: string;
}

/**
 * Undo a check in (ticket 2.5): one reservation room (`reservationRoomId`) or, when absent, every
 * room that is checked in. Answers the reservation as it is now. Errors: 400; 403 `forbidden`; 404;
 * 409 `stale`; 409 `not-checked-in` (nothing to undo, or a room was already checked out); 409
 * `audit-closed` (the night audit has run for the check-in business date); 409
 * `idempotency-conflict`.
 */
export interface UndoCheckInRequest {
  requestId: string;
  reservationId: string;
  version: string;
  reservationRoomId?: string;
}

/** Why one room could not be checked in (ticket 163, #28). Carried per room, not as an HTTP error. */
export type CheckInFailureCode =
  'unassigned' | 'room-not-ready' | 'occupied' | 'no-payment-method' | 'not-checkable';

/**
 * Check in some rooms of one reservation, also when the arrival date has passed (ticket 163).
 * `requestId` is the idempotency key (body and `Idempotency-Key` header); `version` is the
 * `ReservationDetail.version` the user saw.
 * - `pastDateConfirmed`: the user confirmed the "check in for a prior date" prompt. Required (409
 *   `past-date-unconfirmed`) when any room's arrival is before the club's today.
 * - `overrideCode`: needed (403 `override-required`; 403 `override-invalid` when wrong) when the user's
 *   level is "arrival date only" and a room's arrival is before today. Validated by the backend
 *   (ticket 127 builds the real PIN prompt; the mock accepts one fixed code).
 * - `checkOutAfter`: also check out every checked-in room whose departure date and the club's
 *   check-out time have passed (owner decision); ignored for a room whose departure has not passed.
 * Check-in and check-out date and time are recorded. The nights before today are charged to the folio
 * (`nightsPosted`); an automatic check out posts the remaining nights.
 * Errors: 400 `invalid-id` / `invalid-query`; 403 `forbidden` (level "never"), `override-required`,
 * `override-invalid`; 404 (reservation or room); 409 `stale`, `future-arrival`,
 * `past-date-unconfirmed`, `idempotency-conflict`. A room that cannot be checked in does not fail
 * the request: it comes back in `rooms` with its `failure`.
 */
export interface CheckInReservationRequest {
  requestId: string;
  reservationId: string;
  version: string;
  reservationRoomIds: string[];
  pastDateConfirmed: boolean;
  overrideCode?: string;
  checkOutAfter: boolean;
}

export interface CheckInRoomOutcome {
  reservationRoomId: string;
  checkedIn: boolean;
  failure?: CheckInFailureCode;
  checkedInAt?: string;
  /** Set when the room was checked out automatically. */
  checkedOutAt?: string;
}

/** An integration (key card encoder, TMS) that could not complete; the check in itself stands. */
export interface IntegrationError {
  kind: 'key-card' | 'tms';
  message: string;
}

export interface CheckInReservationResult {
  /** The reservation as it is after the check in. */
  reservation: ReservationDetail;
  rooms: CheckInRoomOutcome[];
  /** At least one room was checked out right after check in. */
  autoCheckedOut: boolean;
  /** Nights charged to the folio by this request (nights before today, plus the rest on an automatic check out). */
  nightsPosted: number;
  integrationErrors: IntegrationError[];
}

/** The permissions whose holder's PIN can authorize an override. Add one per flow that needs it. */
export type OverridePermission = 'reservation.check-in.any-time';

/** Ask whether `pin` belongs to an employee who holds `permission` (ticket 187). */
export interface VerifyOverridePinRequest {
  permission: OverridePermission;
  pin: string;
}

/**
 * `valid: false` is a normal answer (wrong PIN, unknown PIN and a holder without the permission look
 * alike). `lockedForSeconds` is present when too many wrong PINs locked the caller out: the PIN was
 * not tested and the caller must wait.
 */
export interface VerifyOverridePinResult {
  valid: boolean;
  lockedForSeconds?: number;
}

/** Override PINs of authorized employees (ticket 187). */
export interface OverridesApi {
  /** Advisory: the action that uses the PIN tests it again. */
  verifyPin(
    request: VerifyOverridePinRequest,
    options?: RequestOptions,
  ): Promise<VerifyOverridePinResult>;
}

/** Split one room off a multi-room reservation into a reservation of its own; answers the new reservation. */
export interface SplitRoomRequest {
  requestId: string;
  reservationId: string;
  reservationRoomId: string;
  version: string;
}

/**
 * PLACEHOLDER until the Payment Methods dialog (ticket 3.9) and the gateway exist: puts a mock card
 * on file for the reservation so the check in can continue.
 */
export interface AddPaymentMethodRequest {
  requestId: string;
  reservationId: string;
}

export interface ReservationsApi {
  list(query?: ReservationQuery, options?: RequestOptions): Promise<Page<Reservation>>;
  /** Rejects with an ApiError of status 404 when the id is unknown. */
  get(id: string, options?: RequestOptions): Promise<Reservation>;
  /** The details panel's data. 404 when the id is unknown. */
  getDetail(id: string, options?: RequestOptions): Promise<ReservationDetail>;
  setEarlyLate(request: EarlyLateRequest, options?: RequestOptions): Promise<EarlyLateResult>;
  create(request: CreateReservationRequest, options?: RequestOptions): Promise<ReservationDetail>;
  /** Change room during the stay (ticket 2.3). Idempotent on `requestId`. */
  changeRoomDuringStay(
    request: ChangeRoomRequest,
    options?: RequestOptions,
  ): Promise<ChangeRoomResult>;
  /** Cancel the reservation (ticket 2.5). Idempotent on `requestId`. */
  cancelReservation(
    request: CancelReservationRequest,
    options?: RequestOptions,
  ): Promise<ReservationDetail>;
  /** Undo a check in (ticket 2.5). Idempotent on `requestId`. */
  undoCheckIn(request: UndoCheckInRequest, options?: RequestOptions): Promise<ReservationDetail>;
  /** Check in rooms, also after the arrival date (ticket 163). Idempotent on `requestId`. */
  checkIn(
    request: CheckInReservationRequest,
    options?: RequestOptions,
  ): Promise<CheckInReservationResult>;
  /** Add another room for the whole stay (ticket 151). Idempotent on `requestId`. */
  addRoom(request: AddRoomRequest, options?: RequestOptions): Promise<ReservationDetail>;
  /** Set one room's party and named guests (ticket 151). Idempotent on `requestId`. */
  updateGuests(request: UpdateGuestsRequest, options?: RequestOptions): Promise<ReservationDetail>;
  /** Save the reservation's notes (ticket 151). Idempotent on `requestId`. */
  updateNotes(request: UpdateNotesRequest, options?: RequestOptions): Promise<ReservationDetail>;
  /** Split a room off its reservation (ticket 163). Idempotent on `requestId`. */
  splitRoom(request: SplitRoomRequest, options?: RequestOptions): Promise<ReservationDetail>;
  /** PLACEHOLDER (ticket 3.9). Idempotent on `requestId`. */
  addPaymentMethod(
    request: AddPaymentMethodRequest,
    options?: RequestOptions,
  ): Promise<ReservationDetail>;
}

// ---- folios (ticket 4.1; read and post only, settle/split/transfer arrive with their tickets) ----

export type FolioLineType =
  | 'room-rate'
  | 'mpos'
  | 'manual'
  | 'add-on'
  | 'surcharge'
  | 'service-fee'
  /** The line that was split (status `split`); its description names the item or selection. */
  | 'split-parent'
  /** One part of a split (Figma "Split Item Child"). */
  | 'split-child';

/**
 * `posted`: on the folio and owed; `unposted`: waiting for Night Audit; `settled`: paid, with the
 * settle `references`; `split`: replaced by its split lines (ticket 4.13).
 */
export type FolioChargeStatus = 'posted' | 'unposted' | 'settled' | 'split';

export interface FolioCharge {
  id: string;
  type: FolioLineType;
  date: IsoDate;
  description: string;
  /** Total for the line: includes taxes and service charges (doc 32.13.2.1). */
  amountCents: Cents;
  status: FolioChargeStatus;
  /** Payment reference numbers of the settlement(s); empty unless `settled`. */
  references: string[];
  /** The reservation room the line belongs to; null for a line on the reservation as a whole. */
  roomId: string | null;
  /** The occupant it is charged to; null for a room-level line. */
  occupantId: string | null;
}

export interface FolioPayment {
  id: string;
  /** Shown in the Type column, e.g. "Credit Card", "Member Charge", "MPOS Payment". */
  typeLabel: string;
  date: IsoDate;
  reference: string;
  /** MPOS ticket number, null for a payment made in Guest Rooms. */
  ticket: string | null;
  description: string;
  amountCents: Cents;
  /** E.g. "Settled (Successful)". */
  status: string;
}

export interface FolioOccupant {
  id: string;
  name: string;
  roomId: string;
}

export interface FolioRoom {
  id: string;
  /** "UNASSIGNED" is shown when null. */
  number: string | null;
}

export interface Folio {
  reservationId: string;
  confirmationNumber: string;
  /** Follows the reservation's check in and check out (doc 32.3.1.2). */
  checkInStatus: 'not-checked-in' | 'checked-in' | 'checked-out';
  /** Closed folios disable the action buttons. */
  open: boolean;
  /** The folio is visible in MPOS (the POS chip). */
  mposVisible: boolean;
  nights: number;
  guests: number;
  rooms: FolioRoom[];
  occupants: FolioOccupant[];
  charges: FolioCharge[];
  payments: FolioPayment[];
}

/** Posts one unposted charge (the "Post via Night Audit" dialog); `requestId` is the idempotency key. */
export interface PostChargeRequest {
  requestId: string;
  reservationId: string;
  chargeId: string;
}

export interface FoliosApi {
  /** 404 when the reservation is unknown. */
  get(reservationId: string, options?: RequestOptions): Promise<Folio>;
  /**
   * Returns the folio after posting. Errors: 400 `invalid-id`; 404; 409 `folio-closed`; 409
   * `not-unposted` (the charge is not waiting for Night Audit); 409 `idempotency-conflict`.
   */
  postCharge(request: PostChargeRequest, options?: RequestOptions): Promise<Folio>;
}

// ---- members (guest directory; placeholder until the Member Directory ticket) ------------------

/** A person in the guest directory: a member, or a guest added from the New Reservation panel. */
export interface Member {
  id: string;
  /** "MEM-0001". */
  memberNumber: string;
  name: string;
  email: string;
  phone: string;
}

export interface MemberQuery {
  /** Matches name, member number or email, case-insensitive; empty gives the first members. */
  q?: string;
  /** Server default and maximum apply when omitted or too large. */
  limit?: number;
}

/**
 * Add a person to the directory (idempotent on `requestId`, like the other creates). Errors: 400
 * `invalid-query`; 409 `idempotency-conflict`.
 */
export interface CreateMemberRequest {
  requestId: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface MembersApi {
  search(query?: MemberQuery, options?: RequestOptions): Promise<Page<Member>>;
  create(request: CreateMemberRequest, options?: RequestOptions): Promise<Member>;
}

// ---- settings (Booking Rules, ticket 7.5; read-only here) --------------------------------------

/**
 * "Reservation Hold" minutes (1 to 99) per audience, from Booking Rules (ticket 7.5). Staff create
 * reservations in the admin UI, so the panel uses `employee`; `member` and `nonMember` are the
 * online booking audiences.
 */
export interface BookingHold {
  employee: number;
  member: number;
  nonMember: number;
}

/**
 * Whether a room change during a stay asks "retain the current rate or update to the new room's
 * rate" (decision D-015, ticket 2.3). PLACEHOLDER: name, default (true) and home (probably System
 * Settings, ticket 7.1) are not decided; read-only here.
 */
export interface RoomChangeRule {
  askRateOnRoomChange: boolean;
}

export interface SettingsApi {
  getBookingHold(options?: RequestOptions): Promise<BookingHold>;
  getRoomChangeRule(options?: RequestOptions): Promise<RoomChangeRule>;
}

// ---- system settings (Primary Setup, ticket 7.1) ---------------------------------------------

/** A looked-up record (item, area, member) kept as id plus the label the field shows. */
export interface LookupRef {
  id: string;
  label: string;
}

/** Folio Details tab; also the header of the printed folio (shared with the folio print, ticket 4.1). */
export interface FolioDetails {
  streetAddress: string;
  city: string;
  /** Two-letter state code, or '' when none is chosen. */
  state: string;
  zip: string;
  email: string;
  phone: string;
  /** Printed under the header. */
  customText: string;
  /** Logo as a data URL; the backend decides storage later. Null when there is none. */
  logo: string | null;
}

export interface AlternativeBaseRate {
  enabled: boolean;
  /** The rate applies from this many nights ("N or more nights"). */
  minNights: number;
}

export type DurationUnit = 'hours' | 'days';

/** A whole number of hours or days (0 to 31), counted from the check in or checkout time. */
export interface Duration {
  amount: number;
  unit: DurationUnit;
}

export type NightAuditMode = 'manual' | 'automatic';
export type RateChangeHandling = 'time-of-booking' | 'time-of-stay';

/**
 * System-wide settings of one club (Figma System Settings 11895:16081). Times are 24-hour
 * `HH:mm` strings in the club's time zone, always on a 5-minute step.
 */
export interface SystemSettings {
  /** IANA zone id, e.g. `America/New_York`. */
  timeZone: string;
  checkInTime: string;
  checkOutTime: string;
  /** "Enable Early Check In and Late Check Out". When off, the late checkout time is unused. */
  earlyLateEnabled: boolean;
  lateCheckOutTime: string;
  /** MPOS: the folio becomes visible this long before the check-in time on the day of check in. */
  mposVisibleBefore: Duration;
  /** MPOS: the folio stays visible this long after the checkout time on the day of checkout. */
  mposVisibleAfter: Duration;
  /** A settled folio closes this long after the checkout time. */
  closeSettledFolios: Duration;
  /**
   * "Training Mode": the club is practicing, not running live. Turning it on forces the night audit to
   * run manually (legacy behavior); an automatic audit is refused while it is on.
   */
  trainingMode: boolean;
  nightAudit: NightAuditMode;
  /** Daily run time of an automatic night audit; unused while the audit runs manually. */
  nightAuditRunTime: string;
  alternativeBaseRate1: AlternativeBaseRate;
  alternativeBaseRate2: AlternativeBaseRate;
  /** New cards are authorized for $0.01. */
  creditCardAuthorization: boolean;
  cardPresentEnabled: boolean;
  /** Id of the default card reader; only used while card present transactions are enabled. */
  defaultCardReaderId: string | null;
  rateChangeHandling: RateChangeHandling;
  /** Enables the Room Owner field (ticket 7.3) and owner indicators (ticket 3.11). */
  roomOwnerFieldEnabled: boolean;
  /** At most 15 characters. */
  serviceChargeLabel: string;
  transferItem: LookupRef | null;
  guestRoomsArea: LookupRef | null;
  guestMember: LookupRef | null;
  /**
   * House Account section (owner request 2026-10-25): an existing house account picked by name.
   * Optional (null = none chosen). Folio code reads it through `useSystemSettings()`; what it is
   * charged for is not decided yet (Q-HA-1).
   */
  houseAccount: LookupRef | null;
  folio: FolioDetails;
  /** The Registration Card tab (ticket 7.8); also decides whether Print Registration Card is offered. */
  registrationCard: RegistrationCardSettings;
  /** The Online Booking tab (ticket 7.9); read by the online booking flow (Epic 5). */
  onlineBooking: OnlineBookingSettings;
}

/** Online Booking tab of System Settings (Figma 15957:84617). */
export interface OnlineBookingSettings {
  /** Shown with the search fields; at most 150 characters. Empty means none. */
  globalMessage: string;
  /** Short policy beside the agreement checkbox; at most 300 characters. */
  cancellationAgreement: string;
  /** "Include Link to Full Policy". */
  includePolicyLink: boolean;
  /** Absolute http(s) address; only used while `includePolicyLink` is on. */
  policyUrl: string;
  /** "Charge a Cancellation Fee". The amount and rules are out of scope (D-007, Q-96-2). */
  chargeCancellationFee: boolean;
  /** "Display Add-Ons Popup" after room selection (Q-96-1). */
  showAddOnsPopup: boolean;
}

/** Choices for the System Settings selects and lookups. */
export interface SystemSettingsOptions {
  timeZones: LookupRef[];
  cardReaders: LookupRef[];
  items: LookupRef[];
  areas: LookupRef[];
  members: LookupRef[];
}

export interface SystemSettingsApi {
  get(options?: RequestOptions): Promise<SystemSettings>;
  /** Replaces all settings; answers with what was stored. The backend re-checks the rules. */
  save(settings: SystemSettings, options?: RequestOptions): Promise<SystemSettings>;
  getOptions(options?: RequestOptions): Promise<SystemSettingsOptions>;
  /**
   * Type-ahead for the House Account field: house accounts whose name contains `query` (case
   * insensitive), at most 20, sorted by name. An empty query lists the first 20. Errors: 5xx.
   */
  listHouseAccounts(query: string, options?: RequestOptions): Promise<LookupRef[]>;
}

// ---- room setup (Admin Setup: Room Types and Rooms, ticket 7.3) --------------------------------

/** A photo of a room type or room. `url` is a placeholder until the storage service is chosen (Q-72-1). */
export interface RoomPhoto {
  id: string;
  name: string;
  url: string;
}

/** The details a room can inherit from its room type. */
export interface RoomDetails {
  maxOccupancy: number;
  bedrooms: number;
  fullBaths: number;
  halfBaths: number;
  /** Quantity per bed size id (bed sizes come from Room Options). */
  bedTypes: Record<string, number>;
  description: string;
  photos: RoomPhoto[];
  featureIds: string[];
  addOnIds: string[];
}

export interface RoomTypeSetup {
  id: string;
  name: string;
  /** yyyy-mm-dd. */
  startDate: string;
  /** null: no end date configured. */
  endDate: string | null;
  sku: LookupRef | null;
  onlineBooking: boolean;
  details: RoomDetails;
}

export interface RoomSetup {
  id: string;
  name: string;
  /** Only used while the Owner system setting is on; never inherited from the room type. */
  owner: LookupRef | null;
  startDate: string;
  endDate: string | null;
  roomTypeId: string;
  inheritDetails: boolean;
  inheritRates: boolean;
  onlineBooking: boolean;
  /** Replaced by the room type's details by the backend while `inheritDetails` is on. */
  details: RoomDetails;
  /** Two-way: the backend keeps the other side in step. */
  linkedRoomIds: string[];
  /** Read only; a room with upcoming reservations is deleted only after a warning. */
  upcomingReservations: number;
}

/** A form's value: `id` is missing until the first save. */
export type RoomTypeInput = Omit<RoomTypeSetup, 'id'> & { id?: string };
export type RoomInput = Omit<RoomSetup, 'id' | 'upcomingReservations'> & {
  id?: string;
  upcomingReservations?: number;
};

export interface RoomSetupOptions {
  skus: LookupRef[];
  features: LookupRef[];
  addOns: LookupRef[];
  bedSizes: LookupRef[];
  members: LookupRef[];
}

/**
 * Errors: 422 `validation` (the rules in `src/app/roomSetup.ts`), 404 `not-found`, 409 `in-use`
 * (deleting a room type that rooms still use).
 */
export interface RoomSetupApi {
  getOptions(options?: RequestOptions): Promise<RoomSetupOptions>;
  listRoomTypes(options?: RequestOptions): Promise<RoomTypeSetup[]>;
  saveRoomType(input: RoomTypeInput, options?: RequestOptions): Promise<RoomTypeSetup>;
  deleteRoomType(id: string, options?: RequestOptions): Promise<void>;
  listRooms(options?: RequestOptions): Promise<RoomSetup[]>;
  saveRoom(input: RoomInput, options?: RequestOptions): Promise<RoomSetup>;
  deleteRoom(id: string, options?: RequestOptions): Promise<void>;
  /**
   * Saves the display order of the rooms (Rooms setup "Reorder"). `roomIds` are the rooms to put first,
   * in order (the active ones); rooms not listed follow in their current order. `listRooms` and the
   * Schedule's room rows then use it. 422 `validation` for a duplicate id; 404 `not-found` for an
   * unknown one. Answers the rooms in the new order.
   */
  saveRoomOrder(roomIds: string[], options?: RequestOptions): Promise<RoomSetup[]>;
}

// ---- room options (Admin Setup, ticket LP-A.2 / 7.12) -----------------------------------------

/** The club's Features and Bed Sizes: the one list Room Types, Rooms and the Schedule filter read. */
export interface RoomOptions {
  /** Opaque; changes with every save. Send it back with the next save. */
  version: string;
  features: LookupRef[];
  bedSizes: LookupRef[];
}

/** An item of a save: no `id` means a new item. */
export interface RoomOptionInput {
  id?: string;
  label: string;
}

/**
 * Replaces both lists with these, in this order (a removed item is one that is no longer listed), if
 * `version` is still current: otherwise 409 `stale` and nothing is saved, so a tab with old lists
 * cannot delete what another tab added.
 * Idempotent on `requestId` (body and `Idempotency-Key` header).
 */
export interface SaveRoomOptionsRequest {
  requestId: string;
  /** The `RoomOptions.version` the lists were edited from (body and `If-Match` header). */
  version: string;
  features: RoomOptionInput[];
  bedSizes: RoomOptionInput[];
}

/**
 * Errors: 422 `validation` (`details.features` / `details.bedSizes`: one message per refused item,
 * which includes the same `id` listed twice; rules in `src/app/featureBedOptions.ts`); 404
 * `not-found` (an `id` that is not in the lists); 409 `stale` (`version` is not current); 409
 * `in-use` (a removed item is still used by a Room Type or Room; `details.features` /
 * `details.bedSizes` list the ids); 409 `idempotency-conflict`. Nothing is saved on an error.
 */
export interface RoomOptionsApi {
  get(options?: RequestOptions): Promise<RoomOptions>;
  save(request: SaveRoomOptionsRequest, options?: RequestOptions): Promise<RoomOptions>;
}

// ---- add-on items (Admin Setup, ticket 7.4) ---------------------------------------------------

/** "item" sells one SKU. "combo" is open (Q-73-1): it is stored and flagged but behaves like an item. */
export type AddOnKind = 'item' | 'combo';

export interface AddOnSetup {
  id: string;
  name: string;
  /** yyyy-mm-dd; the add-on can be selected on reservations from this day. */
  startDate: string;
  /** null: no end date configured. */
  endDate: string | null;
  kind: AddOnKind;
  /** The SKU whose price a reservation shows; required. */
  sku: LookupRef | null;
  onlineBooking: boolean;
  /** Track Nightly Countdown: `nightlyQty` is then the pool available per night. */
  trackNightly: boolean;
  nightlyQty: number;
  description: string;
  photos: RoomPhoto[];
  locationIds: string[];
  roomTypeIds: string[];
}

/** A form's value: `id` is missing until the first save. */
export type AddOnInput = Omit<AddOnSetup, 'id'> & { id?: string };

export interface AddOnOptions {
  skus: LookupRef[];
  locations: LookupRef[];
  roomTypes: LookupRef[];
}

/** Errors: 422 `validation` (the rules in `src/app/addOns.ts`), 404 `not-found`. */
export interface AddOnApi {
  getOptions(options?: RequestOptions): Promise<AddOnOptions>;
  list(options?: RequestOptions): Promise<AddOnSetup[]>;
  save(input: AddOnInput, options?: RequestOptions): Promise<AddOnSetup>;
  delete(id: string, options?: RequestOptions): Promise<void>;
}

// ---- rate categories (Admin Setup, ticket 7.2 / LP-A.3) ----------------------------------------

/** Keys of the rate table's money columns, in the order legacy shows them. */
export type RateColumnKey =
  | 'standardBase'
  | 'altBase1'
  | 'altBase2'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'
  | 'guest2'
  | 'guest3'
  | 'guest4Plus'
  | 'child';

/** One room type's rates in one season, in cents. */
export type RateAmounts = Record<RateColumnKey, Cents>;

/**
 * The default season (`isDefault`, no dates) applies when no other season does; the others
 * ("Season / Special Rates") have a name and an inclusive date range. `rates` is keyed by room
 * type id.
 */
export interface RateSeason {
  id: string;
  name: string;
  isDefault: boolean;
  /** yyyy-mm-dd, '' for the default season. */
  startDate: string;
  endDate: string;
  /**
   * Optional SKU of this season (not the default season): the item or combo SKU used to post this
   * season's rate; null or missing means the category's SKU. Legacy has one SKU per category only, so
   * this is an owner-requested extension (entries/rate-categories-polish.md, D-RCP-4).
   */
  sku?: LookupRef | null;
  /** "item" or "combo": which kind `sku` is (the lookup lists SKUs of this kind). Missing reads as item. */
  skuKind?: AddOnKind;
  rates: Record<string, RateAmounts>;
}

export interface RateCategorySetup {
  id: string;
  name: string;
  /** Active dates of the category itself; an inactive category is listed last. */
  startDate: string;
  endDate: string | null;
  /** "item" or "combo" SKU the rate posts to (legacy requires one). */
  kind: AddOnKind;
  sku: LookupRef | null;
  /** Room types the category can be used with; the rate table has a row for each. */
  roomTypeIds: string[];
  seasons: RateSeason[];
  /** Read only: reservations on this category, and settings that name it (blocks deleting). */
  reservationCount: number;
  settingNames: string[];
}

/** A form's value: `id` is missing until the first save; `requestId` makes a retried create safe. */
export type RateCategoryInput = Omit<
  RateCategorySetup,
  'id' | 'reservationCount' | 'settingNames'
> & {
  id?: string;
  requestId?: string;
};

/** A SKU a rate category can post to; `kind` says whether it is an item or a combo. */
export type RateSku = LookupRef & { kind: AddOnKind };

export interface RateCategoryOptions {
  skus: RateSku[];
  roomTypes: LookupRef[];
}

export interface DuplicateRateCategoryRequest {
  sourceId: string;
  name: string;
  /** Idempotency key: a repeat returns the first copy. */
  requestId: string;
}

/**
 * Errors: 422 `validation` (rules in `src/app/rateCategories.ts`), 404 `not-found`, 409
 * `duplicate-name` (save, duplicate) and 409 `in-use` (delete).
 */
export interface RateCategoryApi {
  getOptions(options?: RequestOptions): Promise<RateCategoryOptions>;
  list(options?: RequestOptions): Promise<RateCategorySetup[]>;
  save(input: RateCategoryInput, options?: RequestOptions): Promise<RateCategorySetup>;
  duplicate(
    request: DuplicateRateCategoryRequest,
    options?: RequestOptions,
  ): Promise<RateCategorySetup>;
  delete(id: string, options?: RequestOptions): Promise<void>;
}

// ---- keycard integration (Admin Setup, ticket 7.6) --------------------------------------------

/**
 * Encoder Keys identify the keycard encoders of the club (Visionline). Keys are digits without
 * separators (`src/app/keycards.ts`). The keycard flows (ticket 3.6) read the saved list.
 * Errors: 422 `validation` on save (a key that is not 14 plain digits, or a duplicate); 5xx on retrieve.
 */
export interface KeycardApi {
  /** The saved Encoder Keys, in list order. */
  listEncoders(options?: RequestOptions): Promise<string[]>;
  /** Replaces the saved list; returns what was stored. */
  saveEncoders(keys: string[], options?: RequestOptions): Promise<string[]>;
  /** Asks Visionline for its encoders. Resolves with an empty list when it knows none. Does not save. */
  retrieveEncoders(options?: RequestOptions): Promise<string[]>;
}

// ---- booking rules (Admin Setup, ticket 7.5) --------------------------------------------------

export type TimeUnit = 'days' | 'weeks' | 'months';

/** A time before check in: "6 months". */
export interface TimePeriod {
  amount: number;
  unit: TimeUnit;
}

/** Which occupants must be named (never TBD). */
export type NamedOccupants = 'all' | 'lead' | 'none';
export type ContactRequirement = 'email' | 'phone' | 'email-and-phone' | 'email-or-phone';
/**
 * Payment method at booking. `optional`: the booker may skip adding a payment method; `on-file`:
 * one must be added; `deposit`: a deposit is collected (see `DepositType`); `prepayment`: paid in full.
 */
export type PaymentRequirement = 'optional' | 'on-file' | 'deposit' | 'prepayment';
/** A deposit is a fixed dollar amount or a percentage of the total stay. */
export type DepositType = 'amount' | 'percent';
export type RoomSelection = 'room-optional' | 'room-only' | 'room-type-only';

/**
 * One column of the Booking Rules matrix (Admin, Member Online or Non-Member Online; the id stays `employee`). `null`
 * on a field is the "N/A" cell: the rule does not apply to that audience.
 */
export interface AudienceRules {
  /** Non-member occupants must have a member reserver. Null (N/A) for non-member online booking. */
  requireMemberReserver: boolean | null;
  namedOccupants: NamedOccupants;
  contactInfo: ContactRequirement;
  /** How long before check in booking opens. */
  opens: TimePeriod;
  /** How long before check in booking closes; null is "N/A" (no cut-off). */
  closes: TimePeriod | null;
  /** Cancellation window before check in; null is "N/A". Drives the online cancellation window. */
  cancellation: TimePeriod | null;
  /** "Reservation Hold": minutes a selected room is held, 1 to 99. Drives the hold timer. */
  holdMinutes: number;
  payment: PaymentRequirement;
  /** Set only while `payment` is `deposit`. */
  depositType: DepositType | null;
  /** `amount`: cents; `percent`: 0.01 to 100 with at most two decimals. Set only for a deposit. */
  depositValue: number | null;
  roomSelection: RoomSelection;
  /** Room type ids that cannot be booked. Null (N/A) for admin booking. */
  excludedRoomTypeIds: string[] | null;
  maxRoomsPerReservation: number;
  /** Show the add-on popup after room select. Null (N/A) for admin booking. */
  addOnPopup: boolean | null;
}

/** A member type whose online booking differs from the member default. */
export interface MemberTypeRule {
  id: string;
  /** Null while a new row has no member type chosen yet. */
  memberTypeId: string | null;
  excludeFromOnlineBooking: boolean;
  excludedRoomTypeIds: string[];
  opens: TimePeriod;
  closes: TimePeriod | null;
}

/**
 * System-wide booking rules (Figma Booking Rules 15957:84601). `member` is null while Member
 * Online Booking is off, `nonMember` while Non-Member Online Booking is off (always when member
 * online booking is off): a null column is cleared and disabled in the form.
 */
export interface BookingRules {
  employee: AudienceRules;
  member: AudienceRules | null;
  nonMember: AudienceRules | null;
  /** The "Unique Member Type Rules" checkbox; only possible while `member` is set. */
  uniqueMemberTypeRules: boolean;
  memberTypeRules: MemberTypeRule[];
}

export interface BookingRulesOptions {
  roomTypes: LookupRef[];
  memberTypes: LookupRef[];
}

export interface BookingRulesApi {
  get(options?: RequestOptions): Promise<BookingRules>;
  /** Replaces the rules; answers with what was stored. The backend re-checks the rules. */
  save(rules: BookingRules, options?: RequestOptions): Promise<BookingRules>;
  getOptions(options?: RequestOptions): Promise<BookingRulesOptions>;
}

// ---- locations (Admin Setup, tickets 182 and 123) ----------------------------------------------

/** What uses a location; a location in use cannot be removed (rules in `src/app/locations.ts`). */
export interface LocationUsage {
  /** Names of the room types that belong to the location. */
  roomTypes: string[];
  /** Number of rooms in the location. */
  roomCount: number;
}

/** A club location. `area` routes the location's revenue to the right GL; null only in a draft. */
export interface LocationSetup {
  id: string;
  name: string;
  area: LookupRef | null;
  usage: LocationUsage;
}

/** What a form sends: `id` is made by the client, so a repeated save never creates a duplicate. */
export interface LocationInput {
  id: string;
  name: string;
  area: LookupRef | null;
}

/**
 * Errors: 422 `validation` (the rules in `src/app/locations.ts`), 409 `location-in-use` when the
 * list leaves out a location that still has room types or rooms. `save` replaces the whole list
 * (a location missing from it is removed), so repeating a save changes nothing.
 */
export interface LocationsApi {
  list(options?: RequestOptions): Promise<LocationSetup[]>;
  /** Areas to associate a location with (type-ahead source); the mock returns all of them. */
  listAreas(options?: RequestOptions): Promise<LookupRef[]>;
  save(locations: LocationInput[], options?: RequestOptions): Promise<LocationSetup[]>;
}

// ---- permissions -----------------------------------------------------------------------------

/**
 * What the backend says the current user may do. `'all'` marks an unrestricted user; the sentinel
 * still needs agreeing with the backend.
 */
export interface PermissionGrant {
  role: string;
  /** Plain strings on the wire; `permissionsFromGrant` keeps only known permissions. */
  permissions: readonly string[] | 'all';
}

export interface PermissionsApi {
  getGrant(options?: RequestOptions): Promise<PermissionGrant>;
}

// ---- schedule (rooms by dates grid) --------------------------------------------------------------

/** The grid's view lengths: "7 Days", "14 Days", "30 Days". */
export type ScheduleDays = 7 | 14 | 30;
export const SCHEDULE_DAYS: readonly ScheduleDays[] = [7, 14, 30];

/** "All Rooms" (default), "Available only" (no reservation or closure in range), "Booked only". */
export type ScheduleAvailability = 'all' | 'available' | 'booked';

/**
 * What to fetch: `days` columns from `startDate`. There are deliberately no filter fields: the
 * product always loads every room and filters locally (see `applyScheduleFilters` in
 * src/app/schedule.ts), because the drag rules must see sibling rooms of a multi-room reservation
 * that a filtered answer would omit.
 */
export interface ScheduleQuery {
  startDate: IsoDate;
  days: ScheduleDays;
}

export interface ScheduleLocation {
  id: string;
  name: string;
}

/** A room feature (Room Options setup data); the schedule offers it as a filter. */
export interface ScheduleFeature {
  id: string;
  name: string;
}

export interface ScheduleRoomType {
  id: string;
  name: string;
  /** Per night, excluding taxes. PLACEHOLDER until Rate Categories (admin) provide rates. */
  nightlyRate?: Cents;
}

/** Row header: "location | room type" and the room number. */
export interface ScheduleRoom {
  id: string;
  number: string;
  locationId: string;
  roomTypeId: string;
  /**
   * The room's effective features (its own, or its room type's while it inherits details); ids from
   * `ScheduleData.features`. Absent: none.
   */
  featureIds?: string[];
  /**
   * PLACEHOLDER until the Housekeeping report (ticket 6.4): absent means not tracked. A room
   * vacated by a room change during a stay becomes `dirty`.
   */
  housekeeping?: RoomHousekeepingStatus;
}

/**
 * `confirmed`: arrival still ahead. `nyci`: Not Yet Checked In, arrival day reached. `checked-in`
 * (a "due out" block is a checked-in one whose `endDate` is today) and `checked-out`.
 */
export type ScheduleBlockStatus = 'confirmed' | 'nyci' | 'checked-in' | 'checked-out';

/**
 * Housekeeping status of the room at the departure that ends a block (Figma "Housekeeping Block").
 * `nyci` is drawn invisible: the next guest has not arrived yet.
 */
export type HousekeepingStatus =
  'not-checked-out' | 'needs-cleaning' | 'cleaned' | 'ready' | 'needs-maintenance' | 'nyci';

/** The statuses staff can set from the schedule's "H" chip (`nyci` is derived, never set). */
export type SettableHousekeepingStatus = Exclude<HousekeepingStatus, 'nyci'>;

export const SETTABLE_HOUSEKEEPING_STATUSES: readonly SettableHousekeepingStatus[] = [
  'not-checked-out',
  'needs-cleaning',
  'cleaned',
  'ready',
  'needs-maintenance',
];

/** Figma "Type" variant of a block: guest, member, owner or none. */
export type ScheduleGuestType = 'guest' | 'member' | 'owner' | 'none';

/**
 * The room a linked-room block points at (ticket 2.4): its number and its reserver's name, shown in
 * the tooltip and the block text. A linked block draws no early check in / late check out
 * indicators and cannot be opened or moved (legacy behavior).
 */
export interface LinkedRoom {
  roomNumber: string;
  /** "First Last" of the reservation holder of the linked room. */
  reserverName: string;
  /**
   * Set when several rooms are linked: the number shown after the room name as " +N" (legacy
   * `multilinkageCount`). Absent, 0 or 1 for a single linked room: nothing is added.
   */
  multilinkageCount?: number;
}

/**
 * One room of a reservation on the grid. A stay occupies the nights [startDate, endDate): `endDate`
 * is the departure day and is NOT occupied, so a departure on another stay's arrival day is a
 * same-day turnover, not an overlap.
 */
export interface ScheduleBlock {
  kind: 'reservation';
  /** The reservation-room id; what the move mutations take. */
  id: string;
  reservationId: string;
  confirmationNumber: string;
  guestName: string;
  guestType: ScheduleGuestType;
  roomId: string;
  /** Arrival. */
  startDate: IsoDate;
  /** Departure, exclusive. */
  endDate: IsoDate;
  status: ScheduleBlockStatus;
  /** Rooms on the whole reservation (1 = single room). Blocks with the same `reservationId` move together. */
  roomCount: number;
  /** A locked reservation can only move within its room type. */
  roomTypeLocked: boolean;
  /**
   * Opaque revision of this reservation room. It changes whenever the room's room or dates change
   * (also when a sibling's move changes it) and is echoed back in a move request, so the server
   * can refuse a move made from out-of-date data (409 `stale`). Never parse or compare it.
   */
  version: string;
  /** Early Check In / Late Check Out were requested: the orange edge markers (Figma). */
  earlyCheckIn?: boolean;
  lateCheckOut?: boolean;
  /** Present when this is a linked-room block (link icon, grey, not clickable or draggable). */
  linkedTo?: LinkedRoom;
  /**
   * Block content (ticket LP-S.1). `guestName` is the lead occupant. Everything below is optional;
   * an absent field simply drops its line (see `src/app/scheduleBlockContent.ts`).
   * Guests in this room, named or not; "+N" on the block is this minus one.
   */
  occupantCount?: number;
  /** Names of the named occupants, lead first. Fewer names than `occupantCount`: the rest are TBD. */
  occupants?: string[];
  /** Who made the reservation. */
  reserverName?: string;
  /** Group or event block name. */
  blockName?: string;
  /** Requested room type name; shown when the reservation has no room yet. */
  roomTypeName?: string;
  /** Open folio balance (what the guest still owes); shown when above zero. */
  balanceCents?: Cents;
  /** Housekeeping chip drawn after the departure edge ("H"); absent when none is shown. */
  housekeeping?: HousekeepingStatus;
  /** Free-text housekeeping note (functional doc 15.13.3 / 15.13.4); absent when there is none. */
  housekeepingNotes?: string;
  /**
   * Set only while the stay has SEVERAL blocks (ticket 2.3); absent whenever the stay is a single
   * block, also after a change that put every night back in one room. The blocks share the
   * `reservationId` and confirmation number, one per run of consecutive nights in one room (runs in
   * the same room are always merged, whatever their status), linked by `stayId` (the id of the
   * `current` block, which keeps the reservation-room id). `previous` blocks hold nights already
   * stayed in ANOTHER room (they are `checked-out`, never movable), `current` is the run holding the
   * first night not yet stayed (it also holds earlier nights spent in the same room; `checked-in`) and
   * `next` the later runs (planned rooms; `checked-in` like the stay). `index` (1-based) and `count`
   * give "part 2 of 3". `roomCount` still counts rooms of the reservation, not segments. Segment ids
   * on the wire are opaque. A stay with several blocks cannot be dragged.
   */
  roomChange?: {
    part: 'previous' | 'current' | 'next';
    index: number;
    count: number;
    stayId: string;
  };
}

/** A gray closure block (e.g. "Reserved: Fixed Loss"). Same half-open dates as `ScheduleBlock`. */
export interface ScheduleClosure {
  kind: 'closure';
  id: string;
  roomId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  reason: string;
  /**
   * Unused by the UI: the Figma orange "block ends" marker is not drawn (legacy closures have none,
   * owner decision 2026-10-25, D-EM-2). Kept so the API shape and seeds stay unchanged.
   */
  endMarker: boolean;
}

/**
 * The grid for one query. `locations` and `roomTypes` are the full option lists for the filter
 * panel (never narrowed by the query). `rooms` are the matching rooms in display order; `blocks`
 * and `closures` are those overlapping [startDate, startDate + days) in those rooms. "Empty" means
 * no rooms. A filtered query can omit sibling rooms of a multi-room reservation (compare
 * `roomCount` with the blocks present), so fetch unfiltered if the drag rules must see every room.
 * The client's drag rules only see this loaded window: a long stay shifted past it, or a booking
 * outside it, is guarded by the server's 409, which stays authoritative.
 */
export interface ScheduleData {
  startDate: IsoDate;
  days: ScheduleDays;
  locations: ScheduleLocation[];
  roomTypes: ScheduleRoomType[];
  /** The full feature list for the filter panel. Absent: none (the Room Features group is empty). */
  features?: ScheduleFeature[];
  rooms: ScheduleRoom[];
  blocks: ScheduleBlock[];
  closures: ScheduleClosure[];
  /**
   * Reservation rooms created without a room, overlapping the same window. Their `roomId` is ""
   * (no listed room); a room is assigned in the reservation panel. They ignore the room filters.
   */
  unassigned: ScheduleBlock[];
  /**
   * Slots held while a booking is in progress (ticket 152), by anyone, overlapping the window. The
   * server drops a hold at its expiry; the client also hides one whose `expiresAt` has passed.
   * Absent: none.
   */
  holds?: ScheduleHold[];
}

/**
 * A slot (room and nights) held while a New Reservation is in progress (ticket 152, Q-19-3). Same
 * half-open dates as a block. PLACEHOLDER contract: the real backend owns holds and their expiry
 * (the length is the "Reservation Hold" minutes of Booking Rules, per audience).
 */
export interface ScheduleHold {
  /** Chosen by the holder (a client-generated id, so a repeated request is idempotent). */
  id: string;
  roomId: string;
  /** First held night. */
  startDate: IsoDate;
  /** Departure, exclusive. */
  endDate: IsoDate;
  /** ISO 8601 instant with offset or "Z" when the hold ends. The server's clock decides. */
  expiresAt: string;
  /** The signed-in user placed this hold. Other users' holds only shade the slot. */
  mine: boolean;
}

/**
 * Hold, or move, the hold `holdId` onto a slot. Idempotent on `holdId`: the same id with the same
 * slot answers the existing hold (the expiry is not extended); the same id with another slot moves
 * it and keeps its expiry; the same id after expiry starts a new hold. Errors: 400 `invalid-id` /
 * `invalid-query`; 404 (unknown room); 409 `conflict` (the slot is booked or closed) or 409 `held`
 * (another user holds an overlapping slot), both with `details.roomId`. Nothing changes on an error.
 */
export interface HoldSlotRequest {
  holdId: string;
  roomId: string;
  startDate: IsoDate;
  endDate: IsoDate;
}

/**
 * Fields every move carries so a real backend can apply it safely.
 * - `requestId`: client-generated idempotency key (a UUID). Sent in the body and as the
 *   `Idempotency-Key` header. Repeating a request with the same id and body returns the first
 *   result without applying it again; the same id with another body is 409 `idempotency-conflict`.
 * - `version` and the `from*` fields: the state the user saw. If the reservation room has changed
 *   since (version differs, or it is no longer in `fromRoomId` / starting on `fromStartDate`) the
 *   server answers 409 `stale` and applies nothing.
 */
export interface MoveGuard {
  requestId: string;
  /** `ScheduleBlock.version` the user acted on. */
  version: string;
  /** The room the reservation room was in. */
  fromRoomId: string;
}

/** Move one reservation room to another room, same dates. */
export interface MoveRoomRequest extends MoveGuard {
  reservationRoomId: string;
  toRoomId: string;
}

/**
 * Move a stay to new arrival `toStartDate` (the length is kept). `scope` 'all-rooms' moves every
 * room of the reservation by the same shift; 'this-room' ("split the room from the reservation")
 * moves only this room. `toRoomId` also changes the room of the named reservation room in the same
 * atomic call (the combined room and date drop). A `toStartDate` equal to `fromStartDate` is a
 * room change only (allowed for checked-in rooms too).
 */
export interface MoveDatesRequest extends MoveGuard {
  reservationRoomId: string;
  /** The arrival date the user saw. */
  fromStartDate: IsoDate;
  toStartDate: IsoDate;
  scope: 'all-rooms' | 'this-room';
  toRoomId?: string;
}

/**
 * The blocks that changed. Errors: 400 `invalid-id` / `invalid-query`; 404 (unknown reservation
 * room or room); 409 `conflict` (a target room is booked or closed on those nights, `details.roomId`
 * lists the rooms); 409 `not-movable` (checked out, locked room type, arrival in the past);
 * 409 `stale` (the reservation room changed since the request's `version` / `from*`);
 * 409 `idempotency-conflict` (`requestId` reused with a different request).
 * Nothing is applied on an error.
 */
export interface ScheduleMoveResult {
  blocks: ScheduleBlock[];
}

/**
 * Set the housekeeping status of the room at a block's departure, and optionally its note (functional
 * doc 15.13.4). `notes` omitted leaves the note as it is; an empty string removes it. `version`, when
 * sent, is the `ScheduleBlock.version` the user saw: another version answers 409 `stale` and applies
 * nothing. Answers with the changed block (new version). `requestId` is the idempotency key (body and
 * `Idempotency-Key` header), as for moves. Errors: 400 `invalid-id` / `invalid-query`; 404 (unknown
 * reservation room); 409 `stale`; 409 `idempotency-conflict`.
 */
export interface SetHousekeepingRequest {
  reservationRoomId: string;
  status: SettableHousekeepingStatus;
  notes?: string;
  requestId: string;
  version?: string;
}

/**
 * Create a room closure. Dates are half-open like reservations (`endDate` is the day the room is
 * free again). `description` may be empty (at most 50 characters). `requestId` is the idempotency
 * key (body and `Idempotency-Key` header). Answers with the new closure. Errors: 400
 * `invalid-id` / `invalid-query`; 404 (unknown room); 422 `closure-conflict` (a reservation or
 * another closure is on the room on those nights; `details.roomId` names the room);
 * 409 `idempotency-conflict`.
 */
export interface SaveClosureRequest {
  roomId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  description: string;
  requestId: string;
}

/** Change a closure (room, dates, description); the same rules and errors as create, and 404 for an unknown closure. */
export interface UpdateClosureRequest extends SaveClosureRequest {
  closureId: string;
}

/** Remove a closure; the room is open again. Errors: 400 `invalid-id`; 404 (unknown closure). */
export interface DeleteClosureRequest {
  closureId: string;
  requestId: string;
}

export interface ScheduleApi {
  get(query: ScheduleQuery, options?: RequestOptions): Promise<ScheduleData>;
  createClosure(request: SaveClosureRequest, options?: RequestOptions): Promise<ScheduleClosure>;
  updateClosure(request: UpdateClosureRequest, options?: RequestOptions): Promise<ScheduleClosure>;
  deleteClosure(request: DeleteClosureRequest, options?: RequestOptions): Promise<void>;
  setHousekeeping(
    request: SetHousekeepingRequest,
    options?: RequestOptions,
  ): Promise<ScheduleMoveResult>;
  moveRoom(request: MoveRoomRequest, options?: RequestOptions): Promise<ScheduleMoveResult>;
  moveDates(request: MoveDatesRequest, options?: RequestOptions): Promise<ScheduleMoveResult>;
  /** Hold a slot while a booking is in progress (ticket 152). Idempotent on `holdId`. */
  holdSlot(request: HoldSlotRequest, options?: RequestOptions): Promise<ScheduleHold>;
  /** Release a hold (panel closed, saved or cancelled). Idempotent: an unknown or expired id is fine. */
  releaseHold(holdId: string, options?: RequestOptions): Promise<void>;
}

// ---- reports ---------------------------------------------------------------------------------

/** A saved custom report as the Reporting landing list shows it (ticket 6.1). */
export interface CustomReportSummary {
  id: string;
  name: string;
  creatorName: string;
  /** ISO 8601 instant with offset or "Z"; the list shows it in the viewer's local time. */
  updatedAt: string;
}

export interface ReportsApi {
  /** All saved custom reports, in no guaranteed order (the UI sorts by `updatedAt`, newest first). */
  listCustom(options?: RequestOptions): Promise<CustomReportSummary[]>;
}

// ---- client ----------------------------------------------------------------------------------

export interface ApiClient {
  dashboard: DashboardApi;
  reservations: ReservationsApi;
  overrides: OverridesApi;
  reservationList: ReservationListApi;
  permissions: PermissionsApi;
  schedule: ScheduleApi;
  settings: SettingsApi;
  systemSettings: SystemSettingsApi;
  roomSetup: RoomSetupApi;
  roomOptions: RoomOptionsApi;
  addOns: AddOnApi;
  rateCategories: RateCategoryApi;
  keycards: KeycardApi;
  bookingRules: BookingRulesApi;
  locations: LocationsApi;
  members: MembersApi;
  folios: FoliosApi;
  reports: ReportsApi;
  registrationCard: RegistrationCardApi;
  changeLog: ChangeLogApi;
}

export interface ApiErrorInit {
  /** Machine-readable code, from the server body or set by the client (e.g. "timeout"). */
  code?: string;
  /** Field-level validation errors, keyed by field name. */
  details?: Record<string, string[]>;
  cause?: unknown;
}

/** Status 0 means the request never got a response (network failure or timeout). */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, string[]>;
  constructor(status: number, message: string, init: ApiErrorInit = {}) {
    super(message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = init.code;
    this.details = init.details;
  }
}
