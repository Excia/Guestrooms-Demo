// Linked-room blocks and the early check in / late check out indicator rules (ticket 2.4). The
// linked-block text follows the legacy system, not the Figma width tiers (owner decision
// 2026-10-24). Pure, no React.
import type { LinkedRoom, ScheduleBlockStatus } from '../api/types';

/** Stays of at least this many nights show the linked room name in any view (legacy). */
export const LINKED_LONG_STAY_NIGHTS = 3;

export interface LinkedText {
  /** Bold first line: the linked room (and " +N" when several rooms are linked); may be empty. */
  title: string;
  /** Second line: the reserver, or the linked room in a short stay of the 14 day view; may be empty. */
  subtitle: string;
}

/** The " +N" after the room name when several rooms are linked (`multilinkageCount`). */
export function multilinkSuffix(linked: Pick<LinkedRoom, 'multilinkageCount'>): string {
  const count = linked.multilinkageCount ?? 0;
  return count > 1 ? ` +${count}` : '';
}

/**
 * What a linked block writes, by view (`days`: 7, 14 or 30) and the number of nights of its stay
 * (matches the legacy system, owner decision 2026-10-24):
 * - first line: the linked room name (plus " +N") in the 7 day view or for a stay of 3+ nights, else empty;
 * - second line: the reserver in the 7 day view, blank when several rooms are linked; in the 14 day
 *   view with a stay under 3 nights, the linked room name instead; otherwise blank.
 */
export function linkedBlockText(
  linked: Pick<LinkedRoom, 'roomNumber' | 'reserverName' | 'multilinkageCount'>,
  days: number,
  nights: number,
): LinkedText {
  const several = (linked.multilinkageCount ?? 0) > 1;
  const long = nights >= LINKED_LONG_STAY_NIGHTS;
  const title = days === 7 || long ? `${linked.roomNumber}${multilinkSuffix(linked)}` : '';
  let subtitle = '';
  if (days === 7) subtitle = several ? '' : linked.reserverName;
  else if (days === 14 && !long) subtitle = linked.roomNumber;
  return { title, subtitle };
}

/** The tooltip of a linked block: "Linked to [Room][ +N Room]" then the reserver's name. */
export function linkedTooltipLines(
  linked: Pick<LinkedRoom, 'roomNumber' | 'reserverName' | 'multilinkageCount'>,
): [string, string] {
  const more = multilinkSuffix(linked);
  return [`Linked to ${linked.roomNumber}${more ? `${more} Room` : ''}`, linked.reserverName];
}

/** A linked-room block is read-only: it is not clickable, draggable or openable (legacy behavior). */
export const isLinkedBlock = (block: { linkedTo?: LinkedRoom }): boolean => Boolean(block.linkedTo);

export interface EarlyLateFlags {
  earlyCheckIn?: boolean;
  lateCheckOut?: boolean;
}

/**
 * Not Yet Checked In (`confirmed` and `nyci`) shows only the early check in indicator; Checked In and
 * Checked Out show only late check out, even when both are set. A status that is not known keeps
 * both flags as given.
 */
export function indicatorsForStatus(
  status: ScheduleBlockStatus | undefined,
  flags: EarlyLateFlags,
): { early: boolean; late: boolean } {
  const early = Boolean(flags.earlyCheckIn);
  const late = Boolean(flags.lateCheckOut);
  if (status === undefined) return { early, late };
  if (status === 'checked-in' || status === 'checked-out') return { early: false, late };
  return { early, late: false };
}

/**
 * The indicators a block draws. A linked-room block draws none (the legacy system draws none either,
 * owner decision 2026-10-24); any other block follows the status rule on its own flags.
 */
export function blockIndicators(block: {
  status?: ScheduleBlockStatus;
  earlyCheckIn?: boolean;
  lateCheckOut?: boolean;
  linkedTo?: LinkedRoom;
}): { early: boolean; late: boolean } {
  if (block.linkedTo) return { early: false, late: false };
  return indicatorsForStatus(block.status, block);
}
