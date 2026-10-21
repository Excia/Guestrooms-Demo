import type {
  Cents,
  Folio,
  FolioCharge,
  FolioLineType,
  FolioOccupant,
  FolioRoom,
} from '../api/types';

// Business rules of the folio screen (ticket 4.1), kept free of React so they are unit tested on
// their own. Money is in cents.

export interface FolioBalances {
  /** Posted charges not yet settled: what the guest owes now. */
  postedCents: Cents;
  /** Charges waiting for Night Audit. */
  unpostedCents: Cents;
}

/** Settled and split lines are off the balance; posted and unposted lines add up separately. */
export function folioBalances(charges: readonly FolioCharge[]): FolioBalances {
  let postedCents = 0;
  let unpostedCents = 0;
  for (const c of charges) {
    if (c.status === 'posted') postedCents += c.amountCents;
    else if (c.status === 'unposted') unpostedCents += c.amountCents;
  }
  return { postedCents, unpostedCents };
}

export type BalanceTone = 'grey' | 'yellow' | 'green' | 'red';

/**
 * Color of the Balance Summary (Figma 16575:25666):
 * - grey: not checked in, or the folio is closed;
 * - yellow: checked in, or checked out with unposted charges that are not $0;
 * - red: checked out, folio open, posted balance above $0 (needs settling);
 * - green: checked out, folio open and settled ($0).
 * The ticket does not say which wins for a checked-out folio with both a posted balance and unposted
 * charges; red wins, because the posted balance is what must be settled (see docs, Q-38-3).
 */
export function balanceTone(
  folio: Pick<Folio, 'checkInStatus' | 'open'>,
  balances: FolioBalances,
): BalanceTone {
  if (!folio.open) return 'grey';
  if (folio.checkInStatus === 'not-checked-in') return 'grey';
  if (folio.checkInStatus === 'checked-in') return 'yellow';
  if (balances.postedCents > 0) return 'red';
  return balances.unpostedCents !== 0 ? 'yellow' : 'green';
}

/** What the Balance Summary color means, for screen readers (color alone must not carry it). */
export const BALANCE_TONE_LABELS: Record<BalanceTone, string> = {
  grey: 'No balance due',
  yellow: 'Stay in progress or charges not yet posted',
  green: 'Settled',
  red: 'Needs settling',
};

// ---- occupant filter ------------------------------------------------------------------------

/** `all`, `room:<roomId>` (every line of a room) or `occupant:<occupantId>`. */
export type OccupantFilter = string;
export const ALL_OCCUPANTS: OccupantFilter = 'all';

export interface OccupantFilterOption {
  value: OccupantFilter;
  label: string;
  /** Occupant options are indented under their room. */
  indent: boolean;
  /** The first option of a room after the first starts a new group (a divider above it). */
  groupStart: boolean;
}

export const roomLabel = (room: FolioRoom | undefined) =>
  room?.number ? `Room ${room.number}` : 'Unassigned room';

/** "All", then per room: the room, then each of its occupants (Figma 16252:5285). */
export function occupantFilterOptions(
  rooms: readonly FolioRoom[],
  occupants: readonly FolioOccupant[],
): OccupantFilterOption[] {
  const options: OccupantFilterOption[] = [
    { value: ALL_OCCUPANTS, label: 'All', indent: false, groupStart: false },
  ];
  rooms.forEach((room, i) => {
    options.push({
      value: `room:${room.id}`,
      label: roomLabel(room),
      indent: false,
      groupStart: i > 0,
    });
    for (const o of occupants.filter((x) => x.roomId === room.id)) {
      options.push({
        value: `occupant:${o.id}`,
        label: `${roomLabel(room)} - ${o.name}`,
        indent: true,
        groupStart: false,
      });
    }
  });
  return options;
}

/** The charges the filter lets through. Unknown values show everything. */
export function filterCharges(
  charges: readonly FolioCharge[],
  filter: OccupantFilter,
): FolioCharge[] {
  if (filter.startsWith('room:')) {
    const roomId = filter.slice('room:'.length);
    return charges.filter((c) => c.roomId === roomId);
  }
  if (filter.startsWith('occupant:')) {
    const occupantId = filter.slice('occupant:'.length);
    return charges.filter((c) => c.occupantId === occupantId);
  }
  return [...charges];
}

export const isFilterApplied = (filter: OccupantFilter, options: readonly OccupantFilterOption[]) =>
  filter !== ALL_OCCUPANTS && options.some((o) => o.value === filter);

/** Text of the row under the table while a filter is applied. */
export function chargeCountText(shown: number, total: number, filterLabel: string): string {
  return `Showing ${shown}/${total} Charges - Viewed by ${filterLabel}`;
}

// ---- selection and actions ---------------------------------------------------------------------
// FLAG: the full action matrix per line type is ticket 4.2 (open question Q-39-1). Until then:
// only posted lines can be settled, split or transferred; only manual and MPOS lines transfer.

/** Settled and split lines have no checkbox. */
export const isSelectable = (c: FolioCharge) => c.status === 'posted' || c.status === 'unposted';

export const selectionTotalCents = (selected: readonly FolioCharge[]): Cents =>
  selected.reduce((sum, c) => sum + c.amountCents, 0);

const TRANSFERABLE: readonly FolioLineType[] = ['manual', 'mpos'];

export interface SelectionActions {
  split: boolean;
  transfer: boolean;
  settle: boolean;
}

export function selectionActions(
  selected: readonly FolioCharge[],
  open: boolean,
): SelectionActions {
  const posted = open && selected.length > 0 && selected.every((c) => c.status === 'posted');
  return {
    split: posted,
    settle: posted,
    transfer: posted && selected.every((c) => TRANSFERABLE.includes(c.type)),
  };
}

export interface RowActions {
  post: boolean;
  edit: boolean;
  remove: boolean;
  transfer: boolean;
}

/**
 * Row icons a charge carries (Figma 12047:3400). On a closed folio they stay but are disabled;
 * the component does that, so these say only which icons a line has.
 */
export function rowActions(c: FolioCharge): RowActions {
  const unposted = c.status === 'unposted';
  return {
    post: unposted,
    edit: unposted && c.type === 'room-rate',
    remove: unposted && c.type === 'manual',
    // A settled MPOS line may still move, to Unassigned only (decided in the transfer dialog).
    transfer: c.type === 'mpos' && (c.status === 'posted' || c.status === 'settled'),
  };
}

// ---- display -----------------------------------------------------------------------------------

export const CHARGE_TYPE_LABELS: Record<FolioLineType, string> = {
  'room-rate': 'RoomDailyRate',
  mpos: 'Mobile Point of Sale',
  manual: 'Manual Charge',
  'add-on': 'Add-On',
  surcharge: 'Surcharge',
  'service-fee': 'Service Fee',
};

/** MAX_REFERENCES reference numbers show in the Status cell; the rest are on hover. */
export const MAX_REFERENCES = 3;

export interface ReferenceDisplay {
  /** "Ref #123" for one number, "Ref #789, #910, #111" for several (the first carries the label). */
  text: string;
  /** Set when numbers were cut: the full list for the hover text. */
  full: string | null;
}

export function referenceDisplay(references: readonly string[]): ReferenceDisplay {
  const list = (refs: readonly string[]) =>
    refs.length === 0 ? '' : `Ref ${refs.map((r) => `#${r}`).join(', ')}`;
  if (references.length <= MAX_REFERENCES) return { text: list(references), full: null };
  return { text: `${list(references.slice(0, MAX_REFERENCES))}, …`, full: list(references) };
}

export function chargeStatusLabel(c: FolioCharge): { text: string; full: string | null } {
  switch (c.status) {
    case 'posted':
      return { text: 'Posted', full: null };
    case 'unposted':
      return { text: 'Unposted', full: null };
    case 'split':
      return { text: 'Split', full: null };
    case 'settled': {
      const refs = referenceDisplay(c.references);
      return {
        text: refs.text ? `Settled - ${refs.text}` : 'Settled',
        full: refs.full ? `Settled - ${refs.full}` : null,
      };
    }
  }
}
