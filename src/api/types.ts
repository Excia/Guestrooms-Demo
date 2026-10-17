import type { Permission } from '../app/permissions';

/** ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;
/** Money is always integer cents; the backend owns currency formatting rules. */
export type Cents = number;

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

export interface DashboardApi {
  getStats(): Promise<DashboardStats>;
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

export interface ReservationQuery {
  status?: ReservationStatus;
  /** Matches guest name or confirmation number, case-insensitive. */
  search?: string;
}

export interface ReservationsApi {
  list(query?: ReservationQuery): Promise<Reservation[]>;
  /** Rejects with an ApiError of status 404 when the id is unknown. */
  get(id: string): Promise<Reservation>;
}

// ---- permissions -----------------------------------------------------------------------------

/** What the backend says the current user may do. `'all'` is an unrestricted user. */
export interface PermissionGrant {
  role: string;
  permissions: readonly Permission[] | 'all';
}

export interface PermissionsApi {
  getGrant(): Promise<PermissionGrant>;
}

// ---- client ----------------------------------------------------------------------------------

export interface ApiClient {
  dashboard: DashboardApi;
  reservations: ReservationsApi;
  permissions: PermissionsApi;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
