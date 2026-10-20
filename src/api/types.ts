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

export interface ReservationsApi {
  list(query?: ReservationQuery, options?: RequestOptions): Promise<Page<Reservation>>;
  /** Rejects with an ApiError of status 404 when the id is unknown. */
  get(id: string, options?: RequestOptions): Promise<Reservation>;
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
 * What to fetch: `days` columns from `startDate`. `locationIds` and `roomTypeIds` narrow the rooms;
 * absent means all, and a list must not be empty or contain commas (400 `invalid-query`). To show
 * nothing ("Select None") skip the call, or filter client-side with `applyScheduleFilters`.
 */
export interface ScheduleQuery {
  startDate: IsoDate;
  days: ScheduleDays;
  locationIds?: string[];
  roomTypeIds?: string[];
  availability?: ScheduleAvailability;
}

export interface ScheduleLocation {
  id: string;
  name: string;
}

export interface ScheduleRoomType {
  id: string;
  name: string;
}

/** Row header: "location | room type" and the room number. */
export interface ScheduleRoom {
  id: string;
  number: string;
  locationId: string;
  roomTypeId: string;
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

/** Move one reservation room to another room, same dates. */
export interface MoveRoomRequest {
  reservationRoomId: string;
  toRoomId: string;
}

/**
 * Move a stay to new arrival `toStartDate` (the length is kept). `scope` 'all-rooms' moves every
 * room of the reservation by the same shift; 'this-room' ("split the room from the reservation")
 * moves only this room. `toRoomId` also changes the room of the named reservation room in the same
 * atomic call (the combined room and date drop).
 */
export interface MoveDatesRequest {
  reservationRoomId: string;
  toStartDate: IsoDate;
  scope: 'all-rooms' | 'this-room';
  toRoomId?: string;
}

/**
 * The blocks that changed. Errors: 400 `invalid-id` / `invalid-query`; 404 (unknown reservation
 * room or room); 409 `conflict` (a target room is booked or closed on those nights, `details.roomId`
 * lists the rooms); 409 `not-movable` (checked out, locked room type, arrival in the past).
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

// ---- client ----------------------------------------------------------------------------------

export interface ApiClient {
  dashboard: DashboardApi;
  reservations: ReservationsApi;
  permissions: PermissionsApi;
  schedule: ScheduleApi;
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
