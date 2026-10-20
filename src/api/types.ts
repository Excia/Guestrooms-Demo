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

/** Booked and available rooms; `percent` is 0 to 100 with one decimal at most. */
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

// ---- client ----------------------------------------------------------------------------------

export interface ApiClient {
  dashboard: DashboardApi;
  reservations: ReservationsApi;
  permissions: PermissionsApi;
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
