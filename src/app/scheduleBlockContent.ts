// What a reservation block writes and what its tooltip lists (ticket LP-S.1). The rules follow the
// legacy schedule box (title, relevant detail line, month-view initials); the layout and colors
// are this build's. Pure, no React.
import { daysBetween } from '../lib/dates';
import type { ScheduleBlock, ScheduleGuestType } from '../api/types';
import { housekeepingStatusOf } from './housekeepingBlocks';
import { MONTH_VIEW_DAYS } from './schedule';
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

/**
 * "Daniel Whitfield" becomes "D.W."; one word gives "M."; nothing gives "". Leading punctuation
 * ("(TBD)") is skipped and characters outside the basic plane (emoji, some names) stay whole.
 */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word.replace(/^[^\p{L}\p{N}]+/u, ''))[0])
    .filter((c): c is string => Boolean(c));
  if (letters.length === 0) return '';
  const first = letters[0];
  const last = letters.length > 1 ? letters[letters.length - 1] : '';
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
  return days === MONTH_VIEW_DAYS && daysBetween(startDate, endDate) < COMPACT_MONTH_NIGHTS;
}

export interface BlockContent {
  /** First line: the lead occupant with "+N", else the reserver, else the block name, else the guest count. */
  title: string;
  /**
   * Second line, the most relevant detail, or "" when there is none (the confirmation number then
   * takes the line):
   * 1. no room yet: the room type;
   * 2. checked in or out: "Balance due: $X" while the folio balance is above zero (zero or negative
   *    shows nothing), else the reserver when not the lead occupant;
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
const isPlaceholder = (name: string) => name === '' || /^tbd$/i.test(name);

/** Named occupants without blanks. */
const namedOccupants = (block: BlockContentSource): string[] =>
  (block.occupants ?? []).map((n) => n.trim()).filter((n) => n !== '' && !isPlaceholder(n));

/** The lead occupant's name: `guestName`, or the first named occupant when that is blank or TBD. */
export function leadName(block: BlockContentSource): string {
  const lead = block.guestName.trim();
  return isPlaceholder(lead) ? (namedOccupants(block)[0] ?? '') : lead;
}

const owes = (block: BlockContentSource): block is BlockContentSource & { balanceCents: number } =>
  block.balanceCents !== undefined && block.balanceCents > 0;

/** The text of a (non-linked) reservation block in a view of `days` days (7, 14 or 30). */
export function blockContent(block: BlockContentSource, days: number): BlockContent {
  const compact = isCompactMonth(days, block.startDate, block.endDate);
  const lead = leadName(block);
  const reserver = block.reserverName?.trim() ?? '';
  const extra = plus(extraGuests(block.occupantCount));
  const person = (name: string) => (compact ? initials(name) : name);

  let title: string;
  if (lead) title = `${person(lead)}${extra}`;
  else if (reserver) title = `${person(reserver)}${extra}`;
  else if (block.blockName) title = block.blockName;
  else if (block.occupantCount) {
    title = `${block.occupantCount} ${block.occupantCount === 1 ? 'guest' : 'guests'}`;
  } else title = '';

  const unassigned = block.roomId === '';
  const settled = block.status === 'checked-in' || block.status === 'checked-out';
  const otherReserver = reserver !== '' && (!lead || !same(reserver, lead));
  let detail = '';
  if (unassigned) {
    detail = block.roomTypeName ?? '';
  } else if (settled) {
    detail = owes(block)
      ? `Balance due: ${formatMoney(block.balanceCents)}`
      : otherReserver
        ? reserver
        : '';
  } else if (otherReserver) {
    detail = reserver;
  } else if (housekeepingStatusOf(block) === 'needs-maintenance') {
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
 * The facts a block states beyond its summary, shared by the tooltip and the accessible name:
 * the guest type, then the reserver when not the lead, every occupant (unnamed guests as TBD, only
 * when more than one guest), the requested room type of an unassigned reservation, the block name
 * and an open balance.
 */
export function blockFacts(block: BlockContentSource): { type: string | null; details: string[] } {
  const lead = leadName(block);
  const reserver = block.reserverName?.trim();
  const details: string[] = [];
  if (reserver && !same(reserver, lead)) details.push(`Reserver: ${reserver}`);
  const named = namedOccupants(block);
  if (named.length === 0 && lead) named.push(lead);
  const unnamed = Math.max(0, (block.occupantCount ?? named.length) - named.length);
  if (named.length + unnamed > 1) {
    details.push(`Occupants: ${[...named, ...Array<string>(unnamed).fill('TBD')].join(', ')}`);
  }
  if (block.roomId === '' && block.roomTypeName) details.push(`Room type: ${block.roomTypeName}`);
  if (block.blockName) details.push(`Block: ${block.blockName}`);
  if (owes(block)) details.push(`Balance due: ${formatMoney(block.balanceCents)}`);
  return { type: guestTypeLabel(block.guestType), details };
}

/** Tooltip lines of a reservation block: `summary` (guest, confirmation number, room), then the facts. */
export function blockTooltipLines(block: BlockContentSource, summary: string): string[] {
  const { type, details } = blockFacts(block);
  return [summary, ...(type ? [type] : []), ...details];
}
