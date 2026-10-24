// What a reservation block writes and what its tooltip lists (ticket LP-S.1). The rules follow the
// legacy schedule box (title, relevant detail line, month-view initials); the layout and colors
// are this build's. Pure, no React.
import { daysBetween } from '../lib/dates';
import type { ScheduleBlock, ScheduleGuestType } from '../api/types';
import { housekeepingStatusOf } from './housekeepingBlocks';
import { formatMoney } from './quickStats';

/** The fields of a block the content rules read. */
export type BlockContentSource = Pick<
  ScheduleBlock,
  'guestName' | 'guestType' | 'roomId' | 'startDate' | 'endDate' | 'status'
> &
  Partial<
    Pick<
      ScheduleBlock,
      | 'occupantCount'
      | 'occupants'
      | 'reserverName'
      | 'blockName'
      | 'roomTypeName'
      | 'balanceCents'
      | 'housekeeping'
      | 'linkedTo'
    >
  >;

/** Month (30 day) view: stays shorter than this many nights are compact (initials, no type icon). */
export const COMPACT_MONTH_NIGHTS = 2;

/** "Daniel Whitfield" becomes "D.W."; one word gives "M."; nothing gives "". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}.${last ? `${last}.` : ''}`.toUpperCase();
}

/** Guests beyond the lead: the N of "+N". */
export function extraGuests(occupantCount: number | undefined): number {
  return occupantCount !== undefined && occupantCount > 1 ? occupantCount - 1 : 0;
}

const plus = (n: number) => (n > 0 ? ` +${n}` : '');

/**
 * Month view with a stay under two nights (legacy): the lead shows as initials and the guest-type
 * icon is hidden, which makes room in a one-day-wide block. `days` is the view length (7, 14, 30).
 */
export function isCompactMonth(days: number, startDate: string, endDate: string): boolean {
  return days === 30 && daysBetween(startDate, endDate) < COMPACT_MONTH_NIGHTS;
}

export interface BlockContent {
  /** First line: the lead occupant with "+N", else the reserver, else the block name, else the guest count. */
  title: string;
  /**
   * Second line, the most relevant detail, or "" when there is none (the confirmation number then
   * takes the line):
   * 1. no room yet: the room type;
   * 2. checked in or out: "Balance due: $X" while the folio is open, else the reserver;
   * 3. the reserver, when not the lead occupant;
   * 4. "Maintenance", when the room needs maintenance;
   * 5. the block name.
   */
  detail: string;
  /** Show the guest-type icon. */
  showIcon: boolean;
  /** The title is initials (month view, short stay). */
  compact: boolean;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The text of a (non-linked) reservation block in a view of `days` days (7, 14 or 30). */
export function blockContent(block: BlockContentSource, days: number): BlockContent {
  const compact = isCompactMonth(days, block.startDate, block.endDate);
  const lead = block.guestName.trim();
  const reserver = block.reserverName?.trim() ?? '';
  const extra = plus(extraGuests(block.occupantCount));
  const person = (name: string) => (compact ? initials(name) : name);

  let title: string;
  if (lead) title = `${person(lead)}${extra}`;
  else if (reserver) title = `${person(reserver)}${extra}`;
  else if (block.blockName) title = block.blockName;
  else title = block.occupantCount ? String(block.occupantCount) : '';

  const unassigned = block.roomId === '';
  const settled = block.status === 'checked-in' || block.status === 'checked-out';
  const reserverLine = reserver ? `${reserver}${extra}` : '';
  let detail = '';
  if (unassigned) {
    detail = block.roomTypeName ?? '';
  } else if (settled) {
    detail =
      block.balanceCents !== undefined && block.balanceCents > 0
        ? `Balance due: ${formatMoney(block.balanceCents)}`
        : reserverLine;
  } else if (reserver && (!lead || !same(reserver, lead))) {
    detail = reserver;
  } else if (housekeepingStatusOf(block as ScheduleBlock) === 'needs-maintenance') {
    detail = 'Maintenance';
  }
  if (!detail && block.blockName && title !== block.blockName) detail = block.blockName;

  return { title, detail, showIcon: !compact, compact };
}

const GUEST_TYPE_LABEL: Record<ScheduleGuestType, string | null> = {
  owner: 'Room owner',
  member: 'Club member',
  guest: 'Non-member guest',
  none: null,
};

/** The name of the guest-type icon and color, for the tooltip; null when the block has none. */
export const guestTypeLabel = (type: ScheduleGuestType): string | null => GUEST_TYPE_LABEL[type];

/**
 * Tooltip lines of a reservation block: `summary` (guest, confirmation number, room), then the
 * guest type, the reserver when not the lead, every occupant (unnamed guests as TBD), the requested
 * room type of an unassigned reservation, the block name and an open balance.
 */
export function blockTooltipLines(block: BlockContentSource, summary: string): string[] {
  const lines = [summary];
  const type = guestTypeLabel(block.guestType);
  if (type) lines.push(type);
  const lead = block.guestName.trim();
  const reserver = block.reserverName?.trim();
  if (reserver && !same(reserver, lead)) lines.push(`Reserver: ${reserver}`);
  const named = block.occupants ?? (lead ? [lead] : []);
  const unnamed = Math.max(0, (block.occupantCount ?? named.length) - named.length);
  if (named.length + unnamed > 1) {
    lines.push(`Occupants: ${[...named, ...Array<string>(unnamed).fill('TBD')].join(', ')}`);
  }
  if (block.roomId === '' && block.roomTypeName) lines.push(`Room type: ${block.roomTypeName}`);
  if (block.blockName) lines.push(`Block: ${block.blockName}`);
  if (block.balanceCents !== undefined && block.balanceCents > 0) {
    lines.push(`Balance due: ${formatMoney(block.balanceCents)}`);
  }
  return lines;
}
