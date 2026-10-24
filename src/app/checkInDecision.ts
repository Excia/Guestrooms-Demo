// Check in on past dates (ticket 163): the one rule that says what happens when staff start a check
// in. Pure. The reservation panel uses it now; the Reservation Hub (ticket 3.12) will call the same
// function so both places behave alike.
//
// What "past" means: today, on the club's clock, is after the arrival date. The business date and
// the last night audit are not used.
import { daysBetween, type IsoDate } from '../lib/dates';
import { departurePassed, type ClubClock } from '../lib/clubTime';
import type { CheckInLevel } from './permissions';

export type CheckInRoomStatus = 'nyci' | 'checked-in' | 'checked-out';

/** What the rule needs to know about one room of the reservation. */
export interface CheckInRoomFacts {
  /** The reservation-room id. */
  id: string;
  status: CheckInRoomStatus;
  /** A room is assigned (otherwise the room is "Unassigned" and must be assigned first). */
  assigned: boolean;
  /** The assigned room is dirty or not ready: it cannot be checked in. */
  dirty: boolean;
  arrival: IsoDate;
  /** Departure, exclusive. */
  departure: IsoDate;
}

export interface CheckInInput {
  /** Every room of the reservation. */
  rooms: readonly CheckInRoomFacts[];
  /** The rooms the user started with: one room, or every room still waiting. */
  targetIds: readonly string[];
  /** The club's check-out time, `HH:mm`. */
  checkOutTime: string;
  /** Now on the club's clock (its time zone), never the browser's. */
  clock: ClubClock;
  level: CheckInLevel;
  /** A payment method is on file (decision D-008). Not a gate here: it is asked for at completion. */
  paymentOnFile: boolean;
}

export type CheckInDisabledReason =
  | 'no-permission'
  | 'future-arrival'
  | 'room-not-ready'
  | 'nothing-to-check-in';

/** Fields every non-disabled answer carries. */
export interface CheckInPlan {
  /** The rooms that can be checked in right now (assigned, ready, still waiting). */
  checkableIds: string[];
  /** Waiting rooms with no room assigned: the panel offers "Assign now". */
  unassignedIds: string[];
  /** Waiting rooms that are dirty or not ready: listed, not selectable. */
  notReadyIds: string[];
  /** The earliest arrival among the target rooms (the date the prompt names). */
  originalArrival: IsoDate;
  /** The departure date and time have passed: check in, then check out automatically. */
  thenCheckOut: boolean;
  /** No payment method on file: the Payment Methods dialog opens before the check in completes. */
  paymentRequired: boolean;
}

export interface CheckInPastDatePlan extends CheckInPlan {
  /**
   * At least one other room of the reservation is already checked in or out: "adjust the dates" is
   * replaced by "split this room from the reservation".
   */
  split: boolean;
}

export type CheckInDecision =
  | { kind: 'disabled'; reason: CheckInDisabledReason; message: string }
  /** Arrival is today: open the check in panel. */
  | ({ kind: 'allowed' } & CheckInPlan)
  /** Past arrival, permission "any time": ask first (adjust / split, or check in for the original date). */
  | ({ kind: 'needsPastDateConfirmation' } & CheckInPastDatePlan)
  /** Past arrival, permission "arrival date only": the same prompt, but continuing needs an override code. */
  | ({ kind: 'needsOverride' } & CheckInPastDatePlan)
  /** Arrival is not past but the departure already is (a same-day stay): check in then out. */
  | ({ kind: 'checkInThenOut' } & CheckInPlan);

export const DISABLED_MESSAGES: Record<CheckInDisabledReason, string> = {
  'no-permission': 'You do not have permission to check in.',
  'future-arrival': 'Check in is only allowed on the arrival date.',
  'room-not-ready': 'This room is dirty or not ready, so it cannot be checked in.',
  'nothing-to-check-in': 'There is no room waiting for check in.',
};

const disabled = (reason: CheckInDisabledReason): CheckInDecision => ({
  kind: 'disabled',
  reason,
  message: DISABLED_MESSAGES[reason],
});

/** The earliest arrival and the latest departure of the rooms with these ids. */
function stayOf(rooms: readonly CheckInRoomFacts[]): { arrival: IsoDate; departure: IsoDate } {
  return {
    arrival: rooms.reduce((min, r) => (r.arrival < min ? r.arrival : min), rooms[0].arrival),
    departure: rooms.reduce((max, r) => (r.departure > max ? r.departure : max), rooms[0].departure),
  };
}

/**
 * Decides what starting a check in does.
 * - Never: disabled. An arrival still in the future: disabled (check in is only allowed on the
 *   arrival date, whichever level the user holds; the owner may relax this for "any time", Q-163-3).
 * - Every waiting target room is dirty or not ready: disabled. A mix is fine: the dirty ones are
 *   listed but cannot be selected. Unassigned rooms do not disable the start: the panel shows "Assign now".
 * - Arrival in the past: a confirmation first (`needsPastDateConfirmation`), or with only the
 *   "arrival date" level the same prompt that asks for an override code (`needsOverride`).
 * - Otherwise `allowed`, or `checkInThenOut` when the departure has passed too.
 */
export function decideCheckIn(input: CheckInInput): CheckInDecision {
  const { rooms, clock, level } = input;
  const targets = rooms.filter((r) => input.targetIds.includes(r.id) && r.status === 'nyci');
  if (targets.length === 0) return disabled('nothing-to-check-in');
  if (level === 'never') return disabled('no-permission');
  const stay = stayOf(targets);
  if (stay.arrival > clock.date) return disabled('future-arrival');

  const unassignedIds = targets.filter((r) => !r.assigned).map((r) => r.id);
  const notReadyIds = targets.filter((r) => r.assigned && r.dirty).map((r) => r.id);
  const checkableIds = targets.filter((r) => r.assigned && !r.dirty).map((r) => r.id);
  if (checkableIds.length === 0 && unassignedIds.length === 0) return disabled('room-not-ready');

  const plan: CheckInPlan = {
    checkableIds,
    unassignedIds,
    notReadyIds,
    originalArrival: stay.arrival,
    thenCheckOut: departurePassed(stay.departure, input.checkOutTime, clock),
    paymentRequired: !input.paymentOnFile,
  };
  if (stay.arrival < clock.date) {
    const split = rooms.some(
      (r) => !input.targetIds.includes(r.id) && (r.status === 'checked-in' || r.status === 'checked-out'),
    );
    return { kind: level === 'any-time' ? 'needsPastDateConfirmation' : 'needsOverride', split, ...plan };
  }
  return { kind: plan.thenCheckOut ? 'checkInThenOut' : 'allowed', ...plan };
}

/** True for the answers that open the check in panel (directly, or after the past-date prompt). */
export const startsCheckIn = (
  d: CheckInDecision,
): d is Exclude<CheckInDecision, { kind: 'disabled' }> => d.kind !== 'disabled';

/** True when the past-date prompt comes first. */
export const needsPastDatePrompt = (
  d: CheckInDecision,
): d is Extract<CheckInDecision, { kind: 'needsPastDateConfirmation' | 'needsOverride' }> =>
  d.kind === 'needsPastDateConfirmation' || d.kind === 'needsOverride';

/** Checking a room out right after check in follows the same level: "never" cannot do it. */
export const canAutoCheckOut = (level: CheckInLevel) => level !== 'never';

/** The check in panel's button: "Complete check in" for a one-room reservation, else "Check in N rooms". */
export function checkInCtaLabel(reservationRooms: number, selected: number): string {
  if (reservationRooms === 1) return 'Complete check in';
  return `Check in ${selected} ${selected === 1 ? 'room' : 'rooms'}`;
}

/** The notice above the button when the arrival date has passed. */
export const PRIOR_DATE_NOTICE =
  'The check-in date for this reservation has passed. Confirm that you want to check in for a prior date.';

export const CHECK_OUT_AFTER_NOTICE =
  'The departure date has passed. After check in the reservation is checked out automatically.';

/** The number of nights charged to the folio by a past check in: the nights before today. */
export function nightsBeforeToday(
  arrival: IsoDate,
  departure: IsoDate,
  today: IsoDate,
): number {
  const end = departure < today ? departure : today;
  if (end <= arrival) return 0;
  return daysBetween(arrival, end);
}
