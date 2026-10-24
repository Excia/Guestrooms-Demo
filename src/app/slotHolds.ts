// Slot holds (ticket 152, Q-19-3): while a New Reservation is in progress its room and nights are
// held, and the grid shades them. Pure rules; the caller supplies the clock (`now`, epoch ms).
// PLACEHOLDER: the real backend owns holds and their expiry; these rules only mirror them so the UI
// can hide a hold the moment it ends and the mock can behave like a server.
import type { IsoDate } from '../lib/dates';
import { nightsOverlap } from '../lib/dates';
import { clubClock } from '../lib/clubTime';
import type { ScheduleHold } from '../api/types';

type Dated = { roomId: string; startDate: IsoDate; endDate: IsoDate };

/** The instant a hold started `startedAt` ends, for `minutes` of hold (ISO 8601, UTC). */
export const holdExpiry = (startedAt: number, minutes: number): string =>
  new Date(startedAt + minutes * 60_000).toISOString();

/** A hold is live until the instant of its expiry. An unreadable instant counts as ended. */
export function isHoldLive(hold: Pick<ScheduleHold, 'expiresAt'>, now: number): boolean {
  const ends = Date.parse(hold.expiresAt);
  return Number.isFinite(ends) && ends > now;
}

export const liveHolds = (
  holds: readonly ScheduleHold[] | undefined,
  now: number,
): ScheduleHold[] => (holds ?? []).filter((h) => isHoldLive(h, now));

/** Milliseconds until the first live hold ends, or null when none is live. Drives the redraw timer. */
export function nextHoldExpiry(
  holds: readonly ScheduleHold[] | undefined,
  now: number,
): number | null {
  const ends = liveHolds(holds, now).map((h) => Date.parse(h.expiresAt) - now);
  return ends.length ? Math.min(...ends) : null;
}

/** The holds the signed-in user placed (the server marks them). */
export const ownHolds = (holds: readonly ScheduleHold[] | undefined): ScheduleHold[] =>
  (holds ?? []).filter((h) => h.mine);

/** Holds that are not the open panel's own: other users', and the user's own from another window. */
export const otherHolds = (
  holds: readonly ScheduleHold[] | undefined,
  panelHoldId: string | null | undefined,
): ScheduleHold[] => (holds ?? []).filter((h) => h.id !== panelHoldId);

/**
 * Only the New Reservation panel that placed a hold interacts with it. Everything else on the grid
 * (other users' holds, the user's own holds from elsewhere) is shaded and inert.
 */
export const canInteractWithHold = (
  hold: Pick<ScheduleHold, 'id'>,
  panelHoldId: string | null | undefined,
): boolean => panelHoldId != null && hold.id === panelHoldId;

/**
 * The live hold of someone else that overlaps the slot, if any. The caller's own holds (`mine`) never
 * clash: the server moves or replaces them (a refresh, a second tab or an orphan can leave one under
 * another id). `ownHoldId` is kept for callers that know the panel's hold before the server marks it.
 */
export function heldByOther(
  slot: Dated,
  holds: readonly ScheduleHold[] | undefined,
  ownHoldId: string | null | undefined,
  now: number,
): ScheduleHold | undefined {
  return liveHolds(holds, now).find(
    (h) =>
      !h.mine &&
      h.id !== ownHoldId &&
      h.roomId === slot.roomId &&
      nightsOverlap(h.startDate, h.endDate, slot.startDate, slot.endDate),
  );
}

export type SlotConflict =
  { kind: 'booked' } | { kind: 'closed' } | { kind: 'held'; hold: ScheduleHold };

/** Why a slot cannot be held: booked, closed, or held by another (in that order), else null. */
export function slotConflict(
  slot: Dated,
  state: {
    blocks: readonly Dated[];
    closures: readonly Dated[];
    holds: readonly ScheduleHold[];
  },
  ownHoldId: string | null | undefined,
  now: number,
): SlotConflict | null {
  const hits = (x: Dated) =>
    x.roomId === slot.roomId && nightsOverlap(x.startDate, x.endDate, slot.startDate, slot.endDate);
  if (state.blocks.some(hits)) return { kind: 'booked' };
  if (state.closures.some(hits)) return { kind: 'closed' };
  const hold = heldByOther(slot, state.holds, ownHoldId, now);
  return hold ? { kind: 'held', hold } : null;
}

/** A slot worth holding: a room and at least one night. */
export function holdableSlot(slot: {
  roomId: string;
  startDate: string;
  endDate: string;
}): boolean {
  return slot.roomId !== '' && slot.startDate !== '' && slot.startDate < slot.endDate;
}

/** "14:30" (24 hour) on the club's clock; the browser's until the club's time zone is known. */
export function formatHoldTime(expiresAt: string, timeZone?: string): string {
  const d = new Date(expiresAt);
  return Number.isNaN(d.getTime()) ? '' : clubClock(timeZone, d).time;
}

/** Tooltip of a hold block (the Figma-less wording the ticket asks for). */
export const holdTipText = (hold: Pick<ScheduleHold, 'expiresAt'>, timeZone?: string): string =>
  `Held until ${formatHoldTime(hold.expiresAt, timeZone)}`;

/** Accessible name of a hold block; the meaning is in the text, not the shading. */
export function holdAriaLabel(
  hold: Pick<ScheduleHold, 'expiresAt'>,
  roomNumber: string | undefined,
  dates: { from: string; to: string },
  own: boolean,
  timeZone?: string,
): string {
  const until = holdTipText(hold, timeZone);
  const room = roomNumber ? `, Room ${roomNumber}` : '';
  return `${own ? `Your hold, ${until.toLowerCase()}` : until}${room}, ${dates.from} to ${dates.to}`;
}

/** Message on the Room field when the chosen slot clashes with another user's hold. */
export const heldMessage = (hold: Pick<ScheduleHold, 'expiresAt'>, timeZone?: string): string =>
  `That room is held by another user until ${formatHoldTime(hold.expiresAt, timeZone)}.`;
