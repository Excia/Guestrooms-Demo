// Mock reservation details, early/late saves and reservation creation, on the schedule's
// in-memory state. Replaced by the backend later.
import { addDays, daysBetween } from '../lib/dates';
import { expectedLeadOccupantName } from './createRules';
import { assertFree, bump, findRoom, nightRate, stayOf } from './scheduleData';
import type { ReservationExtras, ScheduleState } from './scheduleData';
import type {
  CreateReservationRequest,
  EarlyLateRequest,
  EarlyLateResult,
  Member,
  ReservationDetail,
  ReservationRoomDetail,
  ReservationStatus,
  ScheduleBlock,
} from './types';
import { ApiError } from './types';

const notFound = () => new ApiError(404, 'Reservation not found');

/** Small stable hash so every reservation gets the same placeholder party each time. */
function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** The reservation's record, created with placeholder defaults on first use. */
export function extrasFor(state: ScheduleState, reservationId: string): ReservationExtras {
  return (state.extras[reservationId] ??= {
    adults: 2,
    children: hash(reservationId) % 3 === 0 ? 2 : 0,
    earlyCheckIn: false,
    lateCheckOut: false,
    version: 'r1',
    addOns: [],
    publicNotes: '',
    privateNotes: '',
  });
}

function reservationStatus(rooms: ReservationRoomDetail[]): ReservationStatus {
  if (rooms.every((r) => r.status === 'checked-out')) return 'checked-out';
  if (rooms.some((r) => r.status !== 'nyci')) return 'checked-in';
  return 'confirmed';
}

/** The reservation's rooms: on the grid, or (created without a room) in the unassigned list. */
const stayBlocks = (state: ScheduleState, reservationId: string): ScheduleBlock[] =>
  [...state.blocks, ...state.unassigned].filter((b) => b.reservationId === reservationId);

export function buildDetail(state: ScheduleState, reservationId: string): ReservationDetail {
  const group = stayBlocks(state, reservationId);
  if (group.length === 0) throw notFound();
  const extras = extrasFor(state, reservationId);
  // After a room change during the stay (ticket 2.3) a stay is several segments; the panel shows
  // the current room and lists the earlier ones.
  const current = group.filter((b) => b.roomChange?.part !== 'previous');
  const lead = current[0] ?? group[0];
  const typeName = (id: string) => state.roomTypes.find((t) => t.id === id);
  const roomNumber = (id: string) => state.rooms.find((r) => r.id === id)?.number ?? null;
  const rooms: ReservationRoomDetail[] = current.map((b) => {
    const room = state.rooms.find((r) => r.id === b.roomId);
    const earlier = group
      .filter((p) => p.roomChange?.part === 'previous' && stayOf(p) === b.id)
      .sort((x, y) => x.startDate.localeCompare(y.startDate))
      .map((p) => ({
        roomId: p.roomId,
        roomNumber: roomNumber(p.roomId),
        arrival: p.startDate,
        departure: p.endDate,
      }));
    return {
      id: b.id,
      roomId: room?.id ?? null,
      roomNumber: room?.number ?? null,
      locationName: state.locations.find((l) => l.id === room?.locationId)?.name ?? null,
      roomTypeName: typeName(room?.roomTypeId ?? '')?.name ?? null,
      status: b.status === 'checked-in' || b.status === 'checked-out' ? b.status : 'nyci',
      arrival: b.startDate,
      departure: b.endDate,
      ...(earlier.length ? { previousStays: earlier } : {}),
    };
  });
  const arrival = group.reduce((min, b) => (b.startDate < min ? b.startDate : min), lead.startDate);
  const departure = group.reduce((max, b) => (b.endDate > max ? b.endDate : max), lead.endDate);
  const lines = group
    .flatMap((b) => {
      const room = state.rooms.find((r) => r.id === b.roomId);
      const type = typeName(room?.roomTypeId ?? '');
      return Array.from({ length: daysBetween(b.startDate, b.endDate) }, (_, i) => {
        const date = addDays(b.startDate, i);
        return {
          roomType: type?.name ?? 'Room',
          date,
          amountCents: nightRate(state, b, date),
          reservationRoomId: stayOf(b),
        };
      });
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const addOnTotal = extras.addOns.reduce((sum, a) => sum + a.quantity * a.priceCents, 0);
  return {
    id: reservationId,
    confirmationNumber: lead.confirmationNumber,
    status: reservationStatus(rooms),
    arrival,
    departure,
    nights: daysBetween(arrival, departure),
    adults: extras.adults,
    children: extras.children,
    leadOccupant: extras.leadOccupant
      ? { ...extras.leadOccupant, guestType: lead.guestType }
      : {
          name: lead.guestName,
          memberNumber:
            lead.guestType === 'member' || lead.guestType === 'owner'
              ? `MEM-${lead.confirmationNumber.replace(/\D/g, '').slice(-4)}`
              : null,
          guestType: lead.guestType,
        },
    rooms,
    earlyCheckIn: extras.earlyCheckIn,
    lateCheckOut: extras.lateCheckOut,
    addOns: structuredClone(extras.addOns),
    publicNotes: extras.publicNotes,
    privateNotes: extras.privateNotes,
    stay: { lines, folioTotalCents: lines.reduce((s, l) => s + l.amountCents, 0) + addOnTotal },
    version: extras.version,
  };
}

/** Applies the flags if the version is current; nothing changes when it throws. */
export function setEarlyLate(state: ScheduleState, request: EarlyLateRequest): EarlyLateResult {
  const group = stayBlocks(state, request.reservationId);
  if (group.length === 0) throw notFound();
  const extras = extrasFor(state, request.reservationId);
  if (extras.version !== request.version) {
    throw new ApiError(409, 'This reservation changed since it was loaded', { code: 'stale' });
  }
  if (group.every((b) => b.status === 'checked-out')) {
    throw new ApiError(409, 'A checked-out reservation cannot be changed', {
      code: 'not-editable',
    });
  }
  if (request.earlyCheckIn !== undefined) extras.earlyCheckIn = request.earlyCheckIn;
  if (request.lateCheckOut !== undefined) extras.lateCheckOut = request.lateCheckOut;
  extras.version = `r${++state.versionSeq}`;
  for (const b of group) {
    b.earlyCheckIn = extras.earlyCheckIn || undefined;
    b.lateCheckOut = extras.lateCheckOut || undefined;
  }
  return {
    earlyCheckIn: extras.earlyCheckIn,
    lateCheckOut: extras.lateCheckOut,
    version: extras.version,
  };
}

export function createReservation(
  state: ScheduleState,
  request: CreateReservationRequest,
  /** Looks a directory person up by id (the booking guest and the lead occupant). */
  member: (id: string | undefined) => Member | undefined,
): ReservationDetail {
  const roomId = request.roomId ?? null;
  if (roomId !== null) findRoom(state, roomId);
  if (request.arrival < state.today) {
    throw new ApiError(400, 'Arrival cannot be in the past', { code: 'invalid-query' });
  }
  const seq = ++state.createdSeq;
  const guest = member(request.bookingGuestId);
  const block: ScheduleBlock = {
    kind: 'reservation',
    id: `rr-new-${seq}`,
    reservationId: `rs-new-${seq}`,
    confirmationNumber: `GR-${70000 + seq}`,
    guestName: request.guestName.trim(),
    guestType: guest ? 'member' : 'guest',
    roomId: roomId ?? '',
    startDate: request.arrival,
    endDate: request.departure,
    status: request.arrival === state.today ? 'nyci' : 'confirmed',
    roomCount: 1,
    roomTypeLocked: false,
    version: 'v1',
  };
  if (roomId !== null) {
    // Availability is only checked when a room is chosen.
    try {
      assertFree(state, [
        { block, roomId: block.roomId, startDate: block.startDate, endDate: block.endDate },
      ]);
    } catch (error) {
      state.createdSeq--; // nothing was created
      throw error;
    }
  }
  bump(state, block);
  (roomId === null ? state.unassigned : state.blocks).push(block);
  const leadName = expectedLeadOccupantName(request);
  const lead =
    request.bookingGuestRole === 'occupant' ? guest : member(request.leadOccupant?.memberId);
  state.extras[block.reservationId] = {
    ...extrasFor(state, block.reservationId),
    adults: request.adults,
    children: request.children,
    publicNotes: request.publicNotes ?? '',
    privateNotes: request.privateNotes ?? '',
    leadOccupant: { name: leadName, memberNumber: lead?.memberNumber ?? null },
  };
  return buildDetail(state, block.reservationId);
}
