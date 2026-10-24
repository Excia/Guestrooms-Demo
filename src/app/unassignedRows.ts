// The grid's Unassigned section (owner, 2026-10-21): reservation rooms booked without a room,
// shown above the room rows. Pure, so the four states are unit tested apart from the component.
import { nightsOverlap, addDays, type IsoDate } from '../lib/dates';
import type { ScheduleBlock } from '../api/types';

/**
 * none: nothing in the range, no row. single: one reservation, one row, no toggle. expanded: two
 * or more, one row each. collapsed: two or more, folded to one label row with the count.
 */
export type UnassignedState = 'none' | 'single' | 'expanded' | 'collapsed';

export interface UnassignedSection {
  state: UnassignedState;
  /** Unassigned reservation rooms in the visible range, also while collapsed. */
  count: number;
  /** One entry per grid row, each holding that row's block; the collapsed row holds none. */
  rows: ScheduleBlock[][];
  /** The expand/collapse control shows (two or more). */
  toggleable: boolean;
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
  if (count === 0) return { state: 'none', count, rows: [], toggleable: false };
  if (count === 1) return { state: 'single', count, rows: [[visible[0]]], toggleable: false };
  if (collapsed) return { state: 'collapsed', count, rows: [[]], toggleable: true };
  return { state: 'expanded', count, rows: visible.map((b) => [b]), toggleable: true };
}

/** The label cell's text: "Unassigned", with "(N)" on a second line only while collapsed. */
export function unassignedLabel(section: UnassignedSection): { title: string; count?: string } {
  return section.state === 'collapsed'
    ? { title: 'Unassigned', count: `(${section.count})` }
    : { title: 'Unassigned' };
}

/** Accessible name of the toggle: one fixed name; `aria-expanded` carries the state. */
export function unassignedToggleName(): string {
  return 'Unassigned reservations';
}
