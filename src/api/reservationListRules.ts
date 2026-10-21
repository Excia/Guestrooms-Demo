// Backend rules of the Reservation List that the mock reproduces (ticket 3.1). Pure.
import type { ListStatus, ReservationListRoom } from './reservationListTypes';

/**
 * A multi-room reservation shows the "lowest common denominator" of its rooms: the status that is
 * true of the stay as a whole.
 * - Canceled rooms do not count unless every room is canceled (then the reservation is Canceled).
 * - All remaining rooms alike: that status.
 * - Anything else is a stay in progress, so "Checked In": a partially checked-in reservation
 *   inherits Checked In, and so does one room out with another still to arrive.
 * Only the "Checked In" inheritance is stated in Figma; the rest is an assumption (Q-24-2).
 */
export function deriveListStatus(rooms: readonly { status: ListStatus }[]): ListStatus {
  if (rooms.length === 0) return 'not-checked-in';
  const live = rooms.filter((r) => r.status !== 'canceled');
  if (live.length === 0) return 'canceled';
  const first = live[0].status;
  return live.every((r) => r.status === first) ? first : 'checked-in';
}

/** True when any room has no room number yet. */
export const hasUnassignedRoom = (rooms: readonly Pick<ReservationListRoom, 'roomNumber'>[]) =>
  rooms.some((r) => r.roomNumber === null);
