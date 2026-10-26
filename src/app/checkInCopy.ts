// The words of the check in flow (ticket 163): prompts, toasts and failure reasons. Pure, so the
// wording is tested apart from the components.
import type { CheckInPastDatePlan } from './checkInDecision';
import type { CheckInLevel } from './permissions';
import { ApiError } from '../api/types';
import type { CheckInFailureCode, CheckInReservationResult } from '../api/types';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** MM/DD/YYYY, as the prompts print the original arrival date. */
export function formatPromptDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

export interface PastDatePrompt {
  title: string;
  message: string;
  /** The first choice: adjust the dates, or split the room when other rooms already checked in or out. */
  firstLabel: string;
  firstKind: 'adjust' | 'split';
  /** The second choice: continue for the original date, behind an override code with the "arrival date" level. */
  continueLabel: string;
  continueKind: 'continue' | 'override';
}

/** The past-date confirmation (legacy "Check In Date has passed"). */
export function pastDatePrompt(plan: CheckInPastDatePlan, level: CheckInLevel): PastDatePrompt {
  const date = formatPromptDate(plan.originalArrival);
  const anyTime = level === 'any-time';
  const message = plan.split
    ? `This reservation has a check-in date of ${date}, and at least one other room on it is already checked in or out. ` +
      (anyTime
        ? 'Check this room in for the original date, or split it from the reservation?'
        : 'Split this room from the reservation, or enter an override code to check in for the original date.')
    : `This reservation has a check-in date of ${date}. ` +
      (anyTime
        ? 'Check in for the original date, or adjust the reservation dates?'
        : 'Adjust the reservation dates, or enter an override code to check in for the original date.');
  return {
    title: `The check-in date of ${date} has passed`,
    message,
    firstLabel: plan.split ? 'Split this room from the reservation' : 'Adjust reservation dates',
    firstKind: plan.split ? 'split' : 'adjust',
    continueLabel: anyTime ? 'Check in for original date' : 'Override and check in',
    continueKind: anyTime ? 'continue' : 'override',
  };
}

export const OVERRIDE_TITLE = 'Enter override code to check in after the check-in date';

/** What the user sees when "split this room" asks for confirmation. */
export function splitConfirmation(input: {
  roomNumber: string | null;
  confirmationNumber: string;
}) {
  const room = input.roomNumber ? `Room ${input.roomNumber}` : 'the unassigned room';
  return {
    title: 'Split room from reservation?',
    message: `Are you sure you want to split ${room} from reservation #${input.confirmationNumber}? It becomes a reservation of its own.`,
    confirmLabel: input.roomNumber
      ? `Yes, split Room ${input.roomNumber}`
      : 'Yes, split the unassigned room',
    keepLabel: 'No, keep rooms together',
  };
}

/** The reason under a failed room in the result dialog (server code to words). */
export function checkInFailureText(code: CheckInFailureCode | string | undefined): string {
  switch (code) {
    case 'unassigned':
      return 'No room assigned.';
    case 'no-payment-method':
      return 'No payment method on file.';
    case 'room-not-ready':
      return 'The room is dirty or not ready.';
    case 'occupied':
      return 'Another reservation is still checked in to the assigned room.';
    case 'not-checkable':
      return 'Not waiting for check in.';
    default:
      return 'Could not be checked in. Try again.';
  }
}

/** The toast after a check in where every room worked. */
export function checkInSuccessMessage(input: {
  reservationRooms: number;
  alreadyCheckedIn: number;
  checkedIn: number;
  roomNumbers: readonly (string | null)[];
}): string {
  const { reservationRooms, alreadyCheckedIn, checkedIn } = input;
  if (reservationRooms === 1) {
    const number = input.roomNumbers[0];
    return number
      ? `You have successfully checked in Room ${number}.`
      : 'You have successfully checked in the room.';
  }
  if (alreadyCheckedIn + checkedIn === reservationRooms) {
    return 'You have successfully checked in all rooms.';
  }
  return `You have successfully checked in ${checkedIn} ${plural(checkedIn, 'room', 'rooms')}.`;
}

export const INTEGRATION_LABELS = { 'key-card': 'Key card', tms: 'TMS' } as const;

/** One line when the check in worked but an integration (key card, TMS) reported an error. */
export function integrationErrorMessage(
  errors: CheckInReservationResult['integrationErrors'],
): string {
  const names = [...new Set(errors.map((e) => INTEGRATION_LABELS[e.kind]))];
  return `Checked in, but the ${names.join(' and ')} integration reported an error. Verify the integration status.`;
}

export function autoCheckOutMessage(
  departure: string,
  /** The rooms checked out when it was only some of them; null for the whole reservation. */
  rooms: readonly (string | null)[] | null = null,
): string {
  const who = rooms
    ? rooms.map((n) => (n ? `Room ${n}` : 'The unassigned room')).join(', ')
    : 'This reservation';
  const many = rooms !== null && rooms.length > 1;
  return `${who} ${many ? 'have' : 'has'} a check-out date of ${formatPromptDate(departure)} and ${many ? 'were' : 'was'} checked out automatically. You may want to run the night audit to make sure the folio balance is accurate before settling.`;
}

export const AUTO_CHECK_OUT_TITLE = 'The check-out date has passed';

export interface CheckInRequestFailure {
  message: string;
  /** The reservation may have changed (or the outcome is unknown): load it again. */
  refetch: boolean;
  /** Go back to the override code step. */
  askOverrideAgain?: boolean;
  /** The request may have been applied (no answer, 408, 5xx): a retry reuses its idempotency key. */
  outcomeUnknown?: boolean;
}

/** What the user is told when the whole check in request fails (a room that fails is a normal answer). */
export function checkInRequestFailure(error: unknown): CheckInRequestFailure {
  const status = error instanceof ApiError ? error.status : 0;
  const code = error instanceof ApiError ? error.code : undefined;
  if (code === 'override-required' || code === 'override-invalid') {
    return {
      message: 'The override code was not accepted. Enter it again to check in.',
      refetch: false,
      askOverrideAgain: true,
    };
  }
  if (code === 'override-locked') {
    return {
      message: 'Too many incorrect override codes. Try again later.',
      refetch: false,
      askOverrideAgain: true,
    };
  }
  if (status === 403) return { message: 'You may not check in this reservation.', refetch: false };
  if (code === 'stale') {
    return {
      message: 'This reservation changed elsewhere. It was reloaded; check in again.',
      refetch: true,
    };
  }
  if (code === 'future-arrival') {
    return { message: 'Check in is only allowed on the arrival date.', refetch: true };
  }
  if (code === 'past-date-unconfirmed') {
    return { message: 'Confirm that you want to check in for a prior date.', refetch: false };
  }
  if (status >= 400 && status < 500 && status !== 408) {
    return { message: 'Could not check in. Try again.', refetch: false };
  }
  return {
    message: 'Could not confirm whether the check in went through. The reservation was reloaded.',
    refetch: true,
    outcomeUnknown: true,
  };
}

/** The note above the button naming the rooms that will be checked out automatically after check in. */
export function checkOutAfterNotice(roomNumbers: readonly (string | null)[], all: boolean): string {
  if (all) {
    return 'The departure date has passed. After check in the reservation is checked out automatically.';
  }
  const names = roomNumbers.map((n) => (n ? `Room ${n}` : 'the unassigned room')).join(', ');
  return `The departure date has passed for ${names}. ${roomNumbers.length === 1 ? 'It is' : 'They are'} checked out automatically after check in.`;
}

/** "3 nights before today will be charged to the folio." */
export const nightsChargedNotice = (nights: number) =>
  `${nights} ${nights === 1 ? 'night' : 'nights'} before today will be charged to the folio.`;
