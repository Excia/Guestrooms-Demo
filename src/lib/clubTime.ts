// The club's own clock (its IANA time zone from System Settings), not the browser's. Neutral
// helpers shared by api/ and app/. A day boundary or a check-out time is always read on this clock.
import { pad, type IsoDate } from './dates';

export interface ClubClock {
  /** The club's calendar date. */
  date: IsoDate;
  /** 24-hour `HH:mm`. */
  time: string;
}

/** The date and time of `now` in `timeZone`; an unknown zone falls back to the browser's. */
export function clubClock(timeZone: string | undefined, now: Date = new Date()): ClubClock {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    // Some engines print midnight as "24".
    const hour = get('hour') === '24' ? '00' : get('hour');
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` };
  } catch {
    return {
      date: `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    };
  }
}

/**
 * True once the club clock is past the departure day's check-out time. At exactly the check-out
 * time the guest may still be leaving, so only a later minute counts.
 */
export function departurePassed(
  departure: IsoDate,
  checkOutTime: string,
  clock: Pick<ClubClock, 'date' | 'time'>,
): boolean {
  if (clock.date !== departure) return clock.date > departure;
  return clock.time > checkOutTime;
}

/** "10/24/2026 2:05 PM" for an instant, on the club's clock. Empty for an unreadable value. */
export function formatClubDateTime(instant: string, timeZone: string | undefined): string {
  const at = new Date(instant);
  if (Number.isNaN(at.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
    })
      .format(at)
      .replace(',', '');
  } catch {
    return at.toISOString();
  }
}
