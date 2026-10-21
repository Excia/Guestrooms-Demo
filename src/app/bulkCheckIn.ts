// Business rules of the bulk check-in (ticket 3.2), kept out of the components. Pure.
import type { ReservationListRow } from '../api';

/** One reservation room to check in, with what the results dialog prints. */
export interface RoomToCheckIn {
  reservationRoomId: string;
  reservationId: string;
  confirmationNumber: string;
  /** Null while no room is assigned. */
  roomNumber: string | null;
}

export interface RoomCheckInResult {
  room: RoomToCheckIn;
  /** Null when the room was checked in. */
  failure: string | null;
}

/**
 * The rooms a bulk check-in works on: every room of the selected reservations that is still not
 * checked in, one entry per room (a single plus a two-room reservation make three). Rooms already
 * checked in, out or canceled on a partly checked-in reservation are left alone.
 */
export function roomsToCheckIn(rows: readonly ReservationListRow[]): RoomToCheckIn[] {
  return rows.flatMap((row) =>
    row.rooms
      .filter((room) => room.status === 'not-checked-in')
      .map((room) => ({
        reservationRoomId: room.id,
        reservationId: row.id,
        confirmationNumber: row.confirmationNumber,
        roomNumber: room.roomNumber,
      })),
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The CTA: "CHECK IN 3 ROOMS". The count is rooms, not reservations. */
export const checkInLabel = (rooms: number) =>
  `CHECK IN ${rooms} ${plural(rooms, 'ROOM', 'ROOMS')}`;

/** The reason shown under a failed room (Figma 2524:35269). */
export function failureReason(code: string | undefined): string {
  if (code === 'unassigned') return 'No room assigned.';
  if (code === 'no-payment-method') return 'No payment method on file.';
  return 'Could not be checked in. Try again.';
}

/** "Reservation GR-1001 | Room 101", or "| Unassigned". */
export const roomResultLabel = (room: RoomToCheckIn) =>
  `Reservation ${room.confirmationNumber} | ${room.roomNumber === null ? 'Unassigned' : `Room ${room.roomNumber}`}`;

export interface CheckInSummary {
  succeeded: RoomCheckInResult[];
  failed: RoomCheckInResult[];
  /** "3 Rooms Successfully Checked In." or null when none succeeded. */
  successTitle: string | null;
  /** "3 rooms could not be checked in:" or null when none failed. */
  failureTitle: string | null;
  /** One sentence for a screen reader. */
  announcement: string;
}

export function summarizeCheckIn(results: readonly RoomCheckInResult[]): CheckInSummary {
  const succeeded = results.filter((r) => r.failure === null);
  const failed = results.filter((r) => r.failure !== null);
  const ok = succeeded.length;
  const bad = failed.length;
  const successTitle = ok ? `${ok} ${plural(ok, 'Room', 'Rooms')} Successfully Checked In.` : null;
  const failureTitle = bad
    ? `${bad} ${plural(bad, 'room', 'rooms')} could not be checked in:`
    : null;
  const announcement = [
    ok ? `${ok} ${plural(ok, 'room', 'rooms')} checked in.` : '',
    bad ? `${bad} ${plural(bad, 'room', 'rooms')} could not be checked in.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { succeeded, failed, successTitle, failureTitle, announcement };
}

/** Reservation ids that had a failed room, for the orange tint. */
export const failedReservationIds = (results: readonly RoomCheckInResult[]): Set<string> =>
  new Set(results.filter((r) => r.failure !== null).map((r) => r.room.reservationId));
