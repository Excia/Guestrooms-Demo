// Rules of "Add Another Room" (ticket 151; Figma 16593:31892): which rooms are free for the whole
// stay, the form checks and the request. The dates are the reservation's and are never edited.
// Pure, no React.
import type {
  AddRoomRequest,
  Member,
  ReservationDetail,
  ScheduleBlock,
  ScheduleClosure,
  ScheduleHold,
  ScheduleRoom,
  ScheduleRoomType,
} from '../api/types';
import { ApiError } from '../api/types';
import { MAX_PARTY } from '../api/validation';
import { nightsOverlap, type IsoDate } from '../lib/dates';
import { estimateTotal, stayNights } from './newReservation';
import { heldByOther } from './slotHolds';
import { addRoomVisible } from './reservationMenu';

export interface AddRoomForm {
  adults: number;
  children: number;
  /** The new room's lead occupant; null shows TBD (a valid choice). */
  leadOccupant: Member | null;
  /** "" is Unassigned for all three (see roomCascade.ts). */
  locationId: string;
  roomTypeId: string;
  roomId: string;
  autoLocation: boolean;
  autoRoomType: boolean;
}

export const defaultAddRoomForm = (): AddRoomForm => ({
  adults: 2,
  children: 0,
  leadOccupant: null,
  locationId: '',
  roomTypeId: '',
  roomId: '',
  autoLocation: false,
  autoRoomType: false,
});

/**
 * True when no booking, no closure and no other user's live hold touches the room on any night of
 * [arrival, departure). Holds are the schedule's (ticket 152, D-152-4): the caller's own (`mine`) never
 * block, and one whose `expiresAt` has passed at `now` (epoch ms) does not either. The
 * reservation's own rooms count too (the same room cannot be added twice); a stay that ends on the
 * arrival day, or starts on the departure day, does not block (same-day turnover).
 */
export function isRoomFreeForStay(
  roomId: string,
  blocks: readonly Pick<ScheduleBlock, 'roomId' | 'startDate' | 'endDate'>[],
  closures: readonly Pick<ScheduleClosure, 'roomId' | 'startDate' | 'endDate'>[],
  arrival: IsoDate,
  departure: IsoDate,
  holds: readonly ScheduleHold[] = [],
  now: number = Date.now(),
): boolean {
  const hits = (x: { roomId: string; startDate: IsoDate; endDate: IsoDate }) =>
    x.roomId === roomId && nightsOverlap(x.startDate, x.endDate, arrival, departure);
  return (
    !blocks.some(hits) &&
    !closures.some(hits) &&
    heldByOther({ roomId, startDate: arrival, endDate: departure }, holds, null, now) === undefined
  );
}

/** The rooms that are free for every night of the stay, in the order given. */
export function roomsFreeForStay(
  rooms: readonly ScheduleRoom[],
  blocks: readonly ScheduleBlock[],
  closures: readonly ScheduleClosure[],
  arrival: IsoDate,
  departure: IsoDate,
  holds: readonly ScheduleHold[] = [],
  now: number = Date.now(),
): ScheduleRoom[] {
  return rooms.filter((r) =>
    isRoomFreeForStay(r.id, blocks, closures, arrival, departure, holds, now),
  );
}

export type AddRoomErrors = Partial<Record<'adults' | 'children' | 'room', string>>;

/** The room is optional (Unassigned is allowed); the party must be at least one adult. */
export function validateAddRoom(
  form: Pick<AddRoomForm, 'adults' | 'children' | 'roomId'>,
  freeRoomIds: ReadonlySet<string>,
): AddRoomErrors {
  const errors: AddRoomErrors = {};
  if (!Number.isInteger(form.adults) || form.adults < 1) errors.adults = 'At least one adult.';
  else if (form.adults > MAX_PARTY) errors.adults = `At most ${MAX_PARTY} adults.`;
  if (!Number.isInteger(form.children) || form.children < 0 || form.children > MAX_PARTY) {
    errors.children = `Enter 0 to ${MAX_PARTY} children.`;
  }
  if (form.roomId !== '' && !freeRoomIds.has(form.roomId)) {
    errors.room = 'That room is booked or closed during this stay.';
  }
  return errors;
}

export function toAddRoomRequest(
  form: AddRoomForm,
  reservation: Pick<ReservationDetail, 'id' | 'version'>,
  requestId: string,
): AddRoomRequest {
  return {
    requestId,
    reservationId: reservation.id,
    version: reservation.version,
    roomId: form.roomId === '' ? null : form.roomId,
    adults: form.adults,
    children: form.children,
    ...(form.leadOccupant
      ? { leadOccupant: { name: form.leadOccupant.name, memberId: form.leadOccupant.id } }
      : {}),
  };
}

/** Estimate of the added room for the whole stay (excluding taxes and service charges). */
export function addRoomEstimate(
  reservation: Pick<ReservationDetail, 'arrival' | 'departure'>,
  roomType: Pick<ScheduleRoomType, 'nightlyRate'> | undefined,
) {
  return estimateTotal(stayNights(reservation.arrival, reservation.departure), roomType);
}

/**
 * Why the Add Another Room panel cannot be used, else null (the menu already hides the item). No
 * permission check: legacy has none (D-LM-5, Q-LM-2), so a link to the panel works for anyone who
 * can see the reservation.
 */
export function addRoomBlocker(
  detail: Pick<ReservationDetail, 'status' | 'rooms' | 'folioCharges'>,
): string | null {
  if (!addRoomVisible(detail)) {
    return 'A room can no longer be added to this reservation (it is cancelled, checked out, or the night audit has run).';
  }
  return null;
}

export interface AddRoomFailure {
  message: string;
  /** The room field shows the message too. */
  roomError?: boolean;
  /** The reservation changed, or the outcome is unknown: load it (and the schedule) again. */
  refetch: boolean;
  /** The request may have been applied (no answer, 408, 5xx): a retry reuses its idempotency key. */
  outcomeUnknown?: boolean;
}

export const addRoomSuccessMessage = (confirmationNumber: string) =>
  `Room added to reservation #${confirmationNumber}.`;

export function addRoomFailure(error: unknown): AddRoomFailure {
  const status = error instanceof ApiError ? error.status : 0;
  const code = error instanceof ApiError ? error.code : undefined;
  if (status === 403) {
    return { message: 'You may not change this reservation.', refetch: false };
  }
  if (code === 'held') {
    return {
      message: 'That room is held by another user during this stay. Choose another room.',
      roomError: true,
      refetch: true,
    };
  }
  if (code === 'conflict') {
    return {
      message: 'That room is booked or closed during this stay. Choose another room.',
      roomError: true,
      refetch: true,
    };
  }
  if (code === 'stale') {
    return {
      message: 'This reservation changed elsewhere. It was reloaded; try again.',
      refetch: true,
    };
  }
  if (code === 'not-editable') {
    return {
      message: 'A room can no longer be added to this reservation. It was reloaded.',
      refetch: true,
    };
  }
  if (status === 404) {
    return { message: 'The reservation or the room could not be found.', refetch: true };
  }
  if (status >= 400 && status < 500 && status !== 408) {
    return {
      message: 'The room could not be added. Check the details and try again.',
      refetch: false,
    };
  }
  return {
    message:
      'The result could not be confirmed. Press Add Room again: if the room was already added it is not added twice.',
    refetch: true,
    outcomeUnknown: true,
  };
}
