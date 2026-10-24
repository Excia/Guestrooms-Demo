// Mock add room, guests and notes (ticket 151), on the schedule's in-memory state. Replaced by the
// backend later.
import { addRoomVisible } from '../app/reservationMenu';
import { buildDetail, ensureParties, extrasFor } from './reservationDetailData';
import { assertFree, bump, findRoom } from './scheduleData';
import type { RoomParty, ScheduleState } from './scheduleData';
import type {
  AddRoomRequest,
  GuestInput,
  Member,
  ReservationDetail,
  ReservationGuest,
  ScheduleBlock,
  UpdateGuestsRequest,
  UpdateNotesRequest,
} from './types';
import { ApiError } from './types';

type MemberLookup = (id: string | undefined) => Member | undefined;

const conflict = (code: string, message: string) => new ApiError(409, message, { code });
const stale = () => conflict('stale', 'This reservation changed since it was loaded');

const blocksOf = (state: ScheduleState, reservationId: string): ScheduleBlock[] =>
  [...state.blocks, ...state.unassigned].filter((b) => b.reservationId === reservationId);

/** The blocks that are a room of the reservation (not the earlier or later parts of a stay). */
const currentBlocks = (state: ScheduleState, reservationId: string) =>
  blocksOf(state, reservationId).filter(
    (b) => b.roomChange?.part !== 'previous' && b.roomChange?.part !== 'next',
  );

function bumpVersion(state: ScheduleState, reservationId: string): void {
  extrasFor(state, reservationId).version = `r${++state.versionSeq}`;
}

/**
 * Adds a room for the whole stay. It is refused with 409 `not-editable` in the cases that hide the
 * menu item (every room checked out, the night audit has run, read off the folio), and with 409
 * `conflict` when the room is not free for every night. Nothing changes when it throws.
 * `current` is the reservation as the API shows it (with the folio the audit rule reads).
 */
export function addRoom(
  state: ScheduleState,
  request: AddRoomRequest,
  current: ReservationDetail,
  member: MemberLookup,
  onChanged: (reservationId: string) => void,
): ReservationDetail {
  if (current.version !== request.version) throw stale();
  if (!addRoomVisible(current)) {
    throw conflict('not-editable', 'A room cannot be added to this reservation any more');
  }
  const roomId = request.roomId ?? null;
  if (roomId !== null) findRoom(state, roomId);
  const rooms = currentBlocks(state, request.reservationId);
  const lead = rooms[0];
  const block: ScheduleBlock = {
    kind: 'reservation',
    id: `rr-add-${++state.createdSeq}`,
    reservationId: request.reservationId,
    confirmationNumber: lead.confirmationNumber,
    guestName: lead.guestName,
    guestType: lead.guestType,
    roomId: roomId ?? '',
    // The dates of the whole stay.
    startDate: current.arrival,
    endDate: current.departure,
    status: current.arrival <= state.today ? 'nyci' : 'confirmed',
    roomCount: rooms.length + 1,
    roomTypeLocked: false,
    version: 'v1',
  };
  if (roomId !== null) {
    try {
      assertFree(state, [{ block, roomId, startDate: block.startDate, endDate: block.endDate }]);
    } catch (error) {
      state.createdSeq--; // nothing was added
      throw error;
    }
  }
  const extras = extrasFor(state, request.reservationId);
  // Fix the existing rooms' shares before the new party joins them.
  const parties = ensureParties(
    extras,
    rooms.map((b) => b.id),
  );
  const person = member(request.leadOccupant?.memberId);
  parties[block.id] = {
    adults: request.adults,
    children: request.children,
    guests: [],
    ...(request.leadOccupant
      ? {
          lead: {
            name: request.leadOccupant.name.trim(),
            memberNumber: person?.memberNumber ?? null,
          },
        }
      : {}),
  };
  for (const other of rooms) {
    other.roomCount = rooms.length + 1;
    bump(state, other);
  }
  bump(state, block);
  (roomId === null ? state.unassigned : state.blocks).push(block);
  bumpVersion(state, request.reservationId);
  onChanged(request.reservationId);
  return buildDetail(state, request.reservationId);
}

const sameGuest = (a: ReservationGuest, b: GuestInput) =>
  a.kind === b.kind && a.name === b.name.trim() && a.memberId === b.memberId;

/** Sets one room's party and named guests; nothing changes when it throws. */
export function updateGuests(
  state: ScheduleState,
  request: UpdateGuestsRequest,
  member: MemberLookup,
): ReservationDetail {
  const detail = buildDetail(state, request.reservationId); // 404 when unknown
  if (detail.version !== request.version) throw stale();
  const room = detail.rooms.find((r) => r.id === request.reservationRoomId);
  if (!room) throw new ApiError(404, 'Reservation room not found');
  // Guests are read-only once the room is checked in (or out).
  if (room.status !== 'nyci') {
    throw conflict('not-editable', 'The guests of a checked-in room cannot be changed');
  }
  const extras = extrasFor(state, request.reservationId);
  const party: RoomParty = ensureParties(extras, [room.id])[room.id];
  const kept = [...party.guests];
  party.adults = request.adults;
  party.children = request.children;
  party.guests = request.guests.map((input) => {
    const at = kept.findIndex((g) => sameGuest(g, input));
    const old = at >= 0 ? kept.splice(at, 1)[0] : undefined;
    const person = member(input.memberId);
    const email = input.email?.trim() || person?.email || undefined;
    return {
      id: old?.id ?? `g-${++state.segmentSeq}`,
      kind: input.kind,
      name: input.name.trim(),
      ...(input.memberId ? { memberId: input.memberId } : {}),
      memberNumber: person?.memberNumber ?? null,
      ...(email ? { email } : {}),
      ...(old?.confirmationSent || (input.sendConfirmation && email)
        ? { confirmationSent: true }
        : {}),
    };
  });
  bumpVersion(state, request.reservationId);
  return buildDetail(state, request.reservationId);
}

/** Saves both notes; nothing changes when it throws. */
export function updateNotes(state: ScheduleState, request: UpdateNotesRequest): ReservationDetail {
  const detail = buildDetail(state, request.reservationId); // 404 when unknown
  if (detail.version !== request.version) throw stale();
  if (detail.rooms.every((r) => r.status === 'checked-out')) {
    throw conflict('not-editable', 'The notes of a checked-out reservation cannot be changed');
  }
  const extras = extrasFor(state, request.reservationId);
  extras.publicNotes = request.publicNotes;
  extras.privateNotes = request.privateNotes;
  bumpVersion(state, request.reservationId);
  return buildDetail(state, request.reservationId);
}
