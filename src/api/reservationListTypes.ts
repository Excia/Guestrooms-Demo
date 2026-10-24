// Reservation List (ticket 3.1): one row per reservation, with what the table shows. Kept apart
// from `Reservation` (the older, flatter shape) so the details panel and dashboard are untouched.
import type { IsoDate, Page, RequestOptions, ScheduleLocation, ScheduleRoomType } from './types';

/**
 * A room's state as the list shows it, and the reservation's own status (the "lowest common
 * denominator" of its rooms, derived by the backend; see `deriveListStatus` in
 * `reservationListRules.ts`).
 */
export type ListStatus = 'not-checked-in' | 'checked-in' | 'checked-out' | 'canceled';

export const LIST_STATUSES: readonly ListStatus[] = [
  'not-checked-in',
  'checked-in',
  'checked-out',
  'canceled',
];

export interface ReservationListRoom {
  /** The reservation-room id. */
  id: string;
  /** Null while no room is assigned. */
  roomNumber: string | null;
  status: ListStatus;
}

export interface ReservationListRow {
  id: string;
  confirmationNumber: string;
  arrival: IsoDate;
  /** Departure, exclusive. */
  departure: IsoDate;
  /** The lead occupant. */
  guestName: string;
  /** The booking guest. */
  reserverName: string | null;
  blockName: string | null;
  /** Location of the first room. */
  locationId: string | null;
  locationName: string | null;
  /** Room type of the first room. */
  roomTypeId: string | null;
  roomTypeName: string | null;
  /** At least one; the first is the one the Room column shows. */
  rooms: ReservationListRoom[];
  /** The reservation's status: lowest common denominator of `rooms`. */
  status: ListStatus;
}

export type ReservationListSortField =
  | 'arrival'
  | 'departure'
  | 'confirmationNumber'
  | 'guestName'
  | 'reserverName'
  | 'blockName'
  | 'locationName'
  | 'roomTypeName'
  | 'roomNumber'
  | 'status';

export interface ReservationListSort {
  field: ReservationListSortField;
  direction: 'asc' | 'desc';
}

/**
 * Filtering, sorting and paging all happen on the server. Dates are inclusive ISO dates on the
 * check-in (arrival) date. Text filters match case-insensitively on a substring; list filters
 * match any of the values; every filter given must match.
 */
export interface ReservationListQuery {
  checkInFrom?: IsoDate;
  checkInTo?: IsoDate;
  /** Only reservations that have at least one room without a room number. */
  unassignedOnly?: boolean;
  locationIds?: string[];
  roomTypeIds?: string[];
  statuses?: ListStatus[];
  guest?: string;
  reserver?: string;
  resNumber?: string;
  block?: string;
  room?: string;
  /** Header search button: matches guest, reserver, reservation number or block. */
  search?: string;
  /** Default: check-in ascending (ties by reservation id so paging is stable). */
  sort?: ReservationListSort;
  /** 1-based. */
  page?: number;
  /** Server default and maximum apply when omitted or too large. */
  limit?: number;
}

/** The value lists of the filters: every location and room type, never narrowed by a query. */
export interface ReservationListOptions {
  locations: ScheduleLocation[];
  roomTypes: ScheduleRoomType[];
}

/** Check in one reservation room (ticket 3.2). `requestId` makes a repeat harmless (8 to 128 URL-safe characters). */
export interface CheckInRoomRequest {
  reservationRoomId: string;
  requestId: string;
}

export interface CheckInRoomResult {
  reservationRoomId: string;
  status: 'checked-in';
}

/**
 * Why a room could not be checked in, as the `code` of a 409 answer: no room is assigned yet, or no
 * payment method is on file (check-in requires one, decision D-008).
 */
export const CHECK_IN_FAILURES = ['unassigned', 'no-payment-method'] as const;
export type CheckInFailure = (typeof CHECK_IN_FAILURES)[number];

export interface ReservationListApi {
  /** `total` counts all matches; `nextCursor` is not used (paging is by page number). */
  list(query?: ReservationListQuery, options?: RequestOptions): Promise<Page<ReservationListRow>>;
  getOptions(options?: RequestOptions): Promise<ReservationListOptions>;
  /** Rejects with 409 `unassigned` or `no-payment-method` when the room cannot be checked in. */
  checkInRoom(request: CheckInRoomRequest, options?: RequestOptions): Promise<CheckInRoomResult>;
}
