// Rules of the New Reservation panel: stay length, form checks, the estimate and the request.
import type { Cents, CreateReservationRequest, ScheduleRoomType } from '../api/types';
import { daysBetween, isValidIsoDate, type IsoDate } from '../lib/dates';
import { MAX_PARTY } from '../api/validation';

export interface NewReservationForm {
  arrival: IsoDate | '';
  departure: IsoDate | '';
  adults: number;
  children: number;
  role: 'occupant' | 'reserver';
  guestName: string;
  roomId: string;
}

export type NewReservationErrors = Partial<
  Record<'arrival' | 'departure' | 'guestName' | 'roomId', string>
>;

export const MIN_ADULTS = 1;
export { MAX_PARTY };

export function defaultNewReservation(today: IsoDate, tomorrow: IsoDate): NewReservationForm {
  return {
    arrival: today,
    departure: tomorrow,
    adults: 2,
    children: 0,
    role: 'occupant',
    guestName: '',
    roomId: '',
  };
}

/** Nights of the stay, or null while the dates are incomplete or not in order. */
export function stayNights(arrival: string, departure: string): number | null {
  if (!isValidIsoDate(arrival) || !isValidIsoDate(departure) || arrival >= departure) return null;
  return daysBetween(arrival, departure);
}

export function validateNewReservation(
  form: NewReservationForm,
  today: IsoDate,
): NewReservationErrors {
  const errors: NewReservationErrors = {};
  if (!isValidIsoDate(form.arrival)) errors.arrival = 'Enter a check-in date.';
  else if (form.arrival < today) errors.arrival = 'Check-in cannot be in the past.';
  if (!isValidIsoDate(form.departure)) errors.departure = 'Enter a check-out date.';
  else if (isValidIsoDate(form.arrival) && form.departure <= form.arrival) {
    errors.departure = 'Check-out must be after check-in.';
  }
  if (form.guestName.trim() === '') errors.guestName = 'Choose or enter the booking guest.';
  if (form.roomId === '') errors.roomId = 'Choose a room.';
  return errors;
}

/** Nights times the room type's nightly rate (excluding taxes and service charges); null if unknown. */
export function estimateTotal(
  nights: number | null,
  roomType: Pick<ScheduleRoomType, 'nightlyRate'> | undefined,
): Cents | null {
  if (nights === null || roomType?.nightlyRate === undefined) return null;
  return nights * roomType.nightlyRate;
}

export function toCreateRequest(
  form: NewReservationForm,
  requestId: string,
): CreateReservationRequest {
  return {
    requestId,
    roomId: form.roomId,
    arrival: form.arrival,
    departure: form.departure,
    adults: form.adults,
    children: form.children,
    guestName: form.guestName.trim(),
    bookingGuestRole: form.role,
  };
}

/** Stepper value shown as two digits ("02"). */
export const padCount = (n: number) => String(n).padStart(2, '0');

/** Figma shows dates as MM/DD/YYYY. */
export function formatPanelDate(iso: IsoDate): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${m}/${d}/${y}` : iso;
}

/**
 * Message for a failed create. 409 `conflict` and `idempotency-conflict` and 400 are explained;
 * status 0 and 5xx are an unknown outcome (the reservation may exist): the caller reloads.
 */
export function createFailure(
  status: number,
  code?: string,
): { message: string; unknown: boolean } {
  if (code === 'conflict') {
    return { message: 'That room is booked or closed on those dates.', unknown: false };
  }
  if (status >= 400 && status < 500 && status !== 408) {
    return {
      message: 'The reservation could not be created. Check the details and try again.',
      unknown: false,
    };
  }
  return {
    message: 'The result could not be confirmed. Check the schedule before trying again.',
    unknown: true,
  };
}
