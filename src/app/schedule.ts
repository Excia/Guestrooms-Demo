// Pure rules for the schedule grid's view: the visible date range, navigation, headers, filtering
// and where a block sits in the columns. Dates are ISO "yyyy-mm-dd" strings; arithmetic goes
// through src/lib/dates.ts so DST never shifts a day.
import { addDays, daysBetween, parseIsoDate, type IsoDate } from '../lib/dates';
import { SCHEDULE_DAYS } from '../api/types';
import type {
  ScheduleData,
  ScheduleDays,
  ScheduleLocation,
  ScheduleRoom,
  ScheduleRoomType,
} from '../api/types';

export { applyScheduleFilters } from '../api/scheduleQuery';
export type { ScheduleFilters } from '../api/scheduleQuery';

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
