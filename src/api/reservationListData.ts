// Mock rows of the Reservation List, built on the schedule's in-memory state so a check-in or a
// move shows up in both views. Replaced by the backend later.
import { addDays } from '../lib/dates';
import { extrasFor } from './reservationDetailData';
import { deriveListStatus } from './reservationListRules';
import type {
  ListStatus,
  ReservationListOptions,
  ReservationListRoom,
  ReservationListRow,
} from './reservationListTypes';
import type { ScheduleState } from './scheduleData';
import type { ScheduleBlock, ScheduleBlockStatus } from './types';

const STATUS: Record<ScheduleBlockStatus, ListStatus> = {
  confirmed: 'not-checked-in',
  nyci: 'not-checked-in',
  'checked-in': 'checked-in',
  'checked-out': 'checked-out',
};

// PLACEHOLDER: the schedule has no group blocks. A few reservations get one, chosen by a stable
// hash of the reservation id, so the Block column and its text filter have something to show.
const BLOCK_NAMES = ['Member-Guest Weekend', 'Spring Invitational', 'Ladies Golf Association'];
function blockFor(reservationId: string): string | null {
  let h = 0;
  for (const ch of reservationId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 4 === 0 ? BLOCK_NAMES[(h >>> 2) % BLOCK_NAMES.length] : null;
}

/** One row per reservation, from the grid's blocks and the unassigned list. */
export function buildListRows(state: ScheduleState): ReservationListRow[] {
  const groups = new Map<string, ScheduleBlock[]>();
  for (const block of [...state.blocks, ...state.unassigned]) {
    const group = groups.get(block.reservationId);
    if (group) group.push(block);
    else groups.set(block.reservationId, [block]);
  }
  const rows = [...groups.entries()].map(([reservationId, group]) => {
    const rooms: ReservationListRoom[] = group.map((b) => ({
      id: b.id,
      roomNumber: state.rooms.find((r) => r.id === b.roomId)?.number ?? null,
      status: STATUS[b.status],
    }));
    const first = group[0];
    const firstRoom = state.rooms.find((r) => r.id === first.roomId);
    const location = state.locations.find((l) => l.id === firstRoom?.locationId);
    const roomType = state.roomTypes.find((t) => t.id === firstRoom?.roomTypeId);
    const extras = extrasFor(state, reservationId);
    return {
      id: reservationId,
      confirmationNumber: first.confirmationNumber,
      arrival: group.reduce((min, b) => (b.startDate < min ? b.startDate : min), first.startDate),
      departure: group.reduce((max, b) => (b.endDate > max ? b.endDate : max), first.endDate),
      guestName: extras.leadOccupant?.name ?? first.guestName,
      reserverName: first.guestName,
      blockName: blockFor(reservationId),
      locationId: location?.id ?? null,
      locationName: location?.name ?? null,
      roomTypeId: roomType?.id ?? null,
      roomTypeName: roomType?.name ?? null,
      rooms,
      status: deriveListStatus(rooms),
    } satisfies ReservationListRow;
  });
  return [...rows, ...extraRows(state)];
}

interface Seed {
  id: string;
  conf: string;
  guest: string;
  from: number;
  to: number;
  roomIds: (string | null)[];
  status: ListStatus;
}

// PLACEHOLDER: the schedule state models no cancellations and no unassigned stays on the grid, so
// these list-only reservations (day offsets from today) exercise the Canceled and Unassigned
// treatments. They are not on the schedule, and the details panel does not know them.
const EXTRA_SEEDS: Seed[] = [
  {
    id: 'rs-X1',
    conf: 'GR-50401',
    guest: 'Imogen Hartley',
    from: 1,
    to: 3,
    roomIds: ['rm-302'],
    status: 'canceled',
  },
  {
    id: 'rs-X2',
    conf: 'GR-50402',
    guest: 'Oscar Delacroix',
    from: 4,
    to: 6,
    roomIds: [null],
    status: 'not-checked-in',
  },
  {
    id: 'rs-X3',
    conf: 'GR-50403',
    guest: 'Wen Zhao',
    from: 2,
    to: 4,
    roomIds: [null, 'rm-C1'],
    status: 'not-checked-in',
  },
];

function extraRows(state: ScheduleState): ReservationListRow[] {
  return EXTRA_SEEDS.flatMap((seed) => {
    const rooms: ReservationListRoom[] = seed.roomIds.map((roomId, i) => ({
      id: `${seed.id}-${i + 1}`,
      roomNumber:
        roomId === null ? null : (state.rooms.find((r) => r.id === roomId)?.number ?? null),
      status: seed.status,
    }));
    const firstRoom = state.rooms.find((r) => r.id === seed.roomIds[0]);
    const location = state.locations.find((l) => l.id === firstRoom?.locationId);
    const roomType = state.roomTypes.find((t) => t.id === firstRoom?.roomTypeId);
    return [
      {
        id: seed.id,
        confirmationNumber: seed.conf,
        arrival: addDays(state.today, seed.from),
        departure: addDays(state.today, seed.to),
        guestName: seed.guest,
        reserverName: seed.guest,
        blockName: null,
        locationId: location?.id ?? null,
        locationName: location?.name ?? null,
        roomTypeId: roomType?.id ?? null,
        roomTypeName: roomType?.name ?? null,
        rooms,
        status: deriveListStatus(rooms),
      },
    ];
  });
}

export function listOptions(state: ScheduleState): ReservationListOptions {
  return {
    locations: structuredClone(state.locations),
    roomTypes: structuredClone(state.roomTypes),
  };
}
