import type { FolioCharge, IsoDate } from '../api/types';

// Which actions each folio line offers (ticket 4.2, Figma "All Folio Line Types / Variations"
// 16480:83130). Pure, so every type and state is unit tested. The Figma frames and annotations
// decide each row; where they are silent the choice is recorded in docs/requirements (D-079).

/**
 * `allowed`: the action works; `error`: the control is there and using it shows the disallowed-action
 * dialog (tickets 4.5 and 4.13); `no`: the action does not apply to the line.
 */
export type ActionState = 'allowed' | 'error' | 'no';

export interface LineActions {
  /** Row checkbox. */
  select: boolean;
  split: ActionState;
  transfer: ActionState;
  /** Transfer of a settled MPOS line goes to Unassigned only (ticket 4.5). */
  transferUnassignedOnly: boolean;
  settle: boolean;
  /** "Post via Night Audit" row action. */
  post: boolean;
  edit: boolean;
  delete: boolean;
  /** The Split control of a split parent: opens the split window to edit or undo (ticket 4.13). */
  editSplit: boolean;
}

export interface LineContext {
  /** The folio's date today; an unposted room rate is "on date" when its night is today or earlier. */
  today: IsoDate;
}

const NONE: LineActions = {
  select: false,
  split: 'no',
  transfer: 'no',
  transferUnassignedOnly: false,
  settle: false,
  post: false,
  edit: false,
  delete: false,
  editSplit: false,
};

/**
 * What the line offers on an open folio. A closed folio disables everything, so the screen passes
 * the folio's `open` flag to the controls instead of asking here (the icons stay, greyed out).
 */
export function lineActions(line: FolioCharge, { today }: LineContext): LineActions {
  const { status, type } = line;
  if (type === 'surcharge' || type === 'service-fee') return NONE;
  if (status === 'settled') {
    // Settled lines have no checkbox; a settled MPOS line can still move, to Unassigned only.
    return type === 'mpos' ? { ...NONE, transfer: 'allowed', transferUnassignedOnly: true } : NONE;
  }
  if (type === 'split-parent') return { ...NONE, editSplit: true };
  const posted = status === 'posted';
  switch (type) {
    case 'room-rate':
      if (posted) return { ...NONE, select: true, split: 'allowed', settle: true };
      // Unposted on its night: Night Audit is due, so it can be posted, not yet settled.
      if (line.date <= today) return { ...NONE, post: true, edit: true };
      // Unposted before its night: can be selected and settled ahead, edited, not posted early.
      return { ...NONE, select: true, settle: true, edit: true };
    case 'mpos':
      return posted
        ? { ...NONE, select: true, split: 'allowed', transfer: 'allowed', settle: true }
        : NONE;
    case 'manual':
      return posted
        ? { ...NONE, select: true, split: 'allowed', transfer: 'allowed', settle: true }
        : { ...NONE, post: true, delete: true };
    case 'add-on':
      // Add-ons cannot be transferred.
      return posted
        ? { ...NONE, select: true, split: 'allowed', settle: true }
        : { ...NONE, post: true, delete: true };
    case 'split-child':
      // A split of a split, or moving one part, is refused with an error dialog.
      return posted
        ? { ...NONE, select: true, split: 'error', transfer: 'error', settle: true }
        : NONE;
    default:
      return NONE;
  }
}

export interface SelectionActions {
  split: ActionState;
  transfer: ActionState;
  settle: boolean;
}

const combine = (states: readonly ActionState[]): ActionState =>
  states.every((s) => s === 'allowed')
    ? 'allowed'
    : states.some((s) => s === 'no')
      ? 'no'
      : 'error';

/**
 * What the action bar offers for a selection: Settle needs every line settleable; Split and
 * Transfer need every line to allow it, and are `error` (enabled, then refused with a dialog) when
 * the only blockers are split children. Nothing is offered on a closed folio or without a selection.
 */
export function selectionActions(
  selected: readonly FolioCharge[],
  open: boolean,
  context: LineContext,
): SelectionActions {
  if (!open || selected.length === 0) return { split: 'no', transfer: 'no', settle: false };
  const per = selected.map((l) => lineActions(l, context));
  return {
    split: combine(per.map((a) => a.split)),
    transfer: combine(per.map((a) => a.transfer)),
    settle: per.every((a) => a.settle),
  };
}
