// Business rules of the Reservation List (ticket 3.1), kept out of the components. Pure.
import type { ListStatus, ReservationListRow } from '../api';
import { addDays, type IsoDate } from '../lib/dates';

/** Default check-in range: today through the next 7 days (decision D-013). */
export const DEFAULT_RANGE_DAYS = 7;

export function defaultCheckInRange(today: IsoDate): { from: IsoDate; to: IsoDate } {
  return { from: today, to: addDays(today, DEFAULT_RANGE_DAYS) };
}

export const LIST_STATUS_LABELS: Record<ListStatus, string> = {
  'not-checked-in': 'Not Checked In',
  'checked-in': 'Checked In',
  'checked-out': 'Checked Out',
  canceled: 'Canceled',
};

export const UNASSIGNED_LABEL = 'Unassigned';

export interface RoomLabel {
  /** The first room's number, or "Unassigned". */
  text: string;
  /** Shown in the error color. */
  unassigned: boolean;
  /** Rooms beyond the first: rendered "+N". 0 for a single room. */
  extra: number;
}

/** The Room column: the first room, plus "+N" for each further room of a multi-room reservation. */
export function roomLabel(row: Pick<ReservationListRow, 'rooms'>): RoomLabel {
  const first = row.rooms[0];
  return {
    text: first?.roomNumber ?? UNASSIGNED_LABEL,
    unassigned: first ? first.roomNumber === null : true,
    extra: Math.max(0, row.rooms.length - 1),
  };
}

/** Plain-text form of the room label, for accessible names: "Unassigned plus 1 more room". */
export function roomLabelText(row: Pick<ReservationListRow, 'rooms'>): string {
  const { text, extra } = roomLabel(row);
  return extra > 0 ? `${text} +${extra}` : text;
}

/** Canceled rows are italic, with the status in bold. */
export const isCanceled = (row: Pick<ReservationListRow, 'status'>) => row.status === 'canceled';

/**
 * A row can be checked in in bulk when at least one of its rooms is still to be checked in. That
 * excludes single rooms already checked in, checked out or canceled, and multi-room reservations
 * with nothing left to check in; a partially checked-in multi-room one stays selectable. Unassigned
 * rooms and missing payment methods do not matter here: they are reported by the check-in attempt
 * (final intent of Figma P2; ticket 3.2 refines this).
 *
 * With `today` (the club's date, ticket 163) only today's arrivals are selectable: a reservation
 * that arrived on an earlier date is never checked in in bulk (it goes through the past-date prompts
 * of the reservation panel), and one that arrives later cannot be checked in yet. Without `today`
 * the date is not considered.
 */
export function isSelectable(
  row: Pick<ReservationListRow, 'rooms'> & { arrival?: IsoDate },
  today?: IsoDate,
): boolean {
  if (today !== undefined && row.arrival !== today) return false;
  return row.rooms.some((r) => r.status === 'not-checked-in');
}

export const selectableRows = <T extends Pick<ReservationListRow, 'rooms' | 'arrival'>>(
  rows: readonly T[],
  today?: IsoDate,
): T[] => rows.filter((r) => isSelectable(r, today));

export type HeaderCheckState = 'none' | 'some' | 'all';

/** The header checkbox: reflects only selectable rows; "none" when there are none to select. */
export function headerCheckState(
  rows: readonly ReservationListRow[],
  selected: ReadonlySet<string>,
  today?: IsoDate,
): HeaderCheckState {
  const selectable = selectableRows(rows, today);
  const count = selectable.filter((r) => selected.has(r.id)).length;
  return count === 0 ? 'none' : count === selectable.length ? 'all' : 'some';
}

export function toggleRow(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** Select-all: everything selectable when not all are selected, otherwise nothing. */
export function toggleAllRows(
  rows: readonly ReservationListRow[],
  selected: ReadonlySet<string>,
  today?: IsoDate,
): Set<string> {
  return headerCheckState(rows, selected, today) === 'all'
    ? new Set()
    : new Set(selectableRows(rows, today).map((r) => r.id));
}

/** The selected rows, in table order, dropping ids that are gone or no longer selectable. */
export function selectedRows(
  rows: readonly ReservationListRow[],
  selected: ReadonlySet<string>,
  today?: IsoDate,
): ReservationListRow[] {
  return rows.filter((r) => selected.has(r.id) && isSelectable(r, today));
}

/** "10/16/26", as the Figma rows show dates (MM/DD/YY). */
export function formatListDate(iso: IsoDate): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1].slice(2)}` : iso;
}
