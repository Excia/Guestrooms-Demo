import {
  SETTABLE_HOUSEKEEPING_STATUSES,
  type HousekeepingStatus,
  type ScheduleBlock,
  type ScheduleBlockStatus,
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

/** Where a stay is in its lifecycle, as far as housekeeping cares. */
export type StayLifecycle = 'not-checked-in' | 'in-house' | 'checked-out';

export function stayLifecycle(status: ScheduleBlockStatus): StayLifecycle {
  switch (status) {
    case 'checked-in':
      return 'in-house';
    case 'checked-out':
      return 'checked-out';
    case 'confirmed':
    case 'nyci':
      return 'not-checked-in';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

/** The cleaning states staff set once the guest has left, in the pick-list order (functional doc 15.13.4). */
const CLEANING_STATUSES: readonly SettableHousekeepingStatus[] = [
  'needs-cleaning',
  'cleaned',
  'ready',
  'needs-maintenance',
];

type HousekeepingSubject = Pick<ScheduleBlock, 'roomId' | 'linkedTo' | 'housekeeping' | 'status'>;

/**
 * The status the "H" block shows, derived from the stay's check-in status (D-HK-4); the stored
 * `block.housekeeping` only refines it where staff may set it:
 *
 * | stay                        | shown                                                             |
 * | --------------------------- | ----------------------------------------------------------------- |
 * | no room / linked-room block | none (no "H" block)                                               |
 * | not yet checked in          | `nyci` (drawn invisible), or `needs-maintenance` if staff flagged the room |
 * | checked in (guest in house) | `not-checked-out`, whatever is stored                             |
 * | checked out                 | the stored cleaning state; `needs-cleaning` when none is stored   |
 *
 * "Stored none" also covers a stored value that makes no sense for the stay's lifecycle (for
 * example `cleaned` on a stay not checked in, or `not-checked-out` on a checked-out one).
 */
export function housekeepingStatusOf(block: HousekeepingSubject): HousekeepingStatus | undefined {
  if (!needsHousekeepingBlock(block)) return undefined;
  switch (stayLifecycle(block.status)) {
    case 'not-checked-in':
      return block.housekeeping === 'needs-maintenance' ? 'needs-maintenance' : 'nyci';
    case 'in-house':
      return 'not-checked-out';
    case 'checked-out':
      return CLEANING_STATUSES.find((s) => s === block.housekeeping) ?? 'needs-cleaning';
  }
}

/**
 * The statuses the pop-up offers for a stay: only transitions that make sense for its lifecycle.
 * A stay not checked in has nothing to set (its chip is invisible) except the maintenance flag
 * staff already put on the room; a guest in house stays "Not Checked Out"; after check-out the four
 * cleaning states. Legacy offers every status on every stay; this is stricter (D-HK-5).
 */
export function housekeepingOptionsFor(
  block: HousekeepingSubject,
): readonly { value: SettableHousekeepingStatus; label: string }[] {
  const status = housekeepingStatusOf(block);
  let allowed: readonly SettableHousekeepingStatus[];
  switch (status) {
    case undefined:
    case 'nyci':
      allowed = [];
      break;
    case 'needs-maintenance':
      allowed =
        stayLifecycle(block.status) === 'not-checked-in'
          ? ['needs-maintenance']
          : CLEANING_STATUSES;
      break;
    case 'not-checked-out':
      allowed = ['not-checked-out'];
      break;
    default:
      allowed = CLEANING_STATUSES;
  }
  return HOUSEKEEPING_OPTIONS.filter((o) => allowed.includes(o.value));
}

/** The stored value to write when a stay's check-in status changes (the mock flows and the backend agree on it). */
export function housekeepingOnCheckIn(): SettableHousekeepingStatus {
  return 'not-checked-out';
}

export function housekeepingOnCheckOut(): SettableHousekeepingStatus {
  return 'needs-cleaning';
}
