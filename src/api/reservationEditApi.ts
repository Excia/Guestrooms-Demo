// Request guards of the edit panel's add room, guests and notes (ticket 151), kept apart from the
// shared validation.ts. The mock and the HTTP client both run them before anything is sent.
import { ApiError } from './types';
import type { AddRoomRequest, GuestInput, UpdateGuestsRequest, UpdateNotesRequest } from './types';
import {
  assertRequestId,
  assertResourceId,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_PARTY,
} from './validation';
import { isEmail } from './validation';

const invalid = (what: string) => new ApiError(400, `Invalid ${what}`, { code: 'invalid-query' });

const version = (v: unknown) => typeof v === 'string' && v !== '' && v.length <= 128;
const count = (n: unknown, min: number) =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= MAX_PARTY;
const shortText = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;

export function assertAddRoomRequest(request: AddRoomRequest): void {
  assertRequestId(request.requestId);
  assertResourceId(request.reservationId, 'reservation');
  if (!version(request.version)) throw invalid('reservation version');
  if (request.roomId !== undefined && request.roomId !== null) {
    assertResourceId(request.roomId, 'room');
  }
  if (!count(request.adults, 1) || !count(request.children, 0)) throw invalid('party');
  const lead = request.leadOccupant;
  if (
    lead !== undefined &&
    (typeof lead.name !== 'string' ||
      lead.name.trim() === '' ||
      lead.name.length > MAX_NAME_LENGTH ||
      (lead.memberId !== undefined && !shortText(lead.memberId, 128)))
  ) {
    throw invalid('lead occupant');
  }
}

function assertGuest(guest: GuestInput): void {
  if (
    guest === null ||
    typeof guest !== 'object' ||
    (guest.kind !== 'adult' && guest.kind !== 'child') ||
    typeof guest.slot !== 'number' ||
    !Number.isInteger(guest.slot) ||
    guest.slot < 0 ||
    guest.slot >= MAX_PARTY ||
    typeof guest.name !== 'string' ||
    guest.name.trim() === '' ||
    guest.name.length > MAX_NAME_LENGTH ||
    (guest.memberId !== undefined && !shortText(guest.memberId, 128)) ||
    (guest.email !== undefined &&
      (!shortText(guest.email, 254) || (guest.email !== '' && !isEmail(guest.email)))) ||
    (guest.sendConfirmation !== undefined && typeof guest.sendConfirmation !== 'boolean')
  ) {
    throw invalid('guest');
  }
}

export function assertUpdateGuestsRequest(request: UpdateGuestsRequest): void {
  assertRequestId(request.requestId);
  assertResourceId(request.reservationId, 'reservation');
  assertResourceId(request.reservationRoomId, 'reservation room');
  if (!version(request.version)) throw invalid('reservation version');
  if (!count(request.adults, 1) || !count(request.children, 0)) throw invalid('party');
  if (!Array.isArray(request.guests) || request.guests.length > 2 * MAX_PARTY) {
    throw invalid('guests');
  }
  request.guests.forEach(assertGuest);
  // The lead occupant is the first adult: the list holds at most adults - 1 adults.
  const adults = request.guests.filter((g) => g.kind === 'adult').length;
  const children = request.guests.length - adults;
  if (adults > request.adults - 1 || children > request.children) throw invalid('guests');
  // Each guest takes its own slot: inside the room's slots, none used twice per kind.
  const taken = new Set<string>();
  for (const g of request.guests) {
    const limit = g.kind === 'adult' ? request.adults - 1 : request.children;
    const key = `${g.kind}:${g.slot}`;
    if (g.slot >= limit || taken.has(key)) throw invalid('guests');
    taken.add(key);
  }
}

export function assertUpdateNotesRequest(request: UpdateNotesRequest): void {
  assertRequestId(request.requestId);
  assertResourceId(request.reservationId, 'reservation');
  if (!version(request.version)) throw invalid('reservation version');
  if (
    !shortText(request.publicNotes, MAX_NOTES_LENGTH) ||
    !shortText(request.privateNotes, MAX_NOTES_LENGTH)
  ) {
    throw invalid('notes');
  }
}
