// Pure helpers for the schedule grid component: block geometry, drag targets, keyboard cursor,
// optimistic move updates, and the copy of the messages and confirm dialogs. The drop rules
// themselves live in scheduleDrag.ts; nothing here decides what may move.
import { addDays, daysBetween, nightsOverlap, type IsoDate } from '../lib/dates';
import type { ScheduleBlock, ScheduleClosure, ScheduleData, ScheduleRoom } from '../api/types';
import { blockLayout, dayHeader, type BlockLayout } from './schedule';
import type { DropRefusal, DropResult, ScheduleMove } from './scheduleDrag';

type Accepted = Extract<DropResult, { ok: true }>;

// ---- geometry ----------------------------------------------------------------------------------

export interface BlockSpan {
  /** Left edge as a fraction of the date area (0..1). */
  start: number;
  /** Right edge as a fraction of the date area (0..1). */
  end: number;
}

/**
 * Where a block sits across the date columns. As in Figma a stay runs from the middle of the
 * arrival column to the middle of the departure column, so a same-day turnover leaves a gap
 * between two blocks. Clipped edges (a stay that began before or goes on after the range) reach
 * the range edge; a departure on the day after the last column also ends at the edge.
 */
export function blockSpan(layout: BlockLayout, days: number): BlockSpan {
  const start = layout.column + (layout.continuesBefore ? 0 : 0.5);
  const end = Math.min(layout.column + layout.span + (layout.continuesAfter ? 0 : 0.5), days);
  return { start: start / days, end: end / days };
}

/** Whole days a pointer moved horizontally, from its distance and the width of one date column. */
export const shiftFromDistance = (distancePx: number, dayWidthPx: number): number =>
  dayWidthPx > 0 ? Math.round(distancePx / dayWidthPx) : 0;

/** Index of the row at a vertical offset inside the body (below the header); null outside. */
export function rowIndexAt(offsetY: number, rowHeight: number, rowCount: number): number | null {
  if (rowHeight <= 0 || offsetY < 0) return null;
  const row = Math.floor(offsetY / rowHeight);
  return row < rowCount ? row : null;
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

// ---- keyboard cursor ---------------------------------------------------------------------------

export interface GridCursor {
  row: number;
  col: number;
}

export type CursorKey =
  'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' | 'PageUp' | 'PageDown';

/** Arrow keys move one cell, Home/End go to the first/last date, PageUp/PageDown a screen of rows. */
export function moveCursor(
  cursor: GridCursor,
  key: CursorKey,
  rowCount: number,
  days: number,
  pageRows = 8,
): GridCursor {
  const lastRow = Math.max(rowCount - 1, 0);
  const lastCol = Math.max(days - 1, 0);
  switch (key) {
    case 'ArrowUp':
      return { ...cursor, row: clamp(cursor.row - 1, 0, lastRow) };
    case 'ArrowDown':
      return { ...cursor, row: clamp(cursor.row + 1, 0, lastRow) };
    case 'ArrowLeft':
      return { ...cursor, col: clamp(cursor.col - 1, 0, lastCol) };
    case 'ArrowRight':
      return { ...cursor, col: clamp(cursor.col + 1, 0, lastCol) };
    case 'Home':
      return { ...cursor, col: 0 };
    case 'End':
      return { ...cursor, col: lastCol };
    case 'PageUp':
      return { ...cursor, row: clamp(cursor.row - pageRows, 0, lastRow) };
    case 'PageDown':
      return { ...cursor, row: clamp(cursor.row + pageRows, 0, lastRow) };
  }
}

/** The item of a room's row that covers a date column (first match), or undefined. */
export function itemAtColumn<T extends { startDate: IsoDate; endDate: IsoDate }>(
  items: readonly T[] | undefined,
  rangeStart: IsoDate,
  days: Parameters<typeof blockLayout>[2],
  col: number,
): T | undefined {
  return items?.find((item) => {
    const layout = blockLayout(item, rangeStart, days);
    return layout !== null && col >= layout.column && col < layout.column + layout.span;
  });
}

/**
 * The date column under a horizontal position in the grid, or null over the room header column or
 * outside the dates. `contentLeft` is the left edge of the (scrolled) content, `labelPx` the room
 * header width.
 */
export function columnAtX(
  x: number,
  contentLeft: number,
  contentWidth: number,
  labelPx: number,
  days: number,
): number | null {
  const dayWidth = (contentWidth - labelPx) / days;
  if (!(dayWidth > 0)) return null;
  const offset = x - contentLeft - labelPx;
  if (offset < 0) return null;
  const col = Math.floor(offset / dayWidth);
  return col < days ? col : null;
}

/**
 * Which Early Check In / Late Check Out markers a reservation block shows, both drawn as the card's
 * own edge (inside its rounded outline).
 * - `left`: Early Check In. Shown at a real arrival edge, and also on an in-house stay that arrived
 *   before the visible range: its arrival edge is off screen, so the sliver is the visible left edge
 *   of the card (which is then rounded like any other, not flat).
 * - `right`: Late Check Out at a real departure edge; none at a clipped right edge (the departure is
 *   out of sight).
 * Only the drawn edge is decided here; which nights the block occupies never changes.
 */
export function blockMarkers(
  block: { earlyCheckIn?: boolean; lateCheckOut?: boolean },
  layout: Pick<BlockLayout, 'continuesAfter'> & Partial<Pick<BlockLayout, 'continuesBefore'>>,
): { left: boolean; right: boolean } {
  return {
    left: Boolean(block.earlyCheckIn),
    right: Boolean(block.lateCheckOut) && !layout.continuesAfter,
  };
}

export type EmptyCellAction =
  /** A free night: a reservation can start here. */
  | { kind: 'free' }
  /** A closure covers the night. */
  | { kind: 'closed' }
  /** A reservation covers the column (its click or Enter opens details instead). */
  | { kind: 'occupied' };

/** What a click or Enter on a date cell of a room row means, from the row's blocks and closures. */
export function emptyCellAction(
  blocks: readonly { startDate: IsoDate; endDate: IsoDate }[] | undefined,
  closures: readonly { startDate: IsoDate; endDate: IsoDate }[] | undefined,
  rangeStart: IsoDate,
  days: Parameters<typeof blockLayout>[2],
  col: number,
): EmptyCellAction {
  if (itemAtColumn(closures, rangeStart, days, col)) return { kind: 'closed' };
  if (itemAtColumn(blocks, rangeStart, days, col)) return { kind: 'occupied' };
  return { kind: 'free' };
}

// ---- optimistic updates ------------------------------------------------------------------------

/** The blocks with the given moves applied (arrival, departure and room). */
export function applyMoves(
  blocks: readonly ScheduleBlock[],
  moves: readonly ScheduleMove[],
): ScheduleBlock[] {
  const byId = new Map(moves.map((m) => [m.blockId, m]));
  return blocks.map((b) => {
    const m = byId.get(b.id);
    return m ? { ...b, roomId: m.toRoomId, startDate: m.toStart, endDate: m.toEnd } : b;
  });
}

/** Undoes `applyMoves`. */
export function revertMoves(
  blocks: readonly ScheduleBlock[],
  moves: readonly ScheduleMove[],
): ScheduleBlock[] {
  const byId = new Map(moves.map((m) => [m.blockId, m]));
  return blocks.map((b) => {
    const m = byId.get(b.id);
    return m ? { ...b, roomId: m.fromRoomId, startDate: m.fromStart, endDate: m.fromEnd } : b;
  });
}

/**
 * Takes the blocks an API move returned into the loaded data: changed blocks replace their old
 * versions, and one that no longer overlaps the loaded range is dropped.
 */
export function mergeChangedBlocks(
  data: Pick<ScheduleData, 'startDate' | 'days' | 'blocks'>,
  changed: readonly ScheduleBlock[],
): ScheduleBlock[] {
  const ids = new Set(changed.map((b) => b.id));
  const end = addDays(data.startDate, data.days);
  return [
    ...data.blocks.filter((b) => !ids.has(b.id)),
    ...changed.filter((b) => nightsOverlap(b.startDate, b.endDate, data.startDate, end)),
  ];
}

// ---- copy --------------------------------------------------------------------------------------

/** "MM/DD/YYYY", as the Figma dialogs show dates. */
export function formatDialogDate(iso: IsoDate): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

const REFUSALS: Record<DropRefusal, string> = {
  closure: 'Closures cannot be moved.',
  'room-changed-stay':
    'This stay has several rooms. Use Change Room During Stay in its details to change them.',
  'checked-out': 'Checked-out rooms cannot be moved.',
  past: 'A reservation cannot be moved to a date in the past.',
  'room-type-locked': 'This reservation is locked to its room type.',
  'reservation-conflict': 'That room already has a reservation on those dates.',
  'closure-conflict': 'That room has a closure on those dates.',
  'checked-in-dates': 'Checked-in rooms can change room but not dates.',
  'linked-room-locked':
    'A room on this reservation is checked in or out, so the dates cannot change.',
  'linked-rooms-not-loaded':
    'Not every room of this reservation is loaded, so the dates cannot change.',
  'unknown-room': 'That room is not available.',
  'invalid-date': 'That date is not valid.',
  'no-change': 'Dropped where it already is.',
};

export const refusalMessage = (reason: DropRefusal): string => REFUSALS[reason];

export interface MoveDialogCopy {
  title: string;
  /** The text of the first paragraph. */
  body: string;
  /** Multi-room date change: the paragraph is `before`, a bold `emphasis`, then `after`. */
  parts?: { before: string; emphasis: string; after: string };
  confirmLabel: string;
}

/** Title, text and primary button of the confirm dialog for an accepted drop (Figma 2623:*). */
export function moveDialogCopy(
  result: Accepted,
  block: Pick<ScheduleBlock, 'confirmationNumber'>,
  toRoomNumber: string,
): MoveDialogCopy {
  const move = result.moves[0];
  const dates = `${formatDialogDate(move.toStart)} to ${formatDialogDate(move.toEnd)}`;
  if (result.dialog === 'room-change') {
    return {
      title: `Reservation ${block.confirmationNumber} Room Change`,
      body: `Please confirm moving this room to Room ${toRoomNumber} for dates ${dates}.`,
      confirmLabel: 'Move to New Room',
    };
  }
  const title = `Reservation ${block.confirmationNumber} Date Change`;
  if (result.dialog === 'date-change-multi') {
    const parts = {
      before: `Moving this room to Room ${toRoomNumber} for dates ${dates} will change the check in and check out dates for `,
      emphasis: 'all rooms on the reservation',
      after: ' and will change the total rate for the reservation.',
    };
    return {
      title,
      body: parts.before + parts.emphasis + parts.after,
      parts,
      confirmLabel: 'Move to New Dates',
    };
  }
  return {
    title,
    body: `Moving this room to Room ${toRoomNumber} for dates ${dates} will change the total rate for the reservation.`,
    confirmLabel: 'Move to New Dates',
  };
}

/** Where a part of a stay that changed room sits in its chain, for the label and the grid text. */
export interface SegmentLink {
  index: number;
  count: number;
  /** Room number of the part before this one, if loaded. */
  fromRoomNumber?: string;
  /** Room number of the part after this one, if loaded. */
  toRoomNumber?: string;
}

/**
 * Links the parts of every stay that changed room during the stay: each part knows its place
 * ("part 2 of 3") and the rooms of its neighbours, found by `stayId` among the loaded blocks.
 */
export function segmentLinks(
  blocks: readonly ScheduleBlock[],
  rooms: readonly Pick<ScheduleRoom, 'id' | 'number'>[],
): Map<string, SegmentLink> {
  const number = new Map(rooms.map((r) => [r.id, r.number]));
  const byStay = new Map<string, ScheduleBlock[]>();
  for (const b of blocks) {
    if (!b.roomChange) continue;
    const list = byStay.get(b.roomChange.stayId) ?? [];
    list.push(b);
    byStay.set(b.roomChange.stayId, list);
  }
  const links = new Map<string, SegmentLink>();
  for (const parts of byStay.values()) {
    for (const b of parts) {
      const { index, count } = b.roomChange!;
      const before = parts.find((p) => p.roomChange!.index === index - 1);
      const after = parts.find((p) => p.roomChange!.index === index + 1);
      links.set(b.id, {
        index,
        count,
        // A neighbour in the same room is not a room change: nothing to point at.
        fromRoomNumber:
          before && before.roomId !== b.roomId ? number.get(before.roomId) : undefined,
        toRoomNumber: after && after.roomId !== b.roomId ? number.get(after.roomId) : undefined,
      });
    }
  }
  return links;
}

/** "part 2 of 3, moved from Room 201, continues in Room 207". */
export function segmentText(link: SegmentLink): string {
  return [
    `part ${link.index} of ${link.count}`,
    ...(link.fromRoomNumber ? [`moved from Room ${link.fromRoomNumber}`] : []),
    ...(link.toRoomNumber ? [`continues in Room ${link.toRoomNumber}`] : []),
  ].join(', ');
}

/** The short text on the block: "2/3 ← 201 → 207". */
export function segmentBadge(link: SegmentLink): string {
  return [
    `${link.index}/${link.count}`,
    ...(link.fromRoomNumber ? [`← ${link.fromRoomNumber}`] : []),
    ...(link.toRoomNumber ? [`→ ${link.toRoomNumber}`] : []),
  ].join(' ');
}

/**
 * The text of a block's tooltip (shown when the block's own text is cut off): guest, confirmation
 * number, the place in a stay that changed room, the room and the rooms next to it.
 */
export function blockTipText(
  block: Pick<ScheduleBlock, 'guestName' | 'confirmationNumber'>,
  room: Pick<ScheduleRoom, 'number'> | undefined,
  link?: SegmentLink,
): string {
  return [
    block.guestName,
    block.confirmationNumber,
    ...(link ? [`part ${link.index} of ${link.count}`] : []),
    `Room ${room?.number ?? ''}${link?.fromRoomNumber ? ` (from ${link.fromRoomNumber})` : ''}${link?.toRoomNumber ? ` \u2192 ${link.toRoomNumber}` : ''}`.trim(),
  ].join(', ');
}

/** Name of a block for assistive technology: guest, confirmation number, status, room, dates. */
export function blockAriaLabel(
  block: ScheduleBlock,
  room: Pick<ScheduleRoom, 'number'> | undefined,
  /** The place of this part in a stay that changed room (ticket 2.3). */
  link?: SegmentLink,
): string {
  const status = block.status === 'nyci' ? 'not yet checked in' : block.status.replace('-', ' ');
  return [
    block.guestName,
    block.confirmationNumber,
    status,
    `Room ${room?.number ?? ''}`.trim(),
    `${formatDialogDate(block.startDate)} to ${formatDialogDate(block.endDate)}`,
    ...(block.earlyCheckIn ? ['early check in'] : []),
    ...(block.lateCheckOut ? ['late check out'] : []),
    ...(link ? [segmentText(link)] : []),
  ].join(', ');
}

export function closureAriaLabel(
  closure: ScheduleClosure,
  room: Pick<ScheduleRoom, 'number'> | undefined,
): string {
  return `Closure, ${closure.reason}, Room ${room?.number ?? ''}, ${formatDialogDate(closure.startDate)} to ${formatDialogDate(closure.endDate)}`.replace(
    ', Room ,',
    ',',
  );
}

/** Label of an empty cell: room and weekday date. */
export const cellAriaLabel = (room: Pick<ScheduleRoom, 'number'>, date: IsoDate): string =>
  `Room ${room.number}, ${dayHeader(date)}, no reservation`;

/** Header corner: the year, or both years when the range crosses New Year. */
export function yearLabel(dates: readonly IsoDate[]): string {
  const first = dates[0]?.slice(0, 4) ?? '';
  const last = dates[dates.length - 1]?.slice(0, 4) ?? first;
  return first === last ? first : `${first}/${last}`;
}

/** Whole-day shift between an item's arrival and a target date; re-exported for the drag flow. */
export const shiftDays = (from: IsoDate, to: IsoDate): number => daysBetween(from, to);

/**
 * Keeps a drag's day shift inside the visible columns: the new arrival column must stay in
 * [0, days). A stay that began before the range may stay where it is (shift 0).
 */
export function clampShift(startIndex: number, shift: number, days: number): number {
  const min = Math.min(0, -startIndex);
  const max = Math.max(0, days - 1 - startIndex);
  return clamp(shift, min, max);
}

// ---- move failures -------------------------------------------------------------------------------

export interface MoveFailure {
  /** Put the optimistic move back. False when the server may have applied it (unknown outcome). */
  revert: boolean;
  /** Reload the schedule so the grid shows what is really booked. */
  refetch: boolean;
  message: string;
}

const UNKNOWN_OUTCOME = 'Could not confirm the move. Showing the latest schedule.';

const MOVE_ERROR_COPY: Record<string, string> = {
  conflict: 'That room is no longer free on those dates. The schedule has been refreshed.',
  'not-movable': 'This reservation cannot be moved that way.',
  stale: 'This reservation was changed by someone else. The schedule has been refreshed.',
  'not-found': 'That reservation or room no longer exists. The schedule has been refreshed.',
  'invalid-id': 'The move was not valid. Nothing was changed.',
  'invalid-query': 'The move was not valid. Nothing was changed.',
  'idempotency-conflict': 'The move could not be completed. Try again.',
};

/** Server text is only shown as extra detail when it is short plain text (never markup or links). */
export function safeDetail(message: string | undefined): string | null {
  const text = message?.trim();
  if (!text || text.length > 120) return null;
  return /^[\p{L}\p{N} .,'’:;!?()/-]+$/u.test(text) && !/https?:|www\./i.test(text) ? text : null;
}

/**
 * What to do when a move request failed. A response of 400 to 499 (except 408) says nothing was
 * applied: revert, and for 404 and 409 also reload (the booking that blocked the move is now
 * visible). No response (status 0: timeout, network), an unusable 2xx answer, 408 or a 5xx is an
 * unknown outcome: the move may have been applied, so
 * the optimistic state is not trusted: reload and say so neutrally. Known codes map to our own copy;
 * the server message is only a fallback detail.
 */
export function moveFailure(error: unknown): MoveFailure {
  const status =
    typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : 0;
  const code = (error as { code?: unknown })?.code;
  const detail = safeDetail((error as { message?: string })?.message);
  // Only a clear 4xx says nothing was applied. No response (0), a 2xx whose body was unusable
  // (invalid-response), 408 and 5xx are unknown: the server may well have applied the move.
  if (status < 400 || status === 408 || status >= 500) {
    return { revert: false, refetch: true, message: UNKNOWN_OUTCOME };
  }
  const known = typeof code === 'string' ? MOVE_ERROR_COPY[code] : undefined;
  const fallback = status === 404 ? MOVE_ERROR_COPY['not-found'] : undefined;
  const message =
    known ??
    fallback ??
    (detail ? `The move could not be completed: ${detail}` : 'The move could not be completed.');
  return { revert: true, refetch: status === 404 || status === 409, message };
}
