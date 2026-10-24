import { ApiError } from '../api/types';
import type { ScheduleBlock, ScheduleClosure, ScheduleRoom } from '../api/types';
import {
  addRoomBlocker,
  addRoomEstimate,
  addRoomFailure,
  defaultAddRoomForm,
  isRoomFreeForStay,
  roomsFreeForStay,
  toAddRoomRequest,
  validateAddRoom,
} from './addRoom';

const err = (status: number, code?: string) =>
  new ApiError(status, 'x', code ? { code } : undefined);

const block = (roomId: string, startDate: string, endDate: string) =>
  ({ roomId, startDate, endDate }) as ScheduleBlock;
const closure = (roomId: string, startDate: string, endDate: string) =>
  ({ roomId, startDate, endDate }) as ScheduleClosure;
const rooms = ['a', 'b', 'c', 'd'].map((id) => ({ id }) as ScheduleRoom);

describe('rooms free for the whole stay', () => {
  const blocks = [
    block('a', '2026-10-20', '2026-10-22'), // inside the stay
    block('b', '2026-10-18', '2026-10-21'), // leaves during the stay
    block('c', '2026-10-17', '2026-10-20'), // leaves on the arrival day: turnover
  ];
  const closures = [closure('d', '2026-10-23', '2026-10-30')]; // starts the night before departure
  const arrival = '2026-10-20';
  const departure = '2026-10-24';

  it('excludes a room booked or closed on any night of the stay', () => {
    expect(roomsFreeForStay(rooms, blocks, closures, arrival, departure).map((r) => r.id)).toEqual([
      'c',
    ]);
  });

  it('a stay that ends on the arrival day, or starts on the departure day, does not block', () => {
    expect(isRoomFreeForStay('c', blocks, [], arrival, departure)).toBe(true);
    expect(
      isRoomFreeForStay('a', [block('a', '2026-10-24', '2026-10-26')], [], arrival, departure),
    ).toBe(true);
  });

  it('a room booked for a single night inside the stay is not free', () => {
    expect(
      isRoomFreeForStay('a', [block('a', '2026-10-22', '2026-10-23')], [], arrival, departure),
    ).toBe(false);
  });
});

describe('slot holds (hook until PR #171 lands)', () => {
  const arrival = '2026-10-20';
  const departure = '2026-10-24';
  const hold = { roomId: 'a', startDate: '2026-10-22', endDate: '2026-10-23', heldBy: 'u2' };
  it("another user's hold makes the room unavailable; the holder's own hold does not", () => {
    expect(isRoomFreeForStay('a', [], [], arrival, departure, [hold], 'u1')).toBe(false);
    expect(isRoomFreeForStay('a', [], [], arrival, departure, [hold], 'u2')).toBe(true);
    expect(
      roomsFreeForStay(rooms, [], [], arrival, departure, [hold], 'u1').map((r) => r.id),
    ).toEqual(['b', 'c', 'd']);
  });
  it('a hold outside the stay does not matter, and without holds nothing changes', () => {
    const later = { ...hold, startDate: '2026-10-24', endDate: '2026-10-25' };
    expect(isRoomFreeForStay('a', [], [], arrival, departure, [later], 'u1')).toBe(true);
    expect(isRoomFreeForStay('a', [], [], arrival, departure)).toBe(true);
  });
  // TODO(#171): once slot holds exist on main, feed them from the schedule data into
  // AddRoomPanel and the mock addRoom (`holdsOnStay`) and add an integration test: a room held by
  // another user is not listed and addRoom answers 409 `conflict`.
  it.todo('Add Another Room skips rooms held by another user (needs #171)');
});

describe('validateAddRoom', () => {
  const free = new Set(['a']);
  it('needs an adult and keeps counts in range; the room is optional', () => {
    expect(validateAddRoom({ adults: 1, children: 0, roomId: '' }, free)).toEqual({});
    expect(validateAddRoom({ adults: 0, children: 0, roomId: '' }, free).adults).toBeDefined();
    expect(validateAddRoom({ adults: 99, children: 0, roomId: '' }, free).adults).toBeDefined();
    expect(validateAddRoom({ adults: 1, children: -1, roomId: '' }, free).children).toBeDefined();
  });
  it('refuses a room that is not free', () => {
    expect(validateAddRoom({ adults: 2, children: 0, roomId: 'a' }, free)).toEqual({});
    expect(validateAddRoom({ adults: 2, children: 0, roomId: 'z' }, free).room).toMatch(
      /booked or closed/,
    );
  });
});

describe('toAddRoomRequest', () => {
  const reservation = { id: 'rs-1', version: 'r4' };
  it('sends the version, no dates, and null for Unassigned', () => {
    const request = toAddRoomRequest(defaultAddRoomForm(), reservation, 'req-12345678');
    expect(request).toEqual({
      requestId: 'req-12345678',
      reservationId: 'rs-1',
      version: 'r4',
      roomId: null,
      adults: 2,
      children: 0,
    });
  });
  it('names the lead occupant when chosen', () => {
    const lead = { id: 'm1', memberNumber: 'MEM-1', name: 'Ann', email: '', phone: '' };
    const request = toAddRoomRequest(
      { ...defaultAddRoomForm(), roomId: 'rm-1', leadOccupant: lead },
      reservation,
      'req-12345678',
    );
    expect(request).toMatchObject({
      roomId: 'rm-1',
      leadOccupant: { name: 'Ann', memberId: 'm1' },
    });
  });
});

describe('estimate and blocker', () => {
  it('multiplies the stay nights by the room type rate', () => {
    expect(
      addRoomEstimate({ arrival: '2026-10-20', departure: '2026-10-23' }, { nightlyRate: 100 }),
    ).toBe(300);
    expect(
      addRoomEstimate({ arrival: '2026-10-20', departure: '2026-10-23' }, undefined),
    ).toBeNull();
  });
  it('explains why the panel cannot be used', () => {
    const open = { status: 'confirmed' as const, rooms: [{ status: 'nyci' }] as never };
    expect(addRoomBlocker(open)).toBeNull();
    expect(addRoomBlocker({ ...open, status: 'cancelled' })).toMatch(/no longer/);
    expect(
      addRoomBlocker({ ...open, folioCharges: [{ type: 'room-rate', status: 'posted' }] }),
    ).toMatch(/night audit/);
  });
});

describe('addRoomFailure', () => {
  it('a room conflict shows on the Room field and reloads', () => {
    expect(addRoomFailure(err(409, 'conflict'))).toMatchObject({ roomError: true, refetch: true });
  });
  it('403 is final; stale and not-editable reload', () => {
    expect(addRoomFailure(err(403, 'forbidden')).refetch).toBe(false);
    expect(addRoomFailure(err(409, 'stale')).refetch).toBe(true);
    expect(addRoomFailure(err(409, 'not-editable')).refetch).toBe(true);
  });
  it('another 4xx is final; 5xx, 408 and network errors are an unknown outcome', () => {
    expect(addRoomFailure(err(400, 'invalid-query')).refetch).toBe(false);
    for (const e of [err(500), err(408), new Error('offline')]) {
      expect(addRoomFailure(e)).toMatchObject({ refetch: true, outcomeUnknown: true });
    }
  });
});
