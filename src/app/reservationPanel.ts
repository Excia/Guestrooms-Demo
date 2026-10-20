// Display rules of the reservation details panel (Figma "RDP" frames): header and room copy.
import type { ReservationDetail, ReservationRoomDetail } from '../api/types';
import { formatPanelDate } from './newReservation';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Reservation #GR-1" or, with several rooms, "Reservation #GR-1 (3 Rooms)". */
export function reservationTitle(detail: Pick<ReservationDetail, 'confirmationNumber' | 'rooms'>) {
  const rooms = detail.rooms.length;
  return `Reservation #${detail.confirmationNumber}${rooms > 1 ? ` (${rooms} Rooms)` : ''}`;
}

export const checkInText = (detail: Pick<ReservationDetail, 'arrival'>) =>
  `Check In: ${formatPanelDate(detail.arrival)}`;

export const checkOutText = (detail: Pick<ReservationDetail, 'departure' | 'nights'>) =>
  `Check Out: ${formatPanelDate(detail.departure)} (${plural(detail.nights, 'Night')})`;

/** "2 Adults 2 Children"; children are left out when there are none. */
export function guestCountText(adults: number, children: number): string {
  return children > 0
    ? `${plural(adults, 'Adult')} ${plural(children, 'Child', 'Children')}`
    : plural(adults, 'Adult');
}

export type PanelStatusLabel = { text: string; tone: 'success' | 'error' | 'neutral' } | null;

/** The label above the title: Checked In, Checked Out, Canceled; nothing before check in. */
export function statusLabel(status: ReservationDetail['status']): PanelStatusLabel {
  switch (status) {
    case 'checked-in':
      return { text: 'Checked In', tone: 'success' };
    case 'checked-out':
      return { text: 'Checked Out', tone: 'neutral' };
    case 'cancelled':
      return { text: 'Canceled', tone: 'error' };
    default:
      return null;
  }
}

/** Early/Late can be changed until the reservation is over. */
export const isEditable = (status: ReservationDetail['status']) =>
  status !== 'checked-out' && status !== 'cancelled';

/** The room the panel shows first: the clicked one if the reservation has it, else the first. */
export function initialRoomIndex(rooms: readonly ReservationRoomDetail[], requestedId?: string) {
  const i = requestedId ? rooms.findIndex((r) => r.id === requestedId) : -1;
  return i >= 0 ? i : 0;
}

/** Previous/next room with wrap-around (the arrows of the room selector). */
export const stepRoomIndex = (index: number, direction: -1 | 1, count: number) =>
  count <= 0 ? 0 : (index + direction + count) % count;

export const roomStatusText = (status: ReservationRoomDetail['status']) =>
  status === 'nyci' ? 'Not yet checked in' : status === 'checked-in' ? 'Checked in' : 'Checked out';

/** "Room 10" or "Unassigned". */
export const roomNumberText = (room: Pick<ReservationRoomDetail, 'roomNumber'>) =>
  room.roomNumber ? `Room ${room.roomNumber}` : 'Unassigned';

export const roomPlaceText = (room: Pick<ReservationRoomDetail, 'locationName' | 'roomTypeName'>) =>
  [room.locationName, room.roomTypeName].filter(Boolean).join(' / ');
