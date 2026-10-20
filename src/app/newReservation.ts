// Rules of the New Reservation panel: stay length, form checks, the estimate and the request.
import type { Cents, CreateReservationRequest, Member, ScheduleRoomType } from '../api/types';
import { GUEST_TBD } from '../api/types';
import { daysBetween, isValidIsoDate, type IsoDate } from '../lib/dates';
import { MAX_PARTY } from '../api/validation';

export interface NewReservationForm {
  arrival: IsoDate | '';
  departure: IsoDate | '';
  adults: number;
  children: number;
  role: 'occupant' | 'reserver';
  /** The booking guest; null shows TBD (a valid choice: the guest is not known yet). */
  guest: Member | null;
  /** Only with role 'reserver'; optional, null shows TBD. */
  leadOccupant: Member | null;
  /** "" is Unassigned for all three. */
  locationId: string;
  roomTypeId: string;
  roomId: string;
}

export type NewReservationErrors = Partial<Record<'arrival' | 'departure', string>>;

export const MIN_ADULTS = 1;
export { MAX_PARTY };

export function defaultNewReservation(today: IsoDate, tomorrow: IsoDate): NewReservationForm {
  return {
    arrival: today,
    departure: tomorrow,
    adults: 2,
    children: 0,
    role: 'occupant',
    guest: null,
    leadOccupant: null,
    locationId: '',
    roomTypeId: '',
    roomId: '',
  };
}

/**
 * The form when opened from an empty grid cell: Check In is the clicked date (today when that day
 * has passed, flagged by `pastDate` so the panel can say so) and Check Out is left for the user.
 * The room is applied once the rooms have loaded.
 */
export function prefilledNewReservation(
  today: IsoDate,
  tomorrow: IsoDate,
  prefill: { arrival?: IsoDate } | undefined,
): { form: NewReservationForm; pastDate: boolean } {
  const base = defaultNewReservation(today, tomorrow);
  if (!prefill?.arrival) return { form: base, pastDate: false };
  const pastDate = prefill.arrival < today;
  return {
    form: { ...base, arrival: pastDate ? today : prefill.arrival, departure: '' },
    pastDate,
  };
}

/** Nights of the stay, or null while the dates are incomplete or not in order. */
export function stayNights(arrival: string, departure: string): number | null {
  if (!isValidIsoDate(arrival) || !isValidIsoDate(departure) || arrival >= departure) return null;
  return daysBetween(arrival, departure);
}

/** The booking guest, the lead occupant and the room are all optional (TBD, Unassigned). */
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
  const lead = form.role === 'reserver' ? form.leadOccupant : null;
  return {
    requestId,
    roomId: form.roomId === '' ? null : form.roomId,
    arrival: form.arrival,
    departure: form.departure,
    adults: form.adults,
    children: form.children,
    guestName: form.guest?.name ?? GUEST_TBD,
    ...(form.guest ? { bookingGuestId: form.guest.id } : {}),
    bookingGuestRole: form.role,
    ...(lead ? { leadOccupant: { name: lead.name, memberId: lead.id } } : {}),
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
