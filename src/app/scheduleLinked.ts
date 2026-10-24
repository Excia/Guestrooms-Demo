// Linked-room blocks and the early check in / late check out indicator rules (ticket 2.4, Figma
// "Linked Room Block" 12455:90329 and "States and Variations" 12423:59315). Pure, no React.
import type { LinkedRoom, ScheduleBlockStatus } from '../api/types';

/** What a linked block shows, from its drawn width. */
export type LinkedTier =
  /** The link icon only (30 day view, one night). */
  | 'icon'
  /** The link icon and the linked room number, which may wrap to a second line (14 day view, one night). */
  | 'room'
  /** The icon and room number on one line, the reserver's name on the second line. */
  | 'reserver';

/**
 * Narrowest block widths, in px, for each tier. The Figma frames show the icon alone at about one
 * 30 day column (40 to 60px), the room number at one 14 day column (90px), and the name once the icon
 * and number fit on one line, from one 7 day column (120px) up.
 */
export const LINKED_TIER_MIN_WIDTH = { room: 64, reserver: 120 } as const;

export function linkedTier(widthPx: number): LinkedTier {
  if (widthPx >= LINKED_TIER_MIN_WIDTH.reserver) return 'reserver';
  if (widthPx >= LINKED_TIER_MIN_WIDTH.room) return 'room';
  return 'icon';
}

/** The tooltip of a linked block: two lines, "Linked to [Room Number]" then "Reserver First Last". */
export function linkedTooltipLines(
  linked: Pick<LinkedRoom, 'roomNumber' | 'reserverName'>,
): [string, string] {
  return [`Linked to ${linked.roomNumber}`, linked.reserverName];
}

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
