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
 */
export type HousekeepingStatus = 'clean' | 'dirty';

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
  vacatedRoom: { roomId: string; housekeeping: HousekeepingStatus; since: IsoDate } | null;
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
  folio: FolioDetails;
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
export type PaymentRequirement = 'on-file' | 'deposit' | 'prepayment';
export type RoomSelection = 'room-optional' | 'room-only' | 'room-type-only';

/**
 * One column of the Booking Rules matrix (Employee, Member Online or Non-Member Online). `null`
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
  /** Deposit amount; set only while `payment` is `deposit`. */
  depositCents: Cents | null;
  roomSelection: RoomSelection;
  /** Room type ids that cannot be booked. Null (N/A) for employee booking. */
  excludedRoomTypeIds: string[] | null;
  maxRoomsPerReservation: number;
  /** Show the add-on popup after room select. Null (N/A) for employee booking. */
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
   * PLACEHOLDER until the Housekeeping report (ticket 6.4): absent means not tracked. A room
   * vacated by a room change during a stay becomes `dirty`.
   */
  housekeeping?: HousekeepingStatus;
}

/**
 * `confirmed`: arrival still ahead. `nyci`: Not Yet Checked In, arrival day reached. `checked-in`
 * (a "due out" block is a checked-in one whose `endDate` is today) and `checked-out`.
 */
export type ScheduleBlockStatus = 'confirmed' | 'nyci' | 'checked-in' | 'checked-out';

/** Figma "Type" variant of a block: guest, member, owner or none. */
export type ScheduleGuestType = 'guest' | 'member' | 'owner' | 'none';

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
  /** Show the orange "block ends" marker. */
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
  rooms: ScheduleRoom[];
  blocks: ScheduleBlock[];
  closures: ScheduleClosure[];
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

export interface ScheduleApi {
  get(query: ScheduleQuery, options?: RequestOptions): Promise<ScheduleData>;
  moveRoom(request: MoveRoomRequest, options?: RequestOptions): Promise<ScheduleMoveResult>;
  moveDates(request: MoveDatesRequest, options?: RequestOptions): Promise<ScheduleMoveResult>;
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
  reservationList: ReservationListApi;
  permissions: PermissionsApi;
  schedule: ScheduleApi;
  settings: SettingsApi;
  systemSettings: SystemSettingsApi;
  roomSetup: RoomSetupApi;
  bookingRules: BookingRulesApi;
  members: MembersApi;
  folios: FoliosApi;
  reports: ReportsApi;
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
