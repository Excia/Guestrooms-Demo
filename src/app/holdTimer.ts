// Reservation hold timer for the New Reservation panel. The hold length is the "Reservation Hold"
// setting of Booking Rules (ticket 7.5, minutes per audience). Pure: the caller supplies the clock
// (`now` in epoch milliseconds), so tests need no real time.
import type { BookingHold } from '../api/types';

export type HoldAudience = 'employee' | 'member' | 'nonMember';

/**
 * Staff create reservations in the admin UI, so the hold is the employee one. (Figma's panel has
 * no audience choice; the member and non-member values belong to online booking.)
 */
export const ADMIN_HOLD_AUDIENCE: HoldAudience = 'employee';

export const holdMinutes = (hold: BookingHold, audience: HoldAudience): number => hold[audience];

/** Under this the timer warns (and is announced once). */
export const HOLD_WARNING_MS = 60_000;

export type HoldPhase = 'running' | 'warning' | 'expired';

export interface HoldStatus {
  phase: HoldPhase;
  /** Whole milliseconds left, never negative. */
  remainingMs: number;
}

export function holdStatus(startedAt: number, minutes: number, now: number): HoldStatus {
  const remainingMs = Math.max(startedAt + minutes * 60_000 - now, 0);
  const phase: HoldPhase =
    remainingMs === 0 ? 'expired' : remainingMs < HOLD_WARNING_MS ? 'warning' : 'running';
  return { phase, remainingMs };
}

/** "09:42": minutes and seconds, rounded up so "00:00" only shows at expiry. */
export function formatHold(remainingMs: number): string {
  const total = Math.ceil(Math.max(remainingMs, 0) / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Spoken form for the polite announcements ("1 minute", "30 seconds"). */
export function describeHold(remainingMs: number): string {
  const seconds = Math.ceil(Math.max(remainingMs, 0) / 1000);
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}

/**
 * Pausing (the New Room Closure tab is shown): the time spent paused does not count. The new start
 * is the old one moved forward by the pause, so the remaining time after resuming is exactly what
 * it was when the pause began.
 */
export const startAfterPause = (startedAt: number, pausedAt: number, resumedAt: number): number =>
  startedAt + Math.max(resumedAt - pausedAt, 0);
