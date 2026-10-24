import type { ReservationDetail } from '../api/types';
import { splitCta, UNASSIGNED_REASON } from './splitCta';

type Room = ReservationDetail['rooms'][number]['status'];
const input = (statuses: Room[], extra: Partial<ReservationDetail> = {}) => ({
  status: 'confirmed' as ReservationDetail['status'],
  rooms: statuses.map((status, i) => ({
    id: `rr-${i}`,
    roomId: `rm-${i}`,
    roomNumber: String(i),
    locationName: 'L',
    roomTypeName: 'T',
    status,
    arrival: '2026-10-16',
    departure: '2026-10-18',
  })),
  ...extra,
});
const label = (statuses: Room[], extra?: Partial<ReservationDetail>) =>
  splitCta(input(statuses, extra)).primary.label;

describe('splitCta', () => {
  it('check in for one room, all rooms, or the remaining ones', () => {
    expect(label(['nyci'])).toBe('Check In');
    expect(label(['nyci', 'nyci', 'nyci'])).toBe('Check In All Rooms');
    expect(label(['checked-in', 'nyci', 'nyci'])).toBe('Check In Remaining Rooms');
    expect(label(['checked-out', 'nyci'])).toBe('Check In Remaining Rooms');
  });

  it('check out for one room, all rooms, or the remaining ones', () => {
    expect(label(['checked-in'])).toBe('Check Out');
    expect(label(['checked-in', 'checked-in'])).toBe('Check Out All Rooms');
    expect(label(['checked-in', 'checked-out'])).toBe('Check Out Remaining Rooms');
  });

  it('manage reservation (outlined) when cancelled or everything is checked out', () => {
    const done = splitCta(input(['checked-out', 'checked-out']));
    expect(done.primary).toMatchObject({ id: 'manage', variant: 'outlined' });
    expect(splitCta(input(['nyci'], { status: 'cancelled' })).primary.id).toBe('manage');
  });

  it('blocks check in while a room to check in is unassigned', () => {
    const unassigned = input(['nyci']);
    unassigned.rooms[0].roomId = null;
    expect(splitCta(unassigned).primary.blockedReason).toBe(UNASSIGNED_REASON);
    expect(splitCta(input(['nyci'])).primary.blockedReason).toBeNull();
    // Check out is not blocked by it.
    const inHouse = input(['checked-in']);
    inHouse.rooms[0].roomId = null;
    expect(splitCta(inHouse).primary.blockedReason).toBeNull();
  });
});
