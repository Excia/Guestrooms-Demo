// Pure rules for picking a date range on one calendar (New Reservation Check In / Check Out and the
// custom range of Date Selection). Dates are ISO "yyyy-mm-dd" strings; "" means not chosen yet.
import { addDays, daysBetween, type IsoDate } from './dateSelection';

export interface RangeValue {
  from: IsoDate | '';
  to: IsoDate | '';
}

export interface RangeLimits {
  /** Earliest selectable day (inclusive). */
  min?: IsoDate;
  /** Latest selectable start day (inclusive). */
  maxStart?: IsoDate;
  /** Fewest nights between from and to; 1 means a check-out must be after the check-in. */
  minNights: number;
  /** Most nights between from and to. */
  maxNights?: number;
}

/** True while the first date is chosen and the second is awaited. */
export const isPending = (r: RangeValue) => r.from !== '' && r.to === '';

/**
 * Result of clicking `clicked`: the first click sets `from`; the second sets `to` when it is on or
 * after the minimum stay; a click before `from` restarts with that date; a click on a complete
 * range deselects it and starts fresh with `clicked` as `from`.
 */
export function nextRangeSelection(
  current: RangeValue,
  clicked: IsoDate,
  limits: RangeLimits,
): RangeValue {
  if (isPending(current)) {
    const nights = daysBetween(current.from, clicked);
    if (nights >= limits.minNights && nights >= 0) return { from: current.from, to: clicked };
  }
  return { from: clicked, to: '' };
}

/** Whether `day` cannot be clicked given the range so far. */
export function isRangeDayDisabled(
  day: IsoDate,
  current: RangeValue,
  limits: RangeLimits,
): boolean {
  if (limits.min && day < limits.min) return true;
  if (!isPending(current)) return Boolean(limits.maxStart && day > limits.maxStart);
  // Waiting for the second date: earlier days restart (as a new start), later ones must fit the stay.
  if (day <= current.from) return Boolean(limits.maxStart && day > limits.maxStart);
  const nights = daysBetween(current.from, day);
  return nights < limits.minNights || (limits.maxNights !== undefined && nights > limits.maxNights);
}

/** Limits for New Reservation: from today, up to `advanceDays` ahead, 1..`maxNights` nights. */
export function stayLimits(today: IsoDate, advanceDays: number, maxNights: number): RangeLimits {
  return { min: today, maxStart: addDays(today, advanceDays), minNights: 1, maxNights };
}

/** The outer bounds of every selectable day, for the calendar's month navigation. */
export function rangeBounds(limits: RangeLimits): { min?: IsoDate; max?: IsoDate } {
  return {
    min: limits.min,
    max:
      limits.maxStart === undefined ? undefined : addDays(limits.maxStart, limits.maxNights ?? 0),
  };
}

/**
 * Days shown as inside the range: strictly between the ends. While the second date is pending, the
 * hovered or focused day previews the range when it would be a valid second date.
 */
export function rangeShade(
  day: IsoDate,
  current: RangeValue,
  preview: IsoDate | null,
): 'start' | 'end' | 'between' | null {
  if (current.from && day === current.from) return 'start';
  if (current.to && day === current.to) return 'end';
  const end = current.to || (preview && preview > current.from ? preview : '');
  if (current.from && end && day > current.from && day < end) return 'between';
  if (!current.to && current.from && end && day === end) return 'end';
  return null;
}
