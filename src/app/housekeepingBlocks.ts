import type { HousekeepingStatus, ScheduleBlock } from '../api/types';

/**
 * Which stays get an "H" housekeeping block (functional doc 15.13.1; legacy draws one per stay at
 * its departure). Every stay that sits in a room has one, whatever its check-in status. An
 * unassigned reservation (no room yet) and a linked-room block (a shadow of another room's stay,
 * no event of its own in the legacy system) have none.
 */
export function needsHousekeepingBlock(block: ScheduleBlock): boolean {
  return block.roomId !== '' && block.linkedTo === undefined;
}

/**
 * The status the "H" block shows: the stored one, or, when the backend sent none, the legacy
 * default of a stay whose room has not been checked out ("Not Checked Out"). `nyci` is stored only
 * when the backend says so; it is drawn invisible (Figma).
 */
export function housekeepingStatusOf(block: ScheduleBlock): HousekeepingStatus | undefined {
  if (!needsHousekeepingBlock(block)) return undefined;
  return block.housekeeping ?? 'not-checked-out';
}
