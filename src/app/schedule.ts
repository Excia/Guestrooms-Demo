// Pure rules for the schedule grid's view: the visible date range, navigation, headers, filtering
// and where a block sits in the columns. Dates are ISO "yyyy-mm-dd" strings; arithmetic goes
// through src/lib/dates.ts so DST never shifts a day.
import { addDays, daysBetween, nightsOverlap, parseIsoDate, type IsoDate } from '../lib/dates';
import { SCHEDULE_DAYS } from '../api/types';
import { HOUSEKEEPING_OPTIONS, housekeepingStatusOf } from './housekeepingBlocks';
import type {
  HousekeepingStatus,
  ScheduleAvailability,
  ScheduleBlock,
  ScheduleData,
  ScheduleDays,
  ScheduleLocation,
  ScheduleRoom,
  ScheduleRoomType,
  SettableHousekeepingStatus,
} from '../api/types';

export const DEFAULT_SCHEDULE_DAYS: ScheduleDays = 7;

/** Labels of the View select. */
export const SCHEDULE_VIEW_LABELS: Record<ScheduleDays, string> = {
  7: '7 Days',
  14: '14 Days',
  30: '30 Days',
};

/** A value from the URL or a select as a view length; anything unknown falls back to 7 days. */
export function parseScheduleDays(value: unknown): ScheduleDays {
  const n = Number(value);
  return SCHEDULE_DAYS.find((d) => d === n) ?? DEFAULT_SCHEDULE_DAYS;
}

/** The columns' dates: `days` consecutive days from `start`. */
export function scheduleDates(start: IsoDate, days: ScheduleDays): IsoDate[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

/** Exclusive end of the range: the day after the last column. */
export const scheduleRangeEnd = (start: IsoDate, days: ScheduleDays): IsoDate =>
  addDays(start, days);

/** 'day': the single chevron (one day). 'page': the double chevron (a whole view length). */
export type ScheduleStep = 'day' | 'page';

export function shiftScheduleStart(
  start: IsoDate,
  days: ScheduleDays,
  direction: -1 | 1,
  step: ScheduleStep,
): IsoDate {
  return addDays(start, direction * (step === 'page' ? days : 1));
}

/** The "Today" button: the grid starts on today. */
export const scheduleStartForToday = (today: IsoDate): IsoDate => today;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Weekday header: "Monday 11/10" (month/day, no year). An invalid date is returned unchanged. */
export function dayHeader(iso: IsoDate): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export interface RoomRowLabel {
  location: string;
  roomType: string;
  number: string;
  /** Row header text: "location | room type". */
  label: string;
}

/** Row header for a room: unknown ids show as empty names rather than throwing. */
export function roomRowLabel(
  room: ScheduleRoom,
  locations: readonly ScheduleLocation[],
  roomTypes: readonly ScheduleRoomType[],
): RoomRowLabel {
  const location = locations.find((l) => l.id === room.locationId)?.name ?? '';
  const roomType = roomTypes.find((t) => t.id === room.roomTypeId)?.name ?? '';
  return { location, roomType, number: room.number, label: `${location} | ${roomType}` };
}

export interface BlockLayout {
  /** 0-based first column the block covers inside the range. */
  column: number;
  /** Number of columns covered; at least 1. */
  span: number;
  /** The stay began before the range: the left edge is clipped. */
  continuesBefore: boolean;
  /** The stay goes on after the range: the right edge is clipped. */
  continuesAfter: boolean;
}

/**
 * Columns for a stay [startDate, endDate) in a range of `days` columns from `rangeStart`. One
 * column per occupied night, so a 1-night stay spans 1 column and the departure day's column is
 * free for the next arrival (same-day turnover). Null when the stay is outside the range or empty.
 */
export function blockLayout(
  item: { startDate: IsoDate; endDate: IsoDate },
  rangeStart: IsoDate,
  days: ScheduleDays,
): BlockLayout | null {
  const first = daysBetween(rangeStart, item.startDate);
  const end = daysBetween(rangeStart, item.endDate);
  if (Number.isNaN(first) || Number.isNaN(end) || end <= first) return null;
  const column = Math.max(first, 0);
  const stop = Math.min(end, days);
  if (stop <= column) return null;
  return { column, span: stop - column, continuesBefore: first < 0, continuesAfter: end > days };
}

/** Items grouped by room id, each group sorted by start date. */
export function groupByRoom<T extends { roomId: string; startDate: IsoDate }>(
  items: readonly T[],
): Map<string, T[]> {
  const byRoom = new Map<string, T[]>();
  for (const item of items) {
    const list = byRoom.get(item.roomId);
    if (list) list.push(item);
    else byRoom.set(item.roomId, [item]);
  }
  for (const list of byRoom.values()) list.sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  return byRoom;
}

/**
 * Rows to render for a vertical scroll position (virtualization): the visible rows plus `overscan`
 * rows on each side, as a half-open index range [start, end).
 */
export function visibleRowRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  rowCount: number,
  overscan = 5,
): { start: number; end: number } {
  if (rowCount <= 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const first = Math.floor(Math.max(scrollTop, 0) / rowHeight);
  const last = Math.ceil((Math.max(scrollTop, 0) + Math.max(viewportHeight, 0)) / rowHeight);
  return {
    start: Math.min(Math.max(first - overscan, 0), rowCount),
    end: Math.min(Math.max(last + overscan, 0), rowCount),
  };
}

/** True when the data has no rooms, i.e. nothing to draw (the empty state). */
export const isScheduleEmpty = (data: Pick<ScheduleData, 'rooms'>): boolean =>
  data.rooms.length === 0;

// ---- filters (client-side) -----------------------------------------------------------------------
// The product fetches every room and filters here: the drag rules need the sibling rooms of a
// multi-room reservation, which a server-side filter would leave out.

/**
 * The Housekeeping filter group: the settable statuses, with the chip's ids, order and labels
 * (`housekeepingBlocks.ts`). NYCI is not filterable: its chip is drawn invisible and staff cannot set it.
 */
export const HOUSEKEEPING_FILTER_OPTIONS: readonly {
  id: SettableHousekeepingStatus;
  name: string;
}[] = HOUSEKEEPING_OPTIONS.map((o) => ({ id: o.value, name: o.label }));

/** Whether the Locations group is offered: only when the club has two or more locations. */
export const showLocationFilter = (locations: readonly unknown[]): boolean => locations.length >= 2;

export interface ScheduleFilters {
  /** Absent: every location. An empty list ("Select None") matches nothing. */
  locationIds?: readonly string[];
  roomTypeIds?: readonly string[];
  availability?: ScheduleAvailability;
  /**
   * Housekeeping statuses, as the legacy menu: absent or empty is no filter. Otherwise a room stays
   * when one of its reservations in the range shows one of the statuses (`housekeepingStatusOf`, so a
   * stay with no stored status counts as Not Checked Out, as its chip does), and an unassigned
   * reservation stays on the same test. The blocks of a kept room all stay.
   */
  housekeeping?: readonly HousekeepingStatus[];
  /** Room features, as the legacy menu: absent or empty is no filter; otherwise a room needs ALL of them. */
  featureIds?: readonly string[];
}

/**
 * Unassigned reservations under the Housekeeping filter: with no status checked all stay. With one
 * checked they go, because a reservation without a room has no "H" block (`housekeepingStatusOf`),
 * as in the legacy system, where it has no housekeeping event.
 */
export function filterUnassigned(
  unassigned: readonly ScheduleBlock[],
  housekeeping: readonly HousekeepingStatus[],
): ScheduleBlock[] {
  if (housekeeping.length === 0) return [...unassigned];
  return unassigned.filter((b) => {
    const status = housekeepingStatusOf(b);
    return status !== undefined && housekeeping.includes(status);
  });
}

/** The selected ids that still exist in `options` (a stale URL id must neither hide rooms nor count). */
export const knownIds = (
  selected: readonly string[],
  options: readonly { id: string }[],
): string[] => selected.filter((id) => options.some((o) => o.id === id));

/** True when a night of the range has no reservation and no closure on it (`spans`: the room's). */
function hasFreeNight(
  startDate: IsoDate,
  days: number,
  spans: readonly { startDate: IsoDate; endDate: IsoDate }[] | undefined,
): boolean {
  if (!spans || spans.length === 0) return true;
  for (let i = 0; i < days; i++) {
    const night = addDays(startDate, i);
    if (!spans.some((x) => x.startDate <= night && night < x.endDate)) return true;
  }
  return false;
}

/**
 * Keeps the rooms that match the filters, and only their blocks and closures.
 * - Locations and room types: a room must be in a selected location AND a selected room type.
 * - 'booked': at least one reservation overlaps the data's range.
 * - 'available': at least one night of the range is free (no reservation and no closure on it), as
 *   the legacy system does. A room with a closure on every free night is not available.
 * - Housekeeping and features: see `ScheduleFilters`. `unassigned` follows the housekeeping test.
 */
export function applyScheduleFilters(data: ScheduleData, filters: ScheduleFilters): ScheduleData {
  const { startDate, days } = data;
  const end = addDays(startDate, days);
  const locations = filters.locationIds && new Set(filters.locationIds);
  const types = filters.roomTypeIds && new Set(filters.roomTypeIds);
  const availability = filters.availability ?? 'all';
  const statuses = filters.housekeeping?.length ? new Set(filters.housekeeping) : null;
  const features = filters.featureIds?.length ? filters.featureIds : null;

  const booked = new Set<string>();
  const occupied = new Map<string, { startDate: IsoDate; endDate: IsoDate }[]>();
  const withStatus = new Set<string>();
  for (const b of data.blocks) {
    if (!nightsOverlap(b.startDate, b.endDate, startDate, end)) continue;
    booked.add(b.roomId);
    if (statuses) {
      const status = housekeepingStatusOf(b);
      if (status && statuses.has(status)) withStatus.add(b.roomId);
    }
    if (availability === 'available')
      occupied.set(b.roomId, [...(occupied.get(b.roomId) ?? []), b]);
  }
  if (availability === 'available') {
    for (const c of data.closures) {
      if (nightsOverlap(c.startDate, c.endDate, startDate, end)) {
        occupied.set(c.roomId, [...(occupied.get(c.roomId) ?? []), c]);
      }
    }
  }

  const rooms = data.rooms.filter(
    (r) =>
      (!locations || locations.has(r.locationId)) &&
      (!types || types.has(r.roomTypeId)) &&
      (availability === 'all' ||
        (availability === 'booked'
          ? booked.has(r.id)
          : hasFreeNight(startDate, days, occupied.get(r.id)))) &&
      (!statuses || withStatus.has(r.id)) &&
      (!features || features.every((f) => r.featureIds?.includes(f))),
  );
  const ids = new Set(rooms.map((r) => r.id));
  return {
    ...data,
    rooms,
    blocks: data.blocks.filter((b) => ids.has(b.roomId)),
    closures: data.closures.filter((c) => ids.has(c.roomId)),
    unassigned: statuses
      ? filterUnassigned(data.unassigned, filters.housekeeping ?? [])
      : data.unassigned,
  };
}
