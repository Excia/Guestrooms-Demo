import type { HousekeepingStatus } from '../api/types';
import type { ScheduleColors } from '../theme';

/** The `palette.schedule` token that fills a block. */
export type BlockFillToken = 'nyci' | 'checkedIn' | 'checkedOut' | 'dueOut' | 'closure' | 'linked';

interface FillSubject {
  kind: 'reservation' | 'closure';
  status?: 'confirmed' | 'nyci' | 'checked-in' | 'checked-out';
  endDate: string;
  linkedTo?: unknown;
}

/**
 * Fill token of a block (Figma "Reservation Schedule Block"): not yet checked in (confirmed or
 * NYCI) is the pale card with a green border, checked in green, checked in and leaving today
 * ("due out") light orange, checked out grey; a linked-room block and a closure have their own greys.
 */
export function blockFillToken(item: FillSubject, today: string): BlockFillToken {
  if (item.kind === 'closure') return 'closure';
  if (item.linkedTo) return 'linked';
  if (item.status === 'checked-in') return item.endDate === today ? 'dueOut' : 'checkedIn';
  if (item.status === 'checked-out') return 'checkedOut';
  return 'nyci';
}

/** Token of the "H" chip fill; `nyci` has none (Figma draws it fully transparent). */
export type HousekeepingFillToken = keyof Pick<
  ScheduleColors,
  'hkNotCheckedOut' | 'hkNeedsCleaning' | 'hkCleaned' | 'hkReady' | 'hkNeedsMaintenance'
>;

export function housekeepingFillToken(status: HousekeepingStatus): HousekeepingFillToken | null {
  switch (status) {
    case 'not-checked-out':
      return 'hkNotCheckedOut';
    case 'needs-cleaning':
      return 'hkNeedsCleaning';
    case 'cleaned':
      return 'hkCleaned';
    case 'ready':
      return 'hkReady';
    case 'needs-maintenance':
      return 'hkNeedsMaintenance';
    default:
      return null;
  }
}
