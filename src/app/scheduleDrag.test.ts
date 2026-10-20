import { createScheduleState } from '../api/scheduleData';
import type { ScheduleBlock, ScheduleClosure, ScheduleRoom } from '../api/types';
import { canDrop, isDraggable, toMoveDatesRequest, toMoveRoomRequest } from './scheduleDrag';
import type { DropResult, ScheduleDragState } from './scheduleDrag';

const TODAY = '2026-10-16';
const day = (n: number) => {
  const d = new Date(Date.UTC(2026, 9, 16 + n));
  return d.toISOString().slice(0, 10);
};

const rooms: ScheduleRoom[] = [
  { id: 'a1', number: '1', locationId: 'l', roomTypeId: 'king' },
  { id: 'a2', number: '2', locationId: 'l', roomTypeId: 'king' },
  { id: 'a3', number: '3', locationId: 'l', roomTypeId: 'king' },
  { id: 'q1', number: '4', locationId: 'l', roomTypeId: 'queen' },
  { id: 'q2', number: '5', locationId: 'l', roomTypeId: 'queen' },
];

let n = 0;
const block = (over: Partial<ScheduleBlock> & { roomId: string }): ScheduleBlock => ({
  kind: 'reservation',
  id: `b${++n}`,
  reservationId: `r${n}`,
  confirmationNumber: `GR-${n}`,
  guestName: 'Guest',
  guestType: 'guest',
  startDate: day(2),
  endDate: day(4),
  status: 'confirmed',
  roomCount: 1,
  roomTypeLocked: false,
  version: 'v1',
  ...over,
});
const closure = (over: Partial<ScheduleClosure> & { roomId: string }): ScheduleClosure => ({
  kind: 'closure',
  id: `c${++n}`,
  startDate: day(2),
  endDate: day(4),
  reason: 'Reserved: Fixed Loss',
  endMarker: false,
  ...over,
});
const state = (blocks: ScheduleBlock[], closures: ScheduleClosure[] = []): ScheduleDragState => ({
  today: TODAY,
  rooms,
  blocks,
  closures,
});
const ok = (r: DropResult) => {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r;
};

describe('canDrop: room changes', () => {
  it('allows a drop on a free room of the same room type', () => {
    const src = block({ roomId: 'a1' });
    const r = ok(canDrop(src, { roomId: 'a2', startDate: src.startDate }, state([src])));
    expect(r).toMatchObject({ kind: 'room-change', dialog: 'room-change' });
    expect(r.moves).toEqual([
      {
        blockId: src.id,
        fromRoomId: 'a1',
        toRoomId: 'a2',
        fromStart: day(2),
        toStart: day(2),
        fromEnd: day(4),
        toEnd: day(4),
      },
    ]);
    expect(r.splitMoves).toBeNull();
  });
  it('allows a different room type when the reservation is not locked', () => {
    const src = block({ roomId: 'a1' });
    expect(canDrop(src, { roomId: 'q1', startDate: src.startDate }, state([src])).ok).toBe(true);
  });
  it('refuses a different room type when locked, but allows the same type', () => {
    const src = block({ roomId: 'a1', roomTypeLocked: true });
    const s = state([src]);
    expect(canDrop(src, { roomId: 'q1', startDate: src.startDate }, s)).toMatchObject({
      ok: false,
      reason: 'room-type-locked',
    });
    expect(canDrop(src, { roomId: 'a2', startDate: src.startDate }, s).ok).toBe(true);
  });
  it('allows NYCI and checked-in rooms to change room on their dates', () => {
    const nyci = block({ roomId: 'a1', status: 'nyci', startDate: TODAY, endDate: day(2) });
    const inHouse = block({
      roomId: 'a3',
      status: 'checked-in',
      startDate: day(-1),
      endDate: day(2),
    });
    expect(canDrop(nyci, { roomId: 'a2', startDate: TODAY }, state([nyci])).ok).toBe(true);
    // Moving a checked-in stay keeps its (past) arrival: that is not "dragging to the past".
    expect(canDrop(inHouse, { roomId: 'a2', startDate: day(-1) }, state([inHouse])).ok).toBe(true);
  });
  it('refuses when nothing changes and for unknown rooms', () => {
    const src = block({ roomId: 'a1' });
    expect(canDrop(src, { roomId: 'a1', startDate: src.startDate }, state([src]))).toMatchObject({
      reason: 'no-change',
    });
    expect(canDrop(src, { roomId: 'zz', startDate: src.startDate }, state([src]))).toMatchObject({
      reason: 'unknown-room',
    });
    expect(canDrop(src, { roomId: 'a2', startDate: 'soon' }, state([src]))).toMatchObject({
      reason: 'invalid-date',
    });
  });
  it('moves only the dragged room of a multi-room reservation to a new room', () => {
    const a = block({ roomId: 'a1', reservationId: 'rs', roomCount: 2 });
    const b = block({ roomId: 'a2', reservationId: 'rs', roomCount: 2 });
    const r = ok(canDrop(a, { roomId: 'a3', startDate: a.startDate }, state([a, b])));
    expect(r.dialog).toBe('room-change');
    expect(r.moves).toHaveLength(1);
  });
  it('refuses a room already holding a sibling of the same reservation on those nights', () => {
    const a = block({ roomId: 'a1', reservationId: 'rs', roomCount: 2 });
    const b = block({ roomId: 'a2', reservationId: 'rs', roomCount: 2 });
    expect(canDrop(a, { roomId: 'a2', startDate: a.startDate }, state([a, b]))).toMatchObject({
      reason: 'reservation-conflict',
    });
  });
});

describe('canDrop: refusals', () => {
  it('refuses closures and checked-out rooms', () => {
    const c = closure({ roomId: 'a1' });
    const out = block({
      roomId: 'a1',
      status: 'checked-out',
      startDate: day(-3),
      endDate: day(-1),
    });
    expect(canDrop(c, { roomId: 'a2', startDate: c.startDate }, state([], [c]))).toMatchObject({
      reason: 'closure',
    });
    expect(canDrop(out, { roomId: 'a2', startDate: out.startDate }, state([out]))).toMatchObject({
      reason: 'checked-out',
    });
    expect(isDraggable(c)).toBe(false);
    expect(isDraggable(out)).toBe(false);
    expect(isDraggable(block({ roomId: 'a1', status: 'checked-in' }))).toBe(true);
  });
  it('refuses a room with a reservation on the same dates, and names the room', () => {
    const src = block({ roomId: 'a1' });
    const other = block({ roomId: 'a2', startDate: day(3), endDate: day(6) });
    expect(canDrop(src, { roomId: 'a2', startDate: src.startDate }, state([src, other]))).toEqual({
      ok: false,
      reason: 'reservation-conflict',
      conflictRoomIds: ['a2'],
      splitMoves: null,
    });
  });
  it('refuses a room with a closure on the same dates', () => {
    const src = block({ roomId: 'a1' });
    const c = closure({ roomId: 'a2', startDate: day(3), endDate: day(9) });
    expect(
      canDrop(src, { roomId: 'a2', startDate: src.startDate }, state([src], [c])),
    ).toMatchObject({
      reason: 'closure-conflict',
      conflictRoomIds: ['a2'],
    });
  });
  it('treats a checked-out stay in the target room as a reservation', () => {
    const src = block({ roomId: 'a1', startDate: day(-3), endDate: day(-1), status: 'nyci' });
    const out = block({
      roomId: 'a2',
      startDate: day(-4),
      endDate: day(-2),
      status: 'checked-out',
    });
    expect(
      canDrop(src, { roomId: 'a2', startDate: src.startDate }, state([src, out])),
    ).toMatchObject({
      reason: 'reservation-conflict',
    });
  });
  it('allows same-day turnover on both sides (departure day = arrival day)', () => {
    const src = block({ roomId: 'a1', startDate: day(2), endDate: day(4) });
    const before = block({ roomId: 'a2', startDate: day(0), endDate: day(2) });
    const after = block({ roomId: 'a2', startDate: day(4), endDate: day(6) });
    expect(canDrop(src, { roomId: 'a2', startDate: day(2) }, state([src, before, after])).ok).toBe(
      true,
    );
    // One night later it collides with the next arrival.
    expect(
      canDrop(src, { roomId: 'a2', startDate: day(3) }, state([src, before, after])),
    ).toMatchObject({
      reason: 'reservation-conflict',
    });
  });
});

describe('canDrop: date changes', () => {
  it('allows a future date in the same room and uses the single date-change dialog', () => {
    const src = block({ roomId: 'a1', startDate: day(2), endDate: day(4) });
    const r = ok(canDrop(src, { roomId: 'a1', startDate: day(10) }, state([src])));
    expect(r).toMatchObject({ kind: 'date-change', dialog: 'date-change-single' });
    expect(r.moves[0]).toMatchObject({ toStart: day(10), toEnd: day(12) });
  });
  it('ignores the stay itself when the new dates overlap the old ones', () => {
    const src = block({ roomId: 'a1', startDate: day(2), endDate: day(5) });
    expect(canDrop(src, { roomId: 'a1', startDate: day(3) }, state([src])).ok).toBe(true);
  });
  it('blocks the past, allows today', () => {
    const src = block({ roomId: 'a1', startDate: day(2), endDate: day(4) });
    expect(canDrop(src, { roomId: 'a1', startDate: day(-1) }, state([src]))).toMatchObject({
      reason: 'past',
    });
    expect(canDrop(src, { roomId: 'a1', startDate: TODAY }, state([src])).ok).toBe(true);
  });
  it('does not change the dates of a checked-in room', () => {
    const src = block({ roomId: 'a1', status: 'checked-in', startDate: day(-1), endDate: day(2) });
    expect(canDrop(src, { roomId: 'a1', startDate: day(3) }, state([src]))).toMatchObject({
      reason: 'checked-in-dates',
    });
  });
  it('allows a different room type together with new dates unless locked', () => {
    const src = block({ roomId: 'a1' });
    const r = ok(canDrop(src, { roomId: 'q1', startDate: day(6) }, state([src])));
    expect(r.kind).toBe('room-and-date-change');
    expect(r.dialog).toBe('date-change-single');
    const locked = block({ roomId: 'a1', roomTypeLocked: true });
    expect(canDrop(locked, { roomId: 'q1', startDate: day(6) }, state([locked]))).toMatchObject({
      reason: 'room-type-locked',
    });
  });
  it('handles month, year and leap-day boundaries', () => {
    const src = block({ roomId: 'a1', startDate: '2026-10-28', endDate: '2026-11-02' });
    const r = ok(canDrop(src, { roomId: 'a1', startDate: '2026-12-30' }, state([src])));
    expect(r.moves[0]).toMatchObject({ toStart: '2026-12-30', toEnd: '2027-01-04' });
    const leap = block({ roomId: 'a1', startDate: '2027-12-28', endDate: '2028-01-01' });
    const l = ok(canDrop(leap, { roomId: 'a1', startDate: '2028-02-27' }, state([leap])));
    expect(l.moves[0].toEnd).toBe('2028-03-02');
  });
});

describe('canDrop: multi-room reservations', () => {
  const trio = () => [
    block({ roomId: 'a1', reservationId: 'rs', roomCount: 3, startDate: day(2), endDate: day(5) }),
    block({ roomId: 'a2', reservationId: 'rs', roomCount: 3, startDate: day(2), endDate: day(5) }),
    block({ roomId: 'q1', reservationId: 'rs', roomCount: 3, startDate: day(2), endDate: day(5) }),
  ];
  it('moves every room by the same shift and offers the split', () => {
    const blocks = trio();
    const r = ok(canDrop(blocks[0], { roomId: 'a1', startDate: day(9) }, state(blocks)));
    expect(r.dialog).toBe('date-change-multi');
    expect(r.moves.map((m) => [m.toRoomId, m.toStart, m.toEnd])).toEqual([
      ['a1', day(9), day(12)],
      ['a2', day(9), day(12)],
      ['q1', day(9), day(12)],
    ]);
    expect(r.moves[0].blockId).toBe(blocks[0].id);
    expect(r.splitMoves).toHaveLength(1);
    expect(r.splitMoves?.[0].blockId).toBe(blocks[0].id);
  });
  it('detects a conflict in ANY of the rooms and still offers the split when this room is free', () => {
    const blocks = trio();
    const blocker = block({ roomId: 'q1', startDate: day(8), endDate: day(10) });
    const r = canDrop(blocks[0], { roomId: 'a1', startDate: day(9) }, state([...blocks, blocker]));
    expect(r).toMatchObject({ ok: false, reason: 'reservation-conflict', conflictRoomIds: ['q1'] });
    expect(r.splitMoves).toHaveLength(1);
  });
  it('detects a closure in a sibling room', () => {
    const blocks = trio();
    const c = closure({ roomId: 'a2', startDate: day(10), endDate: day(11) });
    expect(
      canDrop(blocks[0], { roomId: 'a1', startDate: day(9) }, state(blocks, [c])),
    ).toMatchObject({ reason: 'closure-conflict', conflictRoomIds: ['a2'] });
  });
  it('offers no split when the dragged room itself conflicts', () => {
    const blocks = trio();
    const blocker = block({ roomId: 'a1', startDate: day(8), endDate: day(10) });
    const r = canDrop(blocks[0], { roomId: 'a1', startDate: day(9) }, state([...blocks, blocker]));
    expect(r).toMatchObject({ ok: false, reason: 'reservation-conflict', splitMoves: null });
  });
  it('lets rooms of the reservation shift over their own old nights', () => {
    const blocks = trio();
    expect(canDrop(blocks[1], { roomId: 'a2', startDate: day(3) }, state(blocks)).ok).toBe(true);
  });
  it('refuses when a sibling is checked in or out, but offers the split', () => {
    const blocks = trio();
    blocks[2].status = 'checked-out';
    const r = canDrop(blocks[0], { roomId: 'a1', startDate: day(9) }, state(blocks));
    expect(r).toMatchObject({ ok: false, reason: 'linked-room-locked' });
    expect(r.splitMoves).toHaveLength(1);
  });
  it('refuses to guess when siblings are not loaded, but offers the split', () => {
    const blocks = trio();
    const r = canDrop(
      blocks[0],
      { roomId: 'a1', startDate: day(9) },
      state([blocks[0], blocks[1]]),
    );
    expect(r).toMatchObject({ ok: false, reason: 'linked-rooms-not-loaded' });
    expect(r.splitMoves).toHaveLength(1);
  });
  it('moves all rooms and changes the dragged room together (room-and-date-change)', () => {
    const blocks = trio();
    const r = ok(canDrop(blocks[0], { roomId: 'a3', startDate: day(9) }, state(blocks)));
    expect(r.kind).toBe('room-and-date-change');
    expect(r.moves[0].toRoomId).toBe('a3');
    expect(r.moves.slice(1).map((m) => m.toRoomId)).toEqual(['a2', 'q1']);
  });
  it('blocks the past for all rooms', () => {
    const blocks = trio();
    expect(canDrop(blocks[0], { roomId: 'a1', startDate: day(-2) }, state(blocks))).toMatchObject({
      reason: 'past',
    });
  });
});

describe('request builders', () => {
  const REQ = 'req-12345678';
  it('maps a room change to moveRoom with the guard and idempotency key', () => {
    const src = block({ roomId: 'a1', version: 'v7' });
    const r = ok(canDrop(src, { roomId: 'a2', startDate: src.startDate }, state([src])));
    expect(toMoveRoomRequest(r, src, REQ)).toEqual({
      reservationRoomId: src.id,
      toRoomId: 'a2',
      fromRoomId: 'a1',
      version: 'v7',
      requestId: REQ,
    });
  });
  it('maps dates to moveDates, with scope this-room for the split link', () => {
    const a = block({ roomId: 'a1', reservationId: 'rs', roomCount: 2, version: 'v3' });
    const b = block({ roomId: 'a2', reservationId: 'rs', roomCount: 2 });
    const r = ok(canDrop(a, { roomId: 'a1', startDate: day(9) }, state([a, b])));
    expect(toMoveDatesRequest(r, a, REQ)).toEqual({
      reservationRoomId: a.id,
      fromRoomId: 'a1',
      fromStartDate: a.startDate,
      toStartDate: day(9),
      scope: 'all-rooms',
      toRoomId: undefined,
      version: 'v3',
      requestId: REQ,
    });
    expect(toMoveDatesRequest(r, a, REQ, 'this-room').scope).toBe('this-room');
    const combined = ok(canDrop(a, { roomId: 'a3', startDate: day(9) }, state([a, b])));
    expect(toMoveDatesRequest(combined, a, REQ).toRoomId).toBe('a3');
  });
  it('throws when the split is not offered', () => {
    const src = block({ roomId: 'a1' });
    const r = ok(canDrop(src, { roomId: 'a1', startDate: day(9) }, state([src])));
    expect(() => toMoveDatesRequest(r, src, REQ, 'this-room')).toThrow();
  });
});

describe('past arrivals for every moving room', () => {
  it('refuses a shift that puts a sibling in the past even if the dragged room is fine', () => {
    // Dragged room arrives day 5, its sibling day 1: moving 2 days earlier puts the sibling before today.
    const a = block({
      roomId: 'a1',
      reservationId: 'rs',
      roomCount: 2,
      startDate: day(5),
      endDate: day(7),
    });
    const b = block({
      roomId: 'a2',
      reservationId: 'rs',
      roomCount: 2,
      startDate: day(1),
      endDate: day(3),
    });
    const r = canDrop(a, { roomId: 'a1', startDate: day(3) }, state([a, b]));
    expect(r).toMatchObject({ ok: false, reason: 'past' });
    // The split alternative (this room only) stays offered.
    expect(r.ok === false && r.splitMoves).not.toBeNull();
  });
});

describe('canDrop on the mock inventories', () => {
  it('follows the rules on the default data', () => {
    const s = createScheduleState(TODAY);
    const drag: ScheduleDragState = { ...s, today: TODAY };
    const locked = s.blocks.find((b) => b.roomTypeLocked);
    expect(locked).toBeDefined();
    const closed = s.closures[0];
    const free = s.blocks.find(
      (b) => b.status === 'confirmed' && b.roomCount === 1 && !b.roomTypeLocked,
    );
    expect(
      canDrop(free!, { roomId: closed.roomId, startDate: closed.startDate }, drag),
    ).toMatchObject({
      reason: 'closure-conflict',
    });
  });
  it('answers in well under a few milliseconds per drop at 200 rooms x 30 days', () => {
    const s = createScheduleState(TODAY, 'large');
    const drag: ScheduleDragState = { ...s, today: TODAY };
    const src = s.blocks.find((b) => b.status === 'confirmed')!;
    const t0 = performance.now();
    const runs = 200;
    for (let i = 0; i < runs; i++) {
      canDrop(src, { roomId: s.rooms[i % s.rooms.length].id, startDate: day(3 + (i % 20)) }, drag);
    }
    expect((performance.now() - t0) / runs).toBeLessThan(5);
  });
});
