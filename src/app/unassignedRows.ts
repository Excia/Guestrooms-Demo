// The grid's Unassigned section (owner, 2026-10-21; zero row 2026-10-24): reservation rooms booked without a room,
// shown above the room rows. Pure, so the four states are unit tested apart from the component.
import { nightsOverlap, addDays, type IsoDate } from '../lib/dates';
import type { ScheduleBlock } from '../api/types';

/**
 * empty: nothing in the range, one collapsed label row "Unassigned (0)" (owner, 2026-10-24). single:
 * one reservation, one row, no toggle. expanded: two or more, one row each. collapsed: two or more,
 * folded to one label row with the count.
 */
export type UnassignedState = 'empty' | 'single' | 'expanded' | 'collapsed';

export interface UnassignedSection {
  state: UnassignedState;
  /** Unassigned reservation rooms in the visible range, also while collapsed. */
  count: number;
  /** One entry per grid row, each holding that row's block; the collapsed row holds none. */
  rows: ScheduleBlock[][];
  /** The expand/collapse control shows (none or two or more). */
  toggleable: boolean;
  /** The control shows but cannot act: there is nothing to expand (zero). */
  toggleDisabled: boolean;
}

/**
 * The section for the visible range [startDate, startDate + days). `collapsed` only matters when
 * there are two or more; a lone reservation never collapses. Rows are not packed: each reservation
 * room has its own row, ordered by arrival, then id.
 */
export function unassignedSection(
  blocks: readonly ScheduleBlock[],
  startDate: IsoDate,
  days: number,
  collapsed: boolean,
): UnassignedSection {
  const end = addDays(startDate, days);
  const visible = blocks
    .filter((b) => nightsOverlap(b.startDate, b.endDate, startDate, end))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  const count = visible.length;
  if (count === 0) {
    return { state: 'empty', count, rows: [[]], toggleable: true, toggleDisabled: true };
  }
  if (count === 1) {
    return {
      state: 'single',
      count,
      rows: [[visible[0]]],
      toggleable: false,
      toggleDisabled: false,
    };
  }
  if (collapsed) {
    return { state: 'collapsed', count, rows: [[]], toggleable: true, toggleDisabled: false };
  }
  return {
    state: 'expanded',
    count,
    rows: visible.map((b) => [b]),
    toggleable: true,
    toggleDisabled: false,
  };
}

/** The label cell's text: "Unassigned", with "(N)" on a second line while collapsed or empty. */
export function unassignedLabel(section: UnassignedSection): { title: string; count?: string } {
  return section.state === 'collapsed' || section.state === 'empty'
    ? { title: 'Unassigned', count: `(${section.count})` }
    : { title: 'Unassigned' };
}

/** Accessible name of the toggle: one fixed name; `aria-expanded` carries the state. */
export function unassignedToggleName(): string {
  return 'Unassigned reservations';
}

/** Read out with the disabled toggle at zero, where there is nothing to expand. */
export const UNASSIGNED_EMPTY_HINT = 'There are no unassigned reservations in this date range.';
