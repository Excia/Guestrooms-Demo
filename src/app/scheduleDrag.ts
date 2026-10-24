// Pure drag-and-drop rules for the schedule grid (Figma "Drag and Drop Rules" notes). `canDrop`
// decides whether a block may be dropped on a cell, which confirm dialog applies, and exactly which
// rooms move where. Stays are half-open night ranges [start, end): same-day turnover is no overlap.
import { addDays, daysBetween, isValidIsoDate, nightsOverlap, type IsoDate } from '../lib/dates';
import type {
  MoveDatesRequest,
  MoveRoomRequest,
  ScheduleBlock,
  ScheduleClosure,
  ScheduleRoom,
} from '../api/types';

export type ScheduleItem = ScheduleBlock | ScheduleClosure;

/** What the rules look at. Pass the unfiltered inventory so every room of a reservation is seen. */
export interface ScheduleDragState {
  /** Arrivals before this day are the past. */
  today: IsoDate;
  rooms: readonly ScheduleRoom[];
  blocks: readonly ScheduleBlock[];
  closures: readonly ScheduleClosure[];
}

/** The cell under the dragged block: the room, and the arrival date the block would get there. */
export interface DropTarget {
  roomId: string;
  startDate: IsoDate;
}

/** One reservation room's change of room and/or dates (the stay length is kept). */
export interface ScheduleMove {
  blockId: string;
  fromRoomId: string;
  toRoomId: string;
  fromStart: IsoDate;
  toStart: IsoDate;
  fromEnd: IsoDate;
  toEnd: IsoDate;
}

export type DropKind = 'room-change' | 'date-change' | 'room-and-date-change';

/** Which confirmation dialog to open: "Room Change", or "Date Change" (single or multi-room). */
export type ConfirmDialog = 'room-change' | 'date-change-single' | 'date-change-multi';

export type DropRefusal =
  /** Closures cannot be dragged. */
  | 'closure'
  /** The stay changed room during the stay: its parts are edited with Change Room During Stay. */
  | 'room-changed-stay'
  | 'checked-out'
  /** The new arrival is before today. */
  | 'past'
  /** A locked reservation may not leave its room type. */
  | 'room-type-locked'
  /** A target room has a reservation on those nights. */
  | 'reservation-conflict'
  /** A target room has a closure on those nights. */
  | 'closure-conflict'
  /** Checked-in rooms can change room but not dates. */
  | 'checked-in-dates'
  /** A room that would move along is checked in or out. */
  | 'linked-room-locked'
  /** Not every room of the multi-room reservation is loaded, so the shift cannot be checked. */
  | 'linked-rooms-not-loaded'
  | 'unknown-room'
  | 'invalid-date'
  /** Dropped where it already is. */
  | 'no-change';

export type DropResult =
  | {
      ok: true;
      kind: DropKind;
      dialog: ConfirmDialog;
      /** The dragged room first. Several entries when a multi-room reservation changes dates. */
      moves: ScheduleMove[];
      /**
       * Multi-room date change only: the dragged room alone, for the "split the room from the
       * reservation" link (API scope 'this-room'). Null when not offered.
       */
      splitMoves: ScheduleMove[] | null;
    }
  | {
      ok: false;
      reason: DropRefusal;
      /** Rooms with the conflict, for 'reservation-conflict' and 'closure-conflict'. */
      conflictRoomIds: string[];
      /** The dragged room alone would be fine: the split alternative may still be offered. */
      splitMoves: ScheduleMove[] | null;
    };

const refuse = (
  reason: DropRefusal,
  conflictRoomIds: string[] = [],
  splitMoves: ScheduleMove[] | null = null,
): DropResult => ({ ok: false, reason, conflictRoomIds, splitMoves });

/** Whether a drag may start: reservations that are not checked out and not linked-room blocks. */
export const isDraggable = (item: ScheduleItem): boolean =>
  item.kind === 'reservation' &&
  item.status !== 'checked-out' &&
  !item.roomChange &&
  !item.linkedTo;

interface Conflicts {
  reservations: string[];
  closures: string[];
}

function findConflicts(state: ScheduleDragState, moves: readonly ScheduleMove[]): Conflicts {
  const moving = new Set(moves.map((m) => m.blockId));
  const reservations = new Set<string>();
  const closures = new Set<string>();
  moves.forEach((m, i) => {
    for (const b of state.blocks) {
      if (
        !moving.has(b.id) &&
        b.roomId === m.toRoomId &&
        nightsOverlap(b.startDate, b.endDate, m.toStart, m.toEnd)
      ) {
        reservations.add(m.toRoomId);
      }
    }
    for (const c of state.closures) {
      if (c.roomId === m.toRoomId && nightsOverlap(c.startDate, c.endDate, m.toStart, m.toEnd)) {
        closures.add(m.toRoomId);
      }
    }
    // Two rooms of the same reservation landing in one room.
    moves.forEach((o, j) => {
      if (
        j !== i &&
        o.toRoomId === m.toRoomId &&
        nightsOverlap(o.toStart, o.toEnd, m.toStart, m.toEnd)
      ) {
        reservations.add(m.toRoomId);
      }
    });
  });
  return { reservations: [...reservations], closures: [...closures] };
}

const conflictRefusal = (
  c: Conflicts,
  splitMoves: ScheduleMove[] | null = null,
): DropResult | null =>
  c.reservations.length
    ? refuse('reservation-conflict', c.reservations, splitMoves)
    : c.closures.length
      ? refuse('closure-conflict', c.closures, splitMoves)
      : null;

const moveFor = (b: ScheduleBlock, toRoomId: string, shiftDays: number): ScheduleMove => ({
  blockId: b.id,
  fromRoomId: b.roomId,
  toRoomId,
  fromStart: b.startDate,
  toStart: addDays(b.startDate, shiftDays),
  fromEnd: b.endDate,
  toEnd: addDays(b.endDate, shiftDays),
});

/**
 * Can `source` be dropped on `target`?
 * Allowed: same room type; a different room type unless the reservation is locked; a future date;
 * NYCI and confirmed rooms; a checked-in room to another room on its own dates; one room of a
 * multi-room reservation to a new room; a new date, which moves every room of the reservation by
 * the same shift (or, via `splitMoves`, just this one).
 * Refused: closures, checked-out rooms, a target room with a reservation or closure on any of the
 * nights, an arrival in the past, a locked reservation leaving its room type, dates of a checked-in
 * room. Conflicts are checked for every room that would move.
 */
export function canDrop(
  source: ScheduleItem,
  target: DropTarget,
  state: ScheduleDragState,
): DropResult {
  if (source.kind === 'closure') return refuse('closure');
  // A stay with several parts (ticket 2.3) cannot be dragged, whichever part it is: dragging a part
  // would break the room plan. It is changed with Change Room During Stay in the details panel.
  if (source.roomChange) return refuse('room-changed-stay');
  if (source.status === 'checked-out') return refuse('checked-out');
  if (!isValidIsoDate(target.startDate)) return refuse('invalid-date');
  const sourceRoom = state.rooms.find((r) => r.id === source.roomId);
  const targetRoom = state.rooms.find((r) => r.id === target.roomId);
  if (!sourceRoom || !targetRoom) return refuse('unknown-room');

  const shift = daysBetween(source.startDate, target.startDate);
  const roomChanged = target.roomId !== source.roomId;
  if (shift === 0 && !roomChanged) return refuse('no-change');
  if (roomChanged && source.roomTypeLocked && sourceRoom.roomTypeId !== targetRoom.roomTypeId) {
    return refuse('room-type-locked');
  }

  // Room change only (also for one room of a multi-room reservation, and for checked-in rooms).
  if (shift === 0) {
    const moves = [moveFor(source, target.roomId, 0)];
    return (
      conflictRefusal(findConflicts(state, moves)) ?? {
        ok: true,
        kind: 'room-change',
        dialog: 'room-change',
        moves,
        splitMoves: null,
      }
    );
  }

  // New dates.
  if (source.status === 'checked-in') return refuse('checked-in-dates');

  const own = [moveFor(source, target.roomId, shift)];
  // Arrivals before today are the past: the dragged room, and below every room that moves along.
  if (own[0].toStart < state.today) return refuse('past');
  const kind: DropKind = roomChanged ? 'room-and-date-change' : 'date-change';
  if (source.roomCount <= 1) {
    return (
      conflictRefusal(findConflicts(state, own)) ?? {
        ok: true,
        kind,
        dialog: 'date-change-single',
        moves: own,
        splitMoves: null,
      }
    );
  }

  // Multi-room: every room of the reservation shifts by the same number of days.
  const ownOk = findConflicts(state, own);
  const split = ownOk.reservations.length || ownOk.closures.length ? null : own;
  const siblings = state.blocks.filter(
    (b) => b.reservationId === source.reservationId && b.id !== source.id,
  );
  if (siblings.length + 1 < source.roomCount) return refuse('linked-rooms-not-loaded', [], split);
  if (siblings.some((b) => b.status === 'checked-in' || b.status === 'checked-out')) {
    return refuse('linked-room-locked', [], split);
  }
  const moves = [...own, ...siblings.map((b) => moveFor(b, b.roomId, shift))];
  if (moves.some((m) => m.toStart < state.today)) return refuse('past', [], split);
  return (
    conflictRefusal(findConflicts(state, moves), split) ?? {
      ok: true,
      kind,
      dialog: 'date-change-multi',
      moves,
      splitMoves: split,
    }
  );
}

type Accepted = Extract<DropResult, { ok: true }>;

/**
 * API request for a 'room-change' result ("Move to New Room"). `block` is the dragged reservation
 * room as the user saw it (its `version` and room guard against a concurrent change); `requestId`
 * is the idempotency key, generated once per user action.
 */
export function toMoveRoomRequest(
  result: Accepted,
  block: Pick<ScheduleBlock, 'version' | 'roomId'>,
  requestId: string,
): MoveRoomRequest {
  const m = result.moves[0];
  return {
    reservationRoomId: m.blockId,
    toRoomId: m.toRoomId,
    fromRoomId: block.roomId,
    version: block.version,
    requestId,
  };
}

/**
 * API request for a date or room-and-date result ("Move to New Dates"). 'this-room' is the
 * "split the room from reservation" link and needs `result.splitMoves`.
 */
export function toMoveDatesRequest(
  result: Accepted,
  block: Pick<ScheduleBlock, 'version' | 'roomId' | 'startDate'>,
  requestId: string,
  scope: 'all-rooms' | 'this-room' = 'all-rooms',
): MoveDatesRequest {
  const moves = scope === 'this-room' ? result.splitMoves : result.moves;
  if (!moves) throw new Error('Splitting this room is not available for this drop');
  const m = moves[0];
  return {
    reservationRoomId: m.blockId,
    fromRoomId: block.roomId,
    fromStartDate: block.startDate,
    toStartDate: m.toStart,
    scope,
    toRoomId: m.toRoomId === m.fromRoomId ? undefined : m.toRoomId,
    version: block.version,
    requestId,
  };
}
