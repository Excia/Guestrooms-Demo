// Visual state of schedule blocks and columns (ticket LP-S.4): past, active and drag-target. Pure,
// no React. The legacy schedule lightens past events (50%) and shows the active one at 100%; the
// values are theme tokens (`palette.schedule.opacity`).
import { addDays, daysBetween, type IsoDate } from '../lib/dates';
import type { ScheduleBlock, ScheduleClosure } from '../api/types';
import type { ScheduleOpacity } from '../theme';

type StateSubject =
  Pick<ScheduleClosure, 'kind'> | Pick<ScheduleBlock, 'kind' | 'status' | 'linkedTo'>;

/**
 * A reservation is past only once it has been checked out (functional doc 15.4.5.1): an unchecked
 * stay whose dates have gone by is not past, it is a no-show waiting to be handled.
 */
export function isPastEvent(item: StateSubject): boolean {
  return item.kind === 'reservation' && item.status === 'checked-out';
}

/** The event the open panel shows: the whole reservation, or just one of its rooms. */
export interface ActiveEvent {
  reservationId: string;
  /** The reservation room (block id) selected in the panel; absent: every room of the reservation. */
  reservationRoomId?: string;
}

/** Whether `item` belongs to the active event. Closures and linked-room blocks never do. */
export function isActiveEvent(
  item:
    | Pick<ScheduleBlock, 'kind' | 'id' | 'reservationId' | 'linkedTo'>
    | Pick<ScheduleClosure, 'kind'>,
  active: ActiveEvent | null | undefined,
): boolean {
  if (!active || item.kind !== 'reservation' || item.linkedTo) return false;
  if (item.reservationId !== active.reservationId) return false;
  return active.reservationRoomId === undefined || item.id === active.reservationRoomId;
}

export type OpacityToken = keyof ScheduleOpacity;

/**
 * Which opacity token a block takes. Order: being dragged, the drag ghost, linked-room, active
 * (wins over past: the open event is at full strength), past, normal.
 */
export function blockOpacityToken(
  item: StateSubject,
  flags: { active?: boolean; dragging?: boolean; ghost?: boolean },
): OpacityToken {
  if (flags.dragging) return 'dragging';
  if (flags.ghost) return 'ghost';
  if (item.kind === 'reservation' && item.linkedTo) return 'linked';
  if (flags.active) return 'active';
  if (isPastEvent(item)) return 'past';
  return 'normal';
}

/** How many of the `days` visible columns come before today (0 to `days`): the past dates. */
export function pastColumnCount(startDate: IsoDate, days: number, today: IsoDate): number {
  const n = daysBetween(startDate, today);
  return Number.isNaN(n) ? 0 : Math.min(Math.max(n, 0), days);
}

export interface DropColumns {
  /** First visible column the dragged stay would cover. */
  first: number;
  /** Number of visible columns it covers: the stay's nights, less what the view clips. */
  count: number;
  /** The stay's nights, which a move never changes. */
  nights: number;
}

/**
 * The columns a stay would occupy if dropped `shift` days from where it is: its nights, whatever
 * the target, clipped to the visible range. Null when none is visible.
 */
export function dropColumns(
  stay: { startDate: IsoDate; endDate: IsoDate },
  shift: number,
  viewStart: IsoDate,
  days: number,
): DropColumns | null {
  const nights = daysBetween(stay.startDate, stay.endDate);
  if (Number.isNaN(nights) || nights < 1) return null;
  const from = daysBetween(viewStart, addDays(stay.startDate, shift));
  const first = Math.max(from, 0);
  const last = Math.min(from + nights, days);
  return last > first ? { first, count: last - first, nights } : null;
}
