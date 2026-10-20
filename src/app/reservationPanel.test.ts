import type { ReservationRoomDetail } from '../api/types';
import {
  checkInText,
  checkOutText,
  guestCountText,
  initialRoomIndex,
  isEditable,
  reservationTitle,
  roomNumberText,
  roomPlaceText,
  stepRoomIndex,
  statusLabel,
} from './reservationPanel';

const room = (id: string): ReservationRoomDetail => ({
  id,
  roomId: id,
  roomNumber: id,
  locationName: 'Main',
  roomTypeName: 'Suite',
  status: 'nyci',
  arrival: '2026-10-16',
  departure: '2026-10-18',
});

describe('reservation panel copy', () => {
  it('titles the reservation, with the room count only for several rooms', () => {
    expect(reservationTitle({ confirmationNumber: 'GR-1', rooms: [room('a')] })).toBe(
      'Reservation #GR-1',
    );
    expect(
      reservationTitle({ confirmationNumber: 'GR-1', rooms: [room('a'), room('b'), room('c')] }),
    ).toBe('Reservation #GR-1 (3 Rooms)');
  });

  it('formats the stay lines', () => {
    expect(checkInText({ arrival: '2026-10-16' })).toBe('Check In: 10/16/2026');
    expect(checkOutText({ departure: '2026-10-18', nights: 2 })).toBe(
      'Check Out: 10/18/2026 (2 Nights)',
    );
    expect(checkOutText({ departure: '2026-10-17', nights: 1 })).toBe(
      'Check Out: 10/17/2026 (1 Night)',
    );
  });

  it('counts guests with singular forms and no children when there are none', () => {
    expect(guestCountText(2, 2)).toBe('2 Adults 2 Children');
    expect(guestCountText(1, 1)).toBe('1 Adult 1 Child');
    expect(guestCountText(3, 0)).toBe('3 Adults');
  });

  it('status label only after check in, canceled in red', () => {
    expect(statusLabel('confirmed')).toBeNull();
    expect(statusLabel('pending')).toBeNull();
    expect(statusLabel('checked-in')).toEqual({ text: 'Checked In', tone: 'success' });
    expect(statusLabel('checked-out')?.text).toBe('Checked Out');
    expect(statusLabel('cancelled')).toEqual({ text: 'Canceled', tone: 'error' });
  });

  it('editable until checked out or canceled', () => {
    expect(isEditable('confirmed')).toBe(true);
    expect(isEditable('checked-in')).toBe(true);
    expect(isEditable('checked-out')).toBe(false);
    expect(isEditable('cancelled')).toBe(false);
  });

  it('starts on the requested room, else the first; arrows wrap', () => {
    const rooms = [room('a'), room('b'), room('c')];
    expect(initialRoomIndex(rooms, 'c')).toBe(2);
    expect(initialRoomIndex(rooms, 'zzz')).toBe(0);
    expect(initialRoomIndex(rooms)).toBe(0);
    expect(stepRoomIndex(2, 1, 3)).toBe(0);
    expect(stepRoomIndex(0, -1, 3)).toBe(2);
    expect(stepRoomIndex(0, 1, 0)).toBe(0);
  });

  it('names rooms, including unassigned', () => {
    expect(roomNumberText({ roomNumber: '10' })).toBe('Room 10');
    expect(roomNumberText({ roomNumber: null })).toBe('Unassigned');
    expect(roomPlaceText({ locationName: 'Main', roomTypeName: 'Suite' })).toBe('Main / Suite');
    expect(roomPlaceText({ locationName: null, roomTypeName: null })).toBe('');
  });
});
