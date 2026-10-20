// Mock reservation details, early/late saves and reservation creation, on the schedule's
// in-memory state. Replaced by the backend later.
import { addDays, daysBetween } from '../lib/dates';
import { assertFree, bump, findRoom } from './scheduleData';
import type { ReservationExtras, ScheduleState } from './scheduleData';
import type {
  CreateReservationRequest,
  EarlyLateRequest,
  EarlyLateResult,
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

export function buildDetail(state: ScheduleState, reservationId: string): ReservationDetail {
  const group = state.blocks.filter((b) => b.reservationId === reservationId);
  if (group.length === 0) throw notFound();
  const extras = extrasFor(state, reservationId);
  const lead = group[0];
  const typeName = (id: string) => state.roomTypes.find((t) => t.id === id);
  const rooms: ReservationRoomDetail[] = group.map((b) => {
    const room = state.rooms.find((r) => r.id === b.roomId);
    return {
      id: b.id,
      roomId: room?.id ?? null,
      roomNumber: room?.number ?? null,
      locationName: state.locations.find((l) => l.id === room?.locationId)?.name ?? null,
      roomTypeName: typeName(room?.roomTypeId ?? '')?.name ?? null,
      status: b.status === 'checked-in' || b.status === 'checked-out' ? b.status : 'nyci',
      arrival: b.startDate,
      departure: b.endDate,
    };
  });
  const arrival = group.reduce((min, b) => (b.startDate < min ? b.startDate : min), lead.startDate);
  const departure = group.reduce((max, b) => (b.endDate > max ? b.endDate : max), lead.endDate);
  const lines = group.flatMap((b) => {
    const room = state.rooms.find((r) => r.id === b.roomId);
    const type = typeName(room?.roomTypeId ?? '');
    return Array.from({ length: daysBetween(b.startDate, b.endDate) }, (_, i) => ({
      roomType: type?.name ?? 'Room',
      date: addDays(b.startDate, i),
      amountCents: type?.nightlyRate ?? 0,
    }));
  });
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
    leadOccupant: {
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
  const group = state.blocks.filter((b) => b.reservationId === request.reservationId);
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
): ReservationDetail {
  findRoom(state, request.roomId);
  if (request.arrival < state.today) {
    throw new ApiError(400, 'Arrival cannot be in the past', { code: 'invalid-query' });
  }
  const seq = ++state.createdSeq;
  const block: ScheduleBlock = {
    kind: 'reservation',
    id: `rr-new-${seq}`,
    reservationId: `rs-new-${seq}`,
    confirmationNumber: `GR-${70000 + seq}`,
    guestName: request.guestName.trim(),
    guestType: 'guest',
    roomId: request.roomId,
    startDate: request.arrival,
    endDate: request.departure,
    status: request.arrival === state.today ? 'nyci' : 'confirmed',
    roomCount: 1,
    roomTypeLocked: false,
    version: 'v1',
  };
  try {
    assertFree(state, [
      { block, roomId: block.roomId, startDate: block.startDate, endDate: block.endDate },
    ]);
  } catch (error) {
    state.createdSeq--; // nothing was created
    throw error;
  }
  bump(state, block);
  state.blocks.push(block);
  state.extras[block.reservationId] = {
    ...extrasFor(state, block.reservationId),
    adults: request.adults,
    children: request.children,
    publicNotes: request.publicNotes ?? '',
    privateNotes: request.privateNotes ?? '',
  };
  return buildDetail(state, block.reservationId);
}
