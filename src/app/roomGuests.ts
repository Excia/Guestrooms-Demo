// Rules of the guests of one room (ticket 151): the adult and child counts, the "Guest 2..." slots
// the lead occupant leaves, the draft being edited and the request. The lead occupant is Guest 1 and
// the first adult; every other person of the party is a slot that stays "TBD" until someone is
// named. Pure, no React.
import type {
  GuestInput,
  Member,
  ReservationDetail,
  ReservationGuest,
  ReservationRoomDetail,
  UpdateGuestsRequest,
} from '../api/types';
import { ApiError } from '../api/types';
import { MAX_PARTY } from '../api/validation';

/** A named guest while editing. */
export interface DraftGuest {
  name: string;
  memberId?: string;
  memberNumber: string | null;
  email?: string;
  /** Send the confirmation email on Update. Off by default. */
  sendConfirmation: boolean;
  /** One was already sent when this guest was saved. */
  confirmationSent: boolean;
}

export interface GuestsDraft {
  adults: number;
  children: number;
  /** One entry per adult besides the lead occupant; null is TBD. */
  adultSlots: (DraftGuest | null)[];
  /** One entry per child; null is TBD. */
  childSlots: (DraftGuest | null)[];
}

export const MIN_ADULTS = 1;
export { MAX_PARTY };

/** A room's party; falls back to the reservation's totals when the backend sends none per room. */
export function roomParty(
  detail: Pick<ReservationDetail, 'adults' | 'children' | 'rooms'>,
  room: Pick<ReservationRoomDetail, 'adults' | 'children' | 'guests'>,
) {
  const single = detail.rooms.length === 1;
  return {
    adults: room.adults ?? (single ? detail.adults : 1),
    children: room.children ?? (single ? detail.children : 0),
    guests: room.guests ?? [],
  };
}

const fill = <T>(items: readonly T[], length: number): (T | null)[] =>
  Array.from({ length }, (_, i) => items[i] ?? null);

const toDraftGuest = (g: ReservationGuest): DraftGuest => ({
  name: g.name,
  ...(g.memberId ? { memberId: g.memberId } : {}),
  memberNumber: g.memberNumber,
  ...(g.email ? { email: g.email } : {}),
  sendConfirmation: false,
  confirmationSent: g.confirmationSent === true,
});

/** The draft to start editing from: the saved party and guests of the room. */
export function draftFromRoom(
  detail: Pick<ReservationDetail, 'adults' | 'children' | 'rooms'>,
  room: Pick<ReservationRoomDetail, 'adults' | 'children' | 'guests'>,
): GuestsDraft {
  const party = roomParty(detail, room);
  const adultGuests = party.guests.filter((g) => g.kind === 'adult').map(toDraftGuest);
  const childGuests = party.guests.filter((g) => g.kind === 'child').map(toDraftGuest);
  return {
    adults: party.adults,
    children: party.children,
    adultSlots: fill(adultGuests, Math.max(0, party.adults - 1)),
    childSlots: fill(childGuests, party.children),
  };
}

export const totalGuests = (d: Pick<GuestsDraft, 'adults' | 'children'>) => d.adults + d.children;

/** Whether a stepper can move: an adult cannot go below one, the room holds MAX_PARTY people. */
export function canStep(
  draft: Pick<GuestsDraft, 'adults' | 'children'>,
  kind: 'adult' | 'child',
  delta: 1 | -1,
): boolean {
  if (delta === 1) return totalGuests(draft) < MAX_PARTY;
  return kind === 'adult' ? draft.adults > MIN_ADULTS : draft.children > 0;
}

/** One more or one fewer; the last slot of that kind goes first (the legacy behavior). */
export function stepCount(draft: GuestsDraft, kind: 'adult' | 'child', delta: 1 | -1): GuestsDraft {
  if (!canStep(draft, kind, delta)) return draft;
  if (kind === 'adult') {
    const adults = draft.adults + delta;
    return { ...draft, adults, adultSlots: fill(draft.adultSlots, adults - 1) };
  }
  const children = draft.children + delta;
  return { ...draft, children, childSlots: fill(draft.childSlots, children) };
}

export function setSlot(
  draft: GuestsDraft,
  kind: 'adult' | 'child',
  index: number,
  guest: DraftGuest | null,
): GuestsDraft {
  const key = kind === 'adult' ? 'adultSlots' : 'childSlots';
  const slots = [...draft[key]];
  if (index < 0 || index >= slots.length) return draft;
  slots[index] = guest;
  return { ...draft, [key]: slots };
}

/** A directory person put in a slot. The confirmation toggle starts off. */
export const guestFromMember = (member: Member): DraftGuest => ({
  name: member.name,
  memberId: member.id,
  memberNumber: member.memberNumber,
  ...(member.email ? { email: member.email } : {}),
  sendConfirmation: false,
  confirmationSent: false,
});

export interface GuestSlot {
  kind: 'adult' | 'child';
  /** Index within its kind's list. */
  index: number;
  /** "Guest 2": the lead occupant is Guest 1. */
  label: string;
  guest: DraftGuest | null;
}

/** The "Guest 2..." rows in order: the other adults, then the children. */
export function guestSlots(draft: GuestsDraft): GuestSlot[] {
  const adults = draft.adultSlots.map((guest, index): GuestSlot => ({
    kind: 'adult',
    index,
    label: `Guest ${index + 2}`,
    guest,
  }));
  const children = draft.childSlots.map((guest, index): GuestSlot => ({
    kind: 'child',
    index,
    label: `Guest ${draft.adults + index + 1}`,
    guest,
  }));
  return [...adults, ...children];
}

const comparable = (d: GuestsDraft) =>
  JSON.stringify([
    d.adults,
    d.children,
    d.adultSlots.map((g) => g && [g.name, g.memberId ?? '', g.sendConfirmation]),
    d.childSlots.map((g) => g && [g.name, g.memberId ?? '', g.sendConfirmation]),
  ]);

/** True when the draft differs from the saved one: the button then says Update, else Cancel. */
export const isGuestsDirty = (saved: GuestsDraft, draft: GuestsDraft): boolean =>
  comparable(saved) !== comparable(draft);

const toInput =
  (kind: 'adult' | 'child') =>
  (g: DraftGuest | null): GuestInput[] =>
    g
      ? [
          {
            kind,
            name: g.name,
            ...(g.memberId ? { memberId: g.memberId } : {}),
            ...(g.email ? { email: g.email } : {}),
            ...(g.sendConfirmation && g.email ? { sendConfirmation: true } : {}),
          },
        ]
      : [];

export function toUpdateGuestsRequest(
  draft: GuestsDraft,
  reservation: Pick<ReservationDetail, 'id' | 'version'>,
  reservationRoomId: string,
  requestId: string,
): UpdateGuestsRequest {
  return {
    requestId,
    reservationId: reservation.id,
    reservationRoomId,
    version: reservation.version,
    adults: draft.adults,
    children: draft.children,
    guests: [
      ...draft.adultSlots.flatMap(toInput('adult')),
      ...draft.childSlots.flatMap(toInput('child')),
    ],
  };
}

/** How many of the guests Update would email (a toggle that is on and an address to send to). */
export const confirmationsToSend = (draft: GuestsDraft): number =>
  [...draft.adultSlots, ...draft.childSlots].filter((g) => g?.sendConfirmation && g.email).length;

export interface GuestsAccess {
  editable: boolean;
  /** Why not, for the line shown instead of the Edit button; null when editable or when nothing needs saying. */
  reason: string | null;
}

/**
 * Guests are read-only once the room is checked in or out (and once the reservation is cancelled),
 * and without `reservation.edit`.
 */
export function guestsAccess(
  reservationStatus: ReservationDetail['status'],
  room: Pick<ReservationRoomDetail, 'status'>,
  canEdit: boolean,
): GuestsAccess {
  if (reservationStatus === 'cancelled') {
    return { editable: false, reason: 'This reservation is cancelled.' };
  }
  if (room.status !== 'nyci') {
    return { editable: false, reason: 'Guests cannot be changed once the room is checked in.' };
  }
  if (!canEdit) return { editable: false, reason: null };
  return { editable: true, reason: null };
}

/** "TBD" rows in the read-only list: "Guest 3 (Adult)". */
export const slotKindText = (kind: 'adult' | 'child') => (kind === 'adult' ? 'Adult' : 'Child');

export interface GuestsFailure {
  message: string;
  refetch: boolean;
  outcomeUnknown?: boolean;
}

export const guestsSuccessMessage = (confirmations: number) =>
  confirmations > 0
    ? `Guests updated. ${confirmations === 1 ? 'A confirmation was' : `${confirmations} confirmations were`} sent.`
    : 'Guests updated.';

export function guestsFailure(error: unknown): GuestsFailure {
  const status = error instanceof ApiError ? error.status : 0;
  const code = error instanceof ApiError ? error.code : undefined;
  if (status === 403) return { message: 'You may not change this reservation.', refetch: false };
  if (code === 'stale') {
    return {
      message:
        'This reservation changed elsewhere. It was reloaded; review the guests and try again.',
      refetch: true,
    };
  }
  if (code === 'not-editable') {
    return {
      message:
        'Guests cannot be changed once the room is checked in. The reservation was reloaded.',
      refetch: true,
    };
  }
  if (status === 404)
    return { message: 'The room could not be found. The reservation was reloaded.', refetch: true };
  if (status >= 400 && status < 500 && status !== 408) {
    return {
      message: 'The guests could not be saved. Check the details and try again.',
      refetch: false,
    };
  }
  return {
    message: 'Could not confirm whether the guests were saved. The reservation was reloaded.',
    refetch: true,
    outcomeUnknown: true,
  };
}
