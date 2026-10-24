import {
  SETTABLE_HOUSEKEEPING_STATUSES,
  type HousekeepingStatus,
  type ScheduleBlock,
  type SettableHousekeepingStatus,
} from '../api/types';

/*
 * Single source of housekeeping statuses for the schedule (and the filter that reads them):
 *  - ids and their order: `SETTABLE_HOUSEKEEPING_STATUSES` and `HousekeepingStatus` in `api/types.ts`;
 *  - spoken labels: `HOUSEKEEPING_LABELS`; display labels and pick-list order: `housekeepingStatusLabel`
 *    and `HOUSEKEEPING_OPTIONS` below;
 *  - the status of a stay: `housekeepingStatusOf(block)`. Never read the raw `block.housekeeping` for
 *    display, state or filtering: it is absent for a stay the backend has no status for.
 */

/** Spoken (lower case) label of every status, used in accessible names. */
export const HOUSEKEEPING_LABELS: Record<HousekeepingStatus, string> = {
  'not-checked-out': 'not checked out',
  'needs-cleaning': 'needs cleaning',
  cleaned: 'cleaned',
  ready: 'ready',
  'needs-maintenance': 'needs maintenance',
  nyci: 'next guest not yet checked in',
};

/** Display label of a status, e.g. "Not Checked Out" (tooltips, the pop-up's select, the filter). */
export function housekeepingStatusLabel(status: HousekeepingStatus): string {
  return HOUSEKEEPING_LABELS[status].replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The statuses staff may pick, in the order of functional doc 15.13.4 (NYCI is not settable). */
export const HOUSEKEEPING_OPTIONS: readonly { value: SettableHousekeepingStatus; label: string }[] =
  SETTABLE_HOUSEKEEPING_STATUSES.map((value) => ({
    value,
    label: housekeepingStatusLabel(value),
  }));

/**
 * Which stays get an "H" housekeeping block (functional doc 15.13.1; legacy draws one per stay at
 * its departure). Every stay that sits in a room has one, whatever its check-in status. An
 * unassigned reservation (no room yet) and a linked-room block (a shadow of another room's stay,
 * no event of its own in the legacy system) have none.
 */
export function needsHousekeepingBlock(block: Pick<ScheduleBlock, 'roomId' | 'linkedTo'>): boolean {
  return block.roomId !== '' && block.linkedTo === undefined;
}

/**
 * The status the "H" block shows: the stored one, or, when the backend sent none, the legacy
 * default of a stay whose room has not been checked out ("Not Checked Out"). `nyci` is stored only
 * when the backend says so; it is drawn invisible (Figma).
 */
export function housekeepingStatusOf(
  block: Pick<ScheduleBlock, 'roomId' | 'linkedTo' | 'housekeeping'>,
): HousekeepingStatus | undefined {
  if (!needsHousekeepingBlock(block)) return undefined;
  return block.housekeeping ?? 'not-checked-out';
}
