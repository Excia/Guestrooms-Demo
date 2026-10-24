import type { ScheduleBlock } from '../api/types';
import { blockLayout } from './schedule';
import { canDrop, toMoveDatesRequest } from './scheduleDrag';
import {
  applyHousekeeping,
  applyMoves,
  blockAriaLabel,
  blockMarkers,
  blockSpan,
  clampShift,
  columnAtX,
  emptyCellAction,
  HOUSEKEEPING_OPTIONS,
  housekeepingChip,
  housekeepingFailure,
  itemAtColumn,
  mergeChangedBlocks,
  moveCursor,
  moveFailure,
  moveDialogCopy,
  refusalMessage,
  revertMoves,
  rowIndexAt,
  roomRowAt,
  roomRowScrollTop,
  shiftFromDistance,
  turnoverGap,
  yearLabel,
} from './scheduleGrid';

const block = (over: Partial<ScheduleBlock> = {}): ScheduleBlock => ({
  kind: 'reservation',
  id: 'b1',
  reservationId: 'r1',
  confirmationNumber: 'GR-1',
  guestName: 'Ada Lovelace',
  guestType: 'guest',
  roomId: 'a',
  startDate: '2026-10-20',
  endDate: '2026-10-22',
  status: 'confirmed',
  roomCount: 1,
  roomTypeLocked: false,
  version: 'v1',
  ...over,
});

describe('blockSpan', () => {
  it('runs from the middle of the arrival column to the middle of the departure column', () => {
    const layout = blockLayout(
      { startDate: '2026-10-21', endDate: '2026-10-23' },
      '2026-10-20',
      7,
    )!;
    const span = blockSpan(layout, 7);
    expect(span.start).toBeCloseTo(1.5 / 7);
    expect(span.end).toBeCloseTo(3.5 / 7);
  });
  it('reaches the range edges for clipped stays', () => {
    const layout = blockLayout(
      { startDate: '2026-10-18', endDate: '2026-11-30' },
      '2026-10-20',
      7,
    )!;
    expect(blockSpan(layout, 7)).toEqual({ start: 0, end: 1 });
  });
  it('ends at the edge when the departure is the day after the last column', () => {
    const layout = blockLayout(
      { startDate: '2026-10-25', endDate: '2026-10-27' },
      '2026-10-20',
      7,
    )!;
    expect(blockSpan(layout, 7).end).toBe(1);
  });
});

describe('pointer geometry', () => {
  it('rounds a distance to whole days', () => {
    expect(shiftFromDistance(190, 190)).toBe(1);
    expect(shiftFromDistance(-100, 190)).toBe(-1);
    expect(shiftFromDistance(80, 190)).toBe(0);
    expect(shiftFromDistance(10, 0)).toBe(0);
  });
  it('finds the row at an offset', () => {
    expect(rowIndexAt(0, 60, 3)).toBe(0);
    expect(rowIndexAt(125, 60, 3)).toBe(2);
    expect(rowIndexAt(180, 60, 3)).toBeNull();
    expect(rowIndexAt(-1, 60, 3)).toBeNull();
  });
  it('offsets room rows by the header and the Unassigned rows', () => {
    // no Unassigned section: the first room starts below the 60px header
    expect(roomRowAt(60, 60, 0, 3)).toBe(0);
    expect(roomRowAt(30, 60, 0, 3)).toBeNull();
    // two Unassigned rows push the first room down to 180
    expect(roomRowAt(120, 60, 2, 3)).toBeNull(); // over an Unassigned row: not a drop target
    expect(roomRowAt(179, 60, 2, 3)).toBeNull();
    expect(roomRowAt(180, 60, 2, 3)).toBe(0);
    expect(roomRowAt(300, 60, 2, 3)).toBe(2);
    expect(roomRowAt(360, 60, 2, 3)).toBeNull();
    // keyboard scrolling lands past the Unassigned rows
    expect(roomRowScrollTop(0, 60, 0)).toBe(0);
    expect(roomRowScrollTop(4, 60, 3)).toBe(420);
  });
  it('keeps the arrival column inside the range', () => {
    expect(clampShift(2, -5, 7)).toBe(-2);
    expect(clampShift(2, 9, 7)).toBe(4);
    expect(clampShift(-3, 4, 7)).toBe(4); // began before the range
    expect(clampShift(-3, -4, 7)).toBe(0);
  });
});

describe('moveCursor', () => {
  const at = { row: 1, col: 1 };
  it('moves one cell and stops at the edges', () => {
    expect(moveCursor(at, 'ArrowDown', 3, 7)).toEqual({ row: 2, col: 1 });
    expect(moveCursor({ row: 2, col: 1 }, 'ArrowDown', 3, 7)).toEqual({ row: 2, col: 1 });
    expect(moveCursor({ row: 0, col: 0 }, 'ArrowLeft', 3, 7)).toEqual({ row: 0, col: 0 });
    expect(moveCursor({ row: 0, col: 6 }, 'ArrowRight', 3, 7)).toEqual({ row: 0, col: 6 });
  });
  it('jumps with Home, End and the page keys', () => {
    expect(moveCursor(at, 'Home', 3, 7).col).toBe(0);
    expect(moveCursor(at, 'End', 3, 7).col).toBe(6);
    expect(moveCursor(at, 'PageDown', 50, 7, 8).row).toBe(9);
    expect(moveCursor(at, 'PageUp', 50, 7, 8).row).toBe(0);
  });
  it('survives an empty grid', () => {
    expect(moveCursor({ row: 0, col: 0 }, 'ArrowDown', 0, 7)).toEqual({ row: 0, col: 0 });
  });
});

describe('itemAtColumn', () => {
  it('finds the item whose nights cover a column', () => {
    const items = [block({ startDate: '2026-10-21', endDate: '2026-10-23' })];
    expect(itemAtColumn(items, '2026-10-20', 7, 0)).toBeUndefined();
    expect(itemAtColumn(items, '2026-10-20', 7, 1)).toBe(items[0]);
    expect(itemAtColumn(items, '2026-10-20', 7, 2)).toBe(items[0]);
    expect(itemAtColumn(items, '2026-10-20', 7, 3)).toBeUndefined();
    expect(itemAtColumn(undefined, '2026-10-20', 7, 1)).toBeUndefined();
  });
});

describe('optimistic moves', () => {
  const move = {
    blockId: 'b1',
    fromRoomId: 'a',
    toRoomId: 'b',
    fromStart: '2026-10-20',
    toStart: '2026-10-23',
    fromEnd: '2026-10-22',
    toEnd: '2026-10-25',
  };
  it('applies and reverts a move without touching other blocks', () => {
    const other = block({ id: 'b2' });
    const moved = applyMoves([block(), other], [move]);
    expect(moved[0]).toMatchObject({ roomId: 'b', startDate: '2026-10-23', endDate: '2026-10-25' });
    expect(moved[1]).toBe(other);
    expect(revertMoves(moved, [move])[0]).toEqual(block());
  });
  it('merges API blocks and drops those that left the range', () => {
    const data = {
      startDate: '2026-10-20',
      days: 7 as const,
      blocks: [block(), block({ id: 'b2' })],
    };
    const merged = mergeChangedBlocks(data, [
      block({ id: 'b1', startDate: '2026-12-01', endDate: '2026-12-03' }),
      block({ id: 'b3', roomId: 'c' }),
    ]);
    expect(merged.map((b) => b.id).sort()).toEqual(['b2', 'b3']);
  });
});

describe('copy', () => {
  const rooms = [
    { id: 'a', number: '1', locationId: 'l', roomTypeId: 't' },
    { id: 'b', number: '2', locationId: 'l', roomTypeId: 't' },
  ];
  const state = (blocks: ScheduleBlock[]) => ({ today: '2026-10-16', rooms, blocks, closures: [] });
  it('has a message for every refusal', () => {
    expect(refusalMessage('closure')).toMatch(/closures cannot/i);
    expect(refusalMessage('reservation-conflict')).toMatch(/reservation/i);
  });
  it('words the Room Change dialog as in Figma', () => {
    const b = block();
    const result = canDrop(b, { roomId: 'b', startDate: b.startDate }, state([b]));
    if (!result.ok) throw new Error('expected ok');
    expect(moveDialogCopy(result, b, '2')).toEqual({
      title: 'Reservation GR-1 Room Change',
      body: 'Please confirm moving this room to Room 2 for dates 10/20/2026 to 10/22/2026.',
      confirmLabel: 'Move to New Room',
    });
  });
  it('words the single and multi-room Date Change dialogs', () => {
    const b = block();
    const single = canDrop(b, { roomId: 'a', startDate: '2026-10-23' }, state([b]));
    if (!single.ok) throw new Error('expected ok');
    expect(moveDialogCopy(single, b, '1')).toMatchObject({
      title: 'Reservation GR-1 Date Change',
      body: 'Moving this room to Room 1 for dates 10/23/2026 to 10/25/2026 will change the total rate for the reservation.',
      confirmLabel: 'Move to New Dates',
    });
    const b1 = block({ roomCount: 2, reservationId: 'r' });
    const b2 = block({ id: 'b2', roomId: 'b', roomCount: 2, reservationId: 'r' });
    const multi = canDrop(b1, { roomId: 'a', startDate: '2026-10-23' }, state([b1, b2]));
    if (!multi.ok) throw new Error('expected ok');
    const copy = moveDialogCopy(multi, b1, '1');
    expect(copy.parts?.emphasis).toBe('all rooms on the reservation');
    expect(copy.body).toMatch(
      /will change the check in and check out dates for all rooms on the reservation and will change the total rate/,
    );
    expect(toMoveDatesRequest(multi, b1, 'req-12345678', 'this-room').scope).toBe('this-room');
  });
  it('names a block with guest, confirmation, status, room and dates', () => {
    expect(blockAriaLabel(block({ status: 'nyci' }), { number: '202' })).toBe(
      'Ada Lovelace, GR-1, not yet checked in, Room 202, 10/20/2026 to 10/22/2026, housekeeping not checked out',
    );
    expect(blockAriaLabel(block({ status: 'checked-in' }), { number: '1' })).toContain(
      'checked in',
    );
  });
  it('names an unassigned block by the missing room', () => {
    expect(blockAriaLabel(block({ roomId: '' }), undefined)).toBe(
      'Ada Lovelace, GR-1, confirmed, Unassigned room, 10/20/2026 to 10/22/2026',
    );
  });
  it('labels the corner with the year or both years', () => {
    expect(yearLabel(['2026-10-20', '2026-10-21'])).toBe('2026');
    expect(yearLabel(['2026-12-30', '2027-01-02'])).toBe('2026/2027');
  });
});

describe('moveFailure', () => {
  const err = (status: number, code?: string, message = 'x') => ({ status, code, message });
  it('treats no response and 5xx as an unknown outcome: no revert, reload, neutral copy', () => {
    for (const e of [
      err(0, 'timeout'),
      err(0, 'network'),
      err(503),
      err(408),
      err(200, 'invalid-response'),
    ]) {
      expect(moveFailure(e)).toEqual({
        revert: false,
        refetch: true,
        message: 'Could not confirm the move. Showing the latest schedule.',
      });
    }
  });
  it('reverts and reloads for 409 and 404', () => {
    for (const e of [err(409, 'conflict'), err(409, 'stale'), err(409, 'not-movable'), err(404)]) {
      expect(moveFailure(e)).toMatchObject({ revert: true, refetch: true });
    }
  });
  it('reverts without a reload for invalid requests', () => {
    expect(moveFailure(err(400, 'invalid-query'))).toMatchObject({ revert: true, refetch: false });
  });
  it('maps known codes to our own copy', () => {
    expect(moveFailure(err(409, 'conflict', 'Room 5 taken')).message).toMatch(/no longer free/);
    expect(moveFailure(err(409, 'not-movable')).message).toMatch(/cannot be moved that way/);
    expect(moveFailure(err(409, 'stale')).message).toMatch(/changed by someone else/);
    expect(moveFailure(err(404)).message).toMatch(/no longer exists/);
    expect(moveFailure(err(400, 'invalid-id')).message).toMatch(/not valid/);
  });
  it('uses safe plain server text only as a fallback detail', () => {
    expect(moveFailure(err(422, 'weird', 'Rate plan closed.')).message).toBe(
      'The move could not be completed: Rate plan closed.',
    );
    expect(moveFailure(err(422, 'weird', '<img src=x onerror=1>')).message).toBe(
      'The move could not be completed.',
    );
    expect(moveFailure(err(422, 'weird', 'see https://evil.example')).message).toBe(
      'The move could not be completed.',
    );
    expect(moveFailure(new Error('boom')).message).toMatch(/Could not confirm/);
  });
});

describe('empty cells', () => {
  const start = '2026-10-16';
  const stay = { startDate: '2026-10-17', endDate: '2026-10-19' };

  it('columnAtX maps a position to a date column, null over the room header or outside', () => {
    // content starts at x=100, 130px room header, 7 columns of 100px
    expect(columnAtX(200, 100, 130 + 700, 130, 7)).toBeNull(); // over the header
    expect(columnAtX(231, 100, 830, 130, 7)).toBe(0);
    expect(columnAtX(330, 100, 830, 130, 7)).toBe(1);
    expect(columnAtX(929, 100, 830, 130, 7)).toBe(6);
    expect(columnAtX(931, 100, 830, 130, 7)).toBeNull();
    expect(columnAtX(300, 100, 100, 130, 7)).toBeNull(); // no room for the dates
  });

  it('a column is free, closed or occupied', () => {
    expect(emptyCellAction([stay], [], start, 7, 0)).toEqual({ kind: 'free' });
    expect(emptyCellAction([stay], [], start, 7, 1)).toEqual({ kind: 'occupied' });
    expect(emptyCellAction([], [stay], start, 7, 1)).toEqual({ kind: 'closed' });
    expect(emptyCellAction(undefined, undefined, start, 7, 3)).toEqual({ kind: 'free' });
    // a closure wins when both cover the column
    expect(emptyCellAction([stay], [stay], start, 7, 1)).toEqual({ kind: 'closed' });
  });
});

describe('blockMarkers', () => {
  const inView = { continuesBefore: false, continuesAfter: false };
  const clippedLeft = { continuesBefore: true, continuesAfter: false };
  const both = { earlyCheckIn: true, lateCheckOut: true };

  it('a real arrival edge gets the early sliver, a real departure edge the late one', () => {
    expect(blockMarkers({ earlyCheckIn: true }, inView)).toEqual({ left: true, right: false });
    expect(blockMarkers({ lateCheckOut: true }, inView)).toEqual({ left: false, right: true });
    expect(blockMarkers(both, inView)).toEqual({ left: true, right: true });
    expect(blockMarkers({}, inView)).toEqual({ left: false, right: false });
  });

  it('an in-house stay that arrived before the range still shows its early sliver, as its visible left edge', () => {
    expect(blockMarkers({ earlyCheckIn: true }, clippedLeft)).toEqual({ left: true, right: false });
    expect(blockMarkers(both, clippedLeft)).toEqual({ left: true, right: true });
  });

  it('a clipped left edge without an early check in has no marker', () => {
    expect(blockMarkers({}, clippedLeft)).toEqual({ left: false, right: false });
    expect(blockMarkers({ lateCheckOut: true }, clippedLeft)).toEqual({ left: false, right: true });
  });

  it('a clipped right edge has no late marker (its departure is out of sight)', () => {
    expect(blockMarkers(both, { continuesBefore: false, continuesAfter: true })).toEqual({
      left: true,
      right: false,
    });
    expect(blockMarkers(both, { continuesBefore: true, continuesAfter: true })).toEqual({
      left: true,
      right: false,
    });
  });

  it('follows blockLayout for a stay that arrived yesterday', () => {
    const layout = blockLayout(
      { startDate: '2026-10-15', endDate: '2026-10-18' },
      '2026-10-16',
      7,
    )!;
    expect(blockMarkers({ earlyCheckIn: true }, layout).left).toBe(true);
  });
});

describe('housekeepingChip', () => {
  const edge = { continuesAfter: false };
  it('is 16, 8 and 4px wide by view, with the H letter in the 7 and 14 day views', () => {
    expect(housekeepingChip('ready', edge, 7)).toMatchObject({ width: 16, letter: true });
    expect(housekeepingChip('ready', edge, 14)).toMatchObject({ width: 8, letter: true });
    expect(housekeepingChip('ready', edge, 30)).toMatchObject({ width: 4, letter: false });
  });
  it('is not drawn without a status, for NYCI, or when the stay goes on past the range', () => {
    expect(housekeepingChip(undefined, edge, 7)).toBeNull();
    expect(housekeepingChip('nyci', edge, 7)).toBeNull();
    expect(housekeepingChip('cleaned', { continuesAfter: true }, 7)).toBeNull();
  });
});

describe('housekeepingChip notes marker and name', () => {
  const edge = { continuesAfter: false };
  it('shows the "+" with notes in the 7 and 14 day views only', () => {
    expect(housekeepingChip('ready', edge, 7, true)?.plus).toBe(true);
    expect(housekeepingChip('ready', edge, 14, true)?.plus).toBe(true);
    expect(housekeepingChip('ready', edge, 30, true)?.plus).toBe(false);
    expect(housekeepingChip('ready', edge, 7, false)?.plus).toBe(false);
  });
  it('names the button with the status, notes and the action', () => {
    expect(housekeepingChip('needs-cleaning', edge, 7)?.name).toBe(
      'Housekeeping: needs cleaning. Change status',
    );
    expect(housekeepingChip('cleaned', edge, 30, true)?.name).toBe(
      'Housekeeping: cleaned, with notes. Change status',
    );
  });
});

describe('HOUSEKEEPING_OPTIONS', () => {
  it('lists the five settable statuses and never NYCI', () => {
    expect(HOUSEKEEPING_OPTIONS).toEqual([
      { value: 'not-checked-out', label: 'Not Checked Out' },
      { value: 'needs-cleaning', label: 'Needs Cleaning' },
      { value: 'cleaned', label: 'Cleaned' },
      { value: 'ready', label: 'Ready' },
      { value: 'needs-maintenance', label: 'Needs Maintenance' },
    ]);
  });
});

describe('applyHousekeeping', () => {
  const a = block({ id: 'a', housekeeping: 'ready', housekeepingNotes: 'old' });
  const b = block({ id: 'b' });
  it('changes the status and keeps the note when none is sent', () => {
    const [x, y] = applyHousekeeping([a, b], 'a', { status: 'cleaned' });
    expect(x).toMatchObject({ housekeeping: 'cleaned', housekeepingNotes: 'old' });
    expect(y).toBe(b);
  });
  it('sets the note, and removes it when empty', () => {
    expect(
      applyHousekeeping([a], 'a', { status: 'ready', notes: 'new' })[0].housekeepingNotes,
    ).toBe('new');
    expect(
      'housekeepingNotes' in applyHousekeeping([a], 'a', { status: 'ready', notes: '' })[0],
    ).toBe(false);
  });
  it('does not change its input', () => {
    applyHousekeeping([a], 'a', { status: 'cleaned', notes: '' });
    expect(a).toMatchObject({ housekeeping: 'ready', housekeepingNotes: 'old' });
  });
});

describe('housekeepingFailure', () => {
  it('reloads on stale and not found', () => {
    expect(housekeepingFailure({ status: 409, code: 'stale' }).refetch).toBe(true);
    expect(housekeepingFailure({ status: 404 }).refetch).toBe(true);
  });
  it('says the outcome is unknown for no answer or a server error, and reloads', () => {
    for (const e of [{ status: 0 }, { status: 500 }, { status: 408 }, new Error('x')]) {
      expect(housekeepingFailure(e)).toMatchObject({
        refetch: true,
        message: 'Housekeeping could not be confirmed. Showing the latest schedule.',
      });
    }
  });
  it('is a plain failure for another 4xx', () => {
    expect(housekeepingFailure({ status: 400, code: 'invalid-query' })).toEqual({
      message: 'Housekeeping could not be saved.',
      refetch: false,
    });
  });
});

describe('segmentLinks (ticket 2.3)', () => {
  const rooms = [
    { id: 'a', number: '201' },
    { id: 'b', number: '205' },
    { id: 'c', number: '207' },
  ];
  const seg = (id: string, roomId: string, index: number, part: 'previous' | 'current' | 'next') =>
    ({
      kind: 'reservation',
      id,
      reservationId: 'rs',
      confirmationNumber: 'GR-1',
      guestName: 'G',
      guestType: 'guest',
      roomId,
      startDate: `2026-10-${15 + index}`,
      endDate: `2026-10-${16 + index}`,
      status: 'checked-in',
      roomCount: 1,
      roomTypeLocked: false,
      version: 'v',
      roomChange: { part, index: index + 1, count: 3, stayId: 'cur' },
    }) as ScheduleBlock;
  const blocks = [
    seg('p', 'a', 0, 'previous'),
    seg('cur', 'b', 1, 'current'),
    seg('n', 'c', 2, 'next'),
  ];

  it('knows the place of each part and the rooms of its neighbours', async () => {
    const { segmentLinks, segmentBadge, segmentText } = await import('./scheduleGrid');
    const links = segmentLinks(blocks, rooms);
    expect(links.get('p')).toEqual({
      index: 1,
      count: 3,
      fromRoomNumber: undefined,
      toRoomNumber: '205',
    });
    expect(links.get('cur')).toMatchObject({
      index: 2,
      fromRoomNumber: '201',
      toRoomNumber: '207',
    });
    expect(links.get('n')).toMatchObject({
      index: 3,
      fromRoomNumber: '205',
      toRoomNumber: undefined,
    });
    expect(segmentBadge(links.get('cur')!)).toBe('2/3 ← 201 → 207');
    expect(segmentText(links.get('cur')!)).toBe(
      'part 2 of 3, moved from Room 201, continues in Room 207',
    );
    expect(blockAriaLabel(blocks[1], rooms[1], links.get('cur'))).toContain('part 2 of 3');
  });
  it('a part whose neighbour is not loaded still says its place', async () => {
    const { segmentLinks } = await import('./scheduleGrid');
    expect(segmentLinks([blocks[2]], rooms).get('n')).toMatchObject({
      index: 3,
      count: 3,
      fromRoomNumber: undefined,
    });
  });
  it('stays without a room change have no links', async () => {
    const { segmentLinks } = await import('./scheduleGrid');
    expect(segmentLinks([{ ...blocks[0], roomChange: undefined }], rooms).size).toBe(0);
  });
});

describe('moveDialogCopy for a checked-in stay (D-050, Q-20-5)', () => {
  it('says the whole stay moves, including the nights already stayed, and points to Change Room', () => {
    const block = {
      confirmationNumber: 'GR-1',
      status: 'checked-in' as const,
      startDate: '2026-10-14',
    };
    const result = {
      ok: true,
      kind: 'room-change',
      dialog: 'room-change',
      moves: [
        {
          blockId: 'b',
          fromRoomId: 'a',
          toRoomId: 'c',
          fromStart: '2026-10-14',
          toStart: '2026-10-14',
          fromEnd: '2026-10-18',
          toEnd: '2026-10-18',
        },
      ],
      splitMoves: null,
    } as unknown as Parameters<typeof moveDialogCopy>[0];
    const copy = moveDialogCopy(result, block, '204', '2026-10-16');
    expect(copy.body).toBe(
      'Please confirm moving the whole stay to Room 204 for dates 10/14/2026 to 10/18/2026. This includes the 2 nights already stayed. To change only the nights not yet stayed, use Change Room During Stay in the reservation details.',
    );
    expect(moveDialogCopy(result, block, '204', '2026-10-15').body).toContain(
      'includes the 1 night already stayed',
    );
    // Arrival today, a not yet checked-in room, or no "today": the plain copy.
    expect(
      moveDialogCopy(result, { ...block, startDate: '2026-10-16' }, '204', '2026-10-16').body,
    ).toBe('Please confirm moving this room to Room 204 for dates 10/14/2026 to 10/18/2026.');
    expect(
      moveDialogCopy(result, { ...block, status: 'confirmed' as never }, '204', '2026-10-16').body,
    ).toMatch(/^Please confirm moving this room/);
    expect(moveDialogCopy(result, block, '204').body).toMatch(/^Please confirm moving this room/);
  });
});

describe('turnoverGap', () => {
  const prev = block({
    id: 'p',
    startDate: '2026-10-18',
    endDate: '2026-10-20',
    status: 'checked-out',
  });
  const next = block({ id: 'n', startDate: '2026-10-20', endDate: '2026-10-22' });
  it('keeps the chip width plus its margin clear on a same-day turnover', () => {
    expect(turnoverGap(prev, next, '2026-10-18', 7)).toBe(18);
    expect(turnoverGap(prev, next, '2026-10-18', 14)).toBe(10);
    expect(turnoverGap(prev, next, '2026-10-18', 30)).toBe(6);
  });
  it('is 0 without a previous stay, a gap between stays, or a chip', () => {
    expect(turnoverGap(undefined, next, '2026-10-18', 7)).toBe(0);
    expect(turnoverGap(prev, { ...next, startDate: '2026-10-21' }, '2026-10-18', 7)).toBe(0);
    expect(turnoverGap({ ...prev, housekeeping: 'nyci' }, next, '2026-10-18', 7)).toBe(0);
    expect(turnoverGap({ ...prev, roomId: '' }, next, '2026-10-18', 7)).toBe(0);
  });
});
