import { describe, expect, it } from 'vitest';
import type { ListStatus, ReservationListRow } from '../api';
import {
  checkInLabel,
  failedReservationIds,
  failureReason,
  roomResultLabel,
  roomsToCheckIn,
  summarizeCheckIn,
  type RoomCheckInResult,
} from './bulkCheckIn';
import { isSelectable } from './reservationList';

const row = (
  id: string,
  ...rooms: (ListStatus | [ListStatus, string | null])[]
): ReservationListRow => ({
  id,
  confirmationNumber: `GR-${id}`,
  arrival: '2026-10-16',
  departure: '2026-10-18',
  guestName: 'G',
  reserverName: null,
  blockName: null,
  locationId: null,
  locationName: null,
  roomTypeId: null,
  roomTypeName: null,
  rooms: rooms.map((r, i) => {
    const [status, roomNumber] = Array.isArray(r) ? r : [r, `${100 + i}`];
    return { id: `${id}-${i}`, status, roomNumber };
  }),
  status: 'not-checked-in',
});

describe('selection rules (Figma P2), one case per row type', () => {
  it('single room checked in: not selectable', () => {
    expect(isSelectable(row('a', 'checked-in'))).toBe(false);
  });
  it('single room checked out: not selectable', () => {
    expect(isSelectable(row('a', 'checked-out'))).toBe(false);
  });
  it('single room canceled: not selectable', () => {
    expect(isSelectable(row('a', 'canceled'))).toBe(false);
  });
  it('single room not checked in: selectable', () => {
    expect(isSelectable(row('a', 'not-checked-in'))).toBe(true);
  });
  it('single unassigned room: selectable (fails with an error when attempted)', () => {
    expect(isSelectable(row('a', ['not-checked-in', null]))).toBe(true);
  });
  it('multi-room, none checked in: selectable', () => {
    expect(isSelectable(row('a', 'not-checked-in', 'not-checked-in'))).toBe(true);
  });
  it('multi-room with an unassigned room: selectable', () => {
    expect(isSelectable(row('a', 'not-checked-in', ['not-checked-in', null]))).toBe(true);
  });
  it('multi-room partially checked in: selectable, only the waiting room counts', () => {
    const partial = row('a', 'checked-in', 'not-checked-in');
    expect(isSelectable(partial)).toBe(true);
    expect(roomsToCheckIn([partial]).map((r) => r.reservationRoomId)).toEqual(['a-1']);
  });
  it('multi-room fully checked in: not selectable', () => {
    expect(isSelectable(row('a', 'checked-in', 'checked-in'))).toBe(false);
  });
});

describe('roomsToCheckIn', () => {
  it('counts rooms, not reservations', () => {
    const rooms = roomsToCheckIn([
      row('a', 'not-checked-in'),
      row('b', 'not-checked-in', 'not-checked-in'),
    ]);
    expect(rooms).toHaveLength(3);
    expect(rooms[0]).toMatchObject({
      reservationId: 'a',
      confirmationNumber: 'GR-a',
      roomNumber: '100',
    });
  });
  it('is empty for no rows', () => {
    expect(roomsToCheckIn([])).toEqual([]);
  });
});

describe('labels', () => {
  it('reads CHECK IN N ROOMS', () => {
    expect(checkInLabel(3)).toBe('CHECK IN 3 ROOMS');
    expect(checkInLabel(1)).toBe('CHECK IN 1 ROOM');
  });
  it('maps failure codes to the Figma reasons', () => {
    expect(failureReason('unassigned')).toBe('No room assigned.');
    expect(failureReason('no-payment-method')).toBe('No payment method on file.');
    expect(failureReason(undefined)).toMatch(/could not be checked in/i);
  });
  it('labels a room result', () => {
    const [assigned, unassigned] = roomsToCheckIn([
      row('a', 'not-checked-in', ['not-checked-in', null]),
    ]);
    expect(roomResultLabel(assigned)).toBe('Reservation GR-a | Room 100');
    expect(roomResultLabel(unassigned)).toBe('Reservation GR-a | Unassigned');
  });
});

describe('summarizeCheckIn', () => {
  const [r1, r2, r3] = roomsToCheckIn([
    row('a', 'not-checked-in', 'not-checked-in', 'not-checked-in'),
  ]);
  const ok = (room: typeof r1): RoomCheckInResult => ({ room, failure: null });
  const bad = (room: typeof r1): RoomCheckInResult => ({ room, failure: 'No room assigned.' });

  it('splits successes and failures with titles', () => {
    const s = summarizeCheckIn([ok(r1), ok(r2), bad(r3)]);
    expect(s.successTitle).toBe('2 Rooms Successfully Checked In.');
    expect(s.failureTitle).toBe('1 room could not be checked in:');
    expect(s.announcement).toBe('2 rooms checked in. 1 room could not be checked in.');
  });
  it('has no failure title when everything succeeded, and no success title when all failed', () => {
    expect(summarizeCheckIn([ok(r1)]).failureTitle).toBeNull();
    expect(summarizeCheckIn([bad(r1)]).successTitle).toBeNull();
  });
  it('lists the reservations with a failed room', () => {
    expect([...failedReservationIds([ok(r1), bad(r2)])]).toEqual(['a']);
  });
});
