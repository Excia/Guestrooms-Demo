import type { ScheduleBlock, ScheduleClosure } from '../api/types';
import { addDays, daysBetween, isValidIsoDate, nightsOverlap, type IsoDate } from '../lib/dates';

// Room closures (functional doc 17 and 18). Dates are half-open like reservations: a closure
// from the 10th to the 12th closes the nights of the 10th and 11th, and the room is free again
// on the 12th. One reservation or closure per room and night.

/** Legacy limit of the Description field. */
export const CLOSURE_DESCRIPTION_MAX = 50;
/** A short closure shows only this many characters of the description on its block. */
export const CLOSURE_SHORT_TEXT_MAX = 20;
/**
 * "Short" closure: this many nights or fewer. The documents say a closure "truncates after 20
 * characters on short closures" without defining short (placeholder, see figma-deviations.md).
 */
export const CLOSURE_SHORT_MAX_NIGHTS = 2;
/** What a block shows for a closure saved without a description. */
export const CLOSURE_EMPTY_LABEL = 'Room closed';

export interface ClosureForm {
  roomId: string;
  startDate: IsoDate | '';
  endDate: IsoDate | '';
  description: string;
}

export type ClosureField = 'roomId' | 'startDate' | 'endDate' | 'description';

/** Field errors keyed by field; empty when the form can be saved. */
export function validateClosure(form: ClosureForm): Partial<Record<ClosureField, string>> {
  const errors: Partial<Record<ClosureField, string>> = {};
  if (!form.roomId) errors.roomId = 'Choose a room.';
  if (!form.startDate || !isValidIsoDate(form.startDate)) errors.startDate = 'Enter a start date.';
  if (!form.endDate || !isValidIsoDate(form.endDate)) errors.endDate = 'Enter an end date.';
  else if (!errors.startDate && form.endDate <= form.startDate) {
    errors.endDate = 'The end date must be after the start date.';
  }
  if (form.description.trim().length > CLOSURE_DESCRIPTION_MAX) {
    errors.description = `Use ${CLOSURE_DESCRIPTION_MAX} characters or fewer.`;
  }
  return errors;
}

/** The description as it is saved: trimmed and cut to the limit. */
export const cleanDescription = (text: string): string =>
  text.trim().slice(0, CLOSURE_DESCRIPTION_MAX);

/** Start is the clicked day (or today); End is one night later. */
export function defaultClosureDates(
  today: IsoDate,
  start?: IsoDate,
): { startDate: IsoDate; endDate: IsoDate } {
  const startDate = start ?? today;
  return { startDate, endDate: addDays(startDate, 1) };
}

export type ClosureConflict =
  | { kind: 'reservation'; confirmationNumber: string }
  | { kind: 'closure' };

/**
 * What stops a closure of `roomId` over [startDate, endDate): a reservation or another closure on
 * one of those nights. `ignoreId` is the closure being edited. The server stays authoritative; this
 * only sees the loaded schedule window.
 */
export function closureConflict(
  items: { blocks: readonly ScheduleBlock[]; closures: readonly ScheduleClosure[] },
  candidate: { roomId: string; startDate: IsoDate; endDate: IsoDate },
  ignoreId?: string,
): ClosureConflict | null {
  const { roomId, startDate, endDate } = candidate;
  if (!roomId || !(startDate < endDate)) return null;
  const block = items.blocks.find(
    (b) => b.roomId === roomId && nightsOverlap(b.startDate, b.endDate, startDate, endDate),
  );
  if (block) return { kind: 'reservation', confirmationNumber: block.confirmationNumber };
  const other = items.closures.find(
    (c) =>
      c.id !== ignoreId &&
      c.roomId === roomId &&
      nightsOverlap(c.startDate, c.endDate, startDate, endDate),
  );
  return other ? { kind: 'closure' } : null;
}

export function conflictMessage(conflict: ClosureConflict, roomNumber: string): string {
  return conflict.kind === 'reservation'
    ? `Room ${roomNumber} has reservation ${conflict.confirmationNumber} on those dates.`
    : `Room ${roomNumber} is already closed on those dates.`;
}

/** The text a closure block shows: cut after 20 characters on a short closure. */
export function closureBlockText(reason: string, startDate: IsoDate, endDate: IsoDate): string {
  const text = reason.trim() === '' ? CLOSURE_EMPTY_LABEL : reason;
  const nights = daysBetween(startDate, endDate);
  return nights <= CLOSURE_SHORT_MAX_NIGHTS && text.length > CLOSURE_SHORT_TEXT_MAX
    ? `${text.slice(0, CLOSURE_SHORT_TEXT_MAX).trimEnd()}…`
    : text;
}

/** The full text for the tooltip and the accessible name. */
export const closureFullText = (reason: string): string =>
  reason.trim() === '' ? CLOSURE_EMPTY_LABEL : reason;

/** Keeps End after Start when Start moves past it (the length of the closure is kept). */
export function moveClosureStart(form: ClosureForm, startDate: IsoDate | ''): ClosureForm {
  if (!startDate || !isValidIsoDate(startDate)) return { ...form, startDate };
  const kept =
    form.startDate && form.endDate && isValidIsoDate(form.startDate) && isValidIsoDate(form.endDate)
      ? Math.max(1, daysBetween(form.startDate, form.endDate))
      : 1;
  const endDate =
    !form.endDate || !isValidIsoDate(form.endDate) || form.endDate <= startDate
      ? addDays(startDate, kept)
      : form.endDate;
  return { ...form, startDate, endDate };
}
