import { formatTimeValue, parseTime } from './systemSettings';

/** Pure rules of the clock-style time picker (hands, snapping, typed input). Times are `HH:mm`. */

export const MINUTES_PER_DAY = 24 * 60;

export interface ClockParts {
  /** 1 to 12. */
  hour: number;
  minute: number;
  pm: boolean;
}

export function toClockParts(totalMinutes: number): ClockParts {
  const h = Math.floor(totalMinutes / 60) % 24;
  return { hour: h % 12 === 0 ? 12 : h % 12, minute: totalMinutes % 60, pm: h >= 12 };
}

export function fromClockParts({ hour, minute, pm }: ClockParts): number {
  return ((hour % 12) + (pm ? 12 : 0)) * 60 + minute;
}

/** "16:05" becomes "04:05 PM" (the typed format hh:mm AM/PM). Empty or invalid input gives ''. */
export function formatFieldTime(value: string): string {
  const total = parseTime(value);
  if (total === null) return '';
  const { hour, minute, pm } = toClockParts(total);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`;
}

/**
 * Typed text to `HH:mm`: "4:05 pm", "04:05PM", "4 PM", "16:05". Returns null when it is not a
 * time. Whether it is on the 5-minute step is the form validation's job, not the parser's.
 */
export function parseTypedTime(text: string): string | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?m?\.?\s*$/i.exec(text);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = m[2] === undefined ? 0 : Number(m[2]);
  if (minutes > 59) return null;
  if (m[3]) {
    if (hours < 1 || hours > 12) return null;
    return formatTimeValue(fromClockParts({ hour: hours, minute: minutes, pm: /p/i.test(m[3]) }));
  }
  if (m[2] === undefined || hours > 23) return null;
  return formatTimeValue(hours * 60 + minutes);
}

/** Clockwise angle in degrees (0 = 12 o'clock, 0 to 360) of a point relative to the dial centre. */
export function pointAngle(dx: number, dy: number): number {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export const hourAtAngle = (angle: number): number => {
  const h = Math.round(angle / 30) % 12;
  return h === 0 ? 12 : h;
};

export const minuteAtAngle = (angle: number, step: number): number =>
  (Math.round(angle / 6 / step) * step) % 60;

export const hourAngle = (hour: number): number => (hour % 12) * 30;
export const minuteAngle = (minute: number): number => minute * 6;

/** Position on the dial for an angle and radius, around (centre, centre). */
export function dialPoint(angle: number, radius: number, centre: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: centre + radius * Math.sin(rad), y: centre - radius * Math.cos(rad) };
}

export type IsAllowed = (totalMinutes: number) => boolean;

/** Nearest allowed time on the step grid to `target` (circular over the day); null when none. */
export function nearestAllowed(target: number, step: number, isAllowed: IsAllowed): number | null {
  for (let d = 0; d <= MINUTES_PER_DAY / 2; d += step) {
    for (const t of [target + d, target - d]) {
      const wrapped =
        (((Math.round(t / step) * step) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
      if (isAllowed(wrapped)) return wrapped;
    }
  }
  return null;
}

export const hourHasAllowed = (hour: number, pm: boolean, step: number, isAllowed: IsAllowed) => {
  for (let minute = 0; minute < 60; minute += step) {
    if (isAllowed(fromClockParts({ hour, minute, pm }))) return true;
  }
  return false;
};

export const halfDayHasAllowed = (pm: boolean, step: number, isAllowed: IsAllowed) =>
  Array.from({ length: 12 }, (_, i) => i + 1).some((h) => hourHasAllowed(h, pm, step, isAllowed));

/** Next hour (1 to 12, wrapping) in a direction that has an allowed time; null when none. */
export function stepHour(
  parts: ClockParts,
  direction: 1 | -1,
  step: number,
  isAllowed: IsAllowed,
): number | null {
  for (let i = 1; i <= 12; i += 1) {
    const hour = ((parts.hour - 1 + direction * i + 120) % 12) + 1;
    if (hourHasAllowed(hour, parts.pm, step, isAllowed)) return hour;
  }
  return null;
}

/** Next minute on the step grid (wrapping) in a direction that is allowed; null when none. */
export function stepMinute(
  parts: ClockParts,
  direction: 1 | -1,
  step: number,
  isAllowed: IsAllowed,
): number | null {
  const slots = 60 / step;
  for (let i = 1; i <= slots; i += 1) {
    const minute = ((((parts.minute / step + direction * i) % slots) + slots) % slots) * step;
    if (isAllowed(fromClockParts({ ...parts, minute }))) return minute;
  }
  return null;
}
