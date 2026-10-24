// Mock schedule: a small realistic inventory and a deterministic 200-room generator, plus the
// move mutations applied to that in-memory state. Replaced by the backend later.
import { addDays, daysBetween, nightsOverlap } from '../lib/dates';
import { rateOutcome } from '../lib/roomChangeRates';
import { changedNights, normalizeRuns, planFromBlocks, planProblem, stayOf } from '../lib/stayPlan';
import type {
  ChangeRoomRequest,
  ChangeRoomResult,
  IsoDate,
  HousekeepingStatus,
  LinkedRoom,
  MoveDatesRequest,
  MoveRoomRequest,
  RoomChangeRule,
  ScheduleBlock,
  SetHousekeepingRequest,
  ScheduleBlockStatus,
  ScheduleClosure,
  ScheduleGuestType,
  ScheduleLocation,
  ScheduleRoom,
  ScheduleRoomType,
} from './types';
import { ApiError } from './types';

// PLACEHOLDER: verify against Figma. The frames carry no location or room-type names; these match
// the dashboard placeholders (PLACEHOLDER_LOCATIONS and the reservation room types).
export const SCHEDULE_LOCATIONS: ScheduleLocation[] = [
  { id: 'main-clubhouse', name: 'Main Clubhouse' },
  { id: 'north-lodge', name: 'North Lodge' },
  { id: 'lakeside', name: 'Lakeside Cottages' },
];

export const SCHEDULE_ROOM_TYPES: ScheduleRoomType[] = [
  // PLACEHOLDER nightly rates (cents, excluding taxes) until Rate Categories provide real ones.
  { id: 'king-deluxe', name: 'King Deluxe', nightlyRate: 24900 },
  { id: 'queen-standard', name: 'Queen Standard', nightlyRate: 19900 },
  { id: 'suite', name: 'Suite', nightlyRate: 34900 },
  { id: 'cottage', name: 'Two-Bedroom Cottage', nightlyRate: 42900 },
];

/** Mock inventory size: `default` is about 30 rooms; `large` is 200 rooms with 60+ days of stays. */
export type ScheduleSize = 'default' | 'large';

export const LARGE_ROOM_COUNT = 200;

export interface ScheduleState {
  today: IsoDate;
  locations: ScheduleLocation[];
  roomTypes: ScheduleRoomType[];
  rooms: ScheduleRoom[];
  blocks: ScheduleBlock[];
  closures: ScheduleClosure[];
  /** Source of the next block `version` (the mock's revision counter). */
  versionSeq: number;
  /** Reservation-level data the grid does not show, created on first use. */
  extras: Record<string, ReservationExtras>;
  /** Source of ids for reservations created through the API. */
  createdSeq: number;
  /** Reservations created without a room: no lane on the grid, so never in `blocks`. */
  unassigned: ScheduleBlock[];
  /**
   * Nightly prices that differ from the room type's rate (a retained rate after a room change),
   * keyed `<reservation room id>|<date>`. Cents, excluding taxes.
   */
  rateOverrides: Record<string, number>;
  /** Source of the ids of "previous" segments created by room changes. */
  segmentSeq: number;
}

/** Details-panel data of one reservation (the mock's stand-in for the reservation record). */
export interface ReservationExtras {
  adults: number;
  children: number;
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
  /** Opaque; changes with every early/late save. */
  version: string;
  addOns: { id: string; name: string; quantity: number; priceCents: number }[];
  publicNotes: string;
  privateNotes: string;
  /** Set when it differs from the booking guest (a created reservation with a reserver). */
  leadOccupant?: { name: string; memberNumber: string | null };
}

const room = (
  id: string,
  number: string,
  locationId: string,
  roomTypeId: string,
): ScheduleRoom => ({
  id,
  number,
  locationId,
  roomTypeId,
});

function defaultRooms(): ScheduleRoom[] {
  const rooms: ScheduleRoom[] = [];
  const add = (loc: string, type: string, numbers: string[]) =>
    numbers.forEach((n) => rooms.push(room(`rm-${n}`, n, loc, type)));
  add('main-clubhouse', 'king-deluxe', ['201', '202', '203', '204', '209', '210']);
  add('main-clubhouse', 'queen-standard', ['205', '206', '207', '208']);
  add('main-clubhouse', 'suite', ['301', '302']);
  add('north-lodge', 'queen-standard', ['101', '102', '103', '104', '107', '108']);
  add('north-lodge', 'king-deluxe', ['105', '106']);
  add('north-lodge', 'suite', ['109', '110']);
  add('lakeside', 'cottage', ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);
  add('lakeside', 'king-deluxe', ['C7', 'C8']);
  return rooms;
}

interface BlockSeed {
  id: string;
  res: string;
  conf: string;
  guest: string;
  type: ScheduleGuestType;
  room: string;
  from: number;
  to: number;
  status: ScheduleBlockStatus;
  rooms?: number;
  locked?: boolean;
  /** PLACEHOLDER (P-21-3): makes the block a linked-room block. */
  linked?: LinkedRoom;
}

// Day offsets are relative to `today`. Covers every status, same-day turnovers (rm-201, rm-105), a
// three-room reservation (GR-50321), a two-room checked-in one (GR-50290) and a locked room type.
const BLOCK_SEEDS: BlockSeed[] = [
  {
    id: 'rr-1',
    res: 'rs-1',
    conf: 'GR-50188',
    guest: 'Sofia Marchetti',
    type: 'guest',
    room: 'rm-201',
    from: -6,
    to: -3,
    status: 'checked-out',
  },
  {
    id: 'rr-2',
    res: 'rs-2',
    conf: 'GR-50240',
    guest: 'Daniel Whitfield',
    type: 'member',
    room: 'rm-201',
    from: -1,
    to: 2,
    status: 'checked-in',
  },
  {
    id: 'rr-3',
    res: 'rs-3',
    conf: 'GR-50301',
    guest: 'Margaret Ellison',
    type: 'member',
    room: 'rm-201',
    from: 2,
    to: 5,
    status: 'confirmed',
  },
  {
    id: 'rr-4',
    res: 'rs-4',
    conf: 'GR-50244',
    guest: 'Priya Raman',
    type: 'guest',
    room: 'rm-202',
    from: -2,
    to: 0,
    status: 'checked-in',
  },
  {
    id: 'rr-5',
    res: 'rs-5',
    conf: 'GR-50310',
    guest: 'Thomas Okafor',
    type: 'none',
    room: 'rm-202',
    from: 0,
    to: 3,
    status: 'nyci',
  },
  {
    id: 'rr-6',
    res: 'rs-6',
    conf: 'GR-50312',
    guest: 'Henry Lowell',
    type: 'owner',
    room: 'rm-203',
    from: 0,
    to: 1,
    status: 'nyci',
  },
  {
    id: 'rr-7',
    res: 'rs-7',
    conf: 'GR-50321',
    guest: 'Annika Lindqvist',
    type: 'member',
    room: 'rm-204',
    from: 2,
    to: 5,
    status: 'confirmed',
    rooms: 3,
  },
  {
    id: 'rr-8',
    res: 'rs-7',
    conf: 'GR-50321',
    guest: 'Annika Lindqvist',
    type: 'member',
    room: 'rm-209',
    from: 2,
    to: 5,
    status: 'confirmed',
    rooms: 3,
  },
  {
    id: 'rr-9',
    res: 'rs-7',
    conf: 'GR-50321',
    guest: 'Annika Lindqvist',
    type: 'member',
    room: 'rm-205',
    from: 2,
    to: 5,
    status: 'confirmed',
    rooms: 3,
  },
  {
    id: 'rr-10',
    res: 'rs-8',
    conf: 'GR-50290',
    guest: 'Robert and Elaine Cho',
    type: 'guest',
    room: 'rm-210',
    from: -3,
    to: 1,
    status: 'checked-in',
    rooms: 2,
  },
  {
    id: 'rr-11',
    res: 'rs-8',
    conf: 'GR-50290',
    guest: 'Robert and Elaine Cho',
    type: 'guest',
    room: 'rm-206',
    from: -3,
    to: 1,
    status: 'checked-in',
    rooms: 2,
  },
  {
    id: 'rr-12',
    res: 'rs-9',
    conf: 'GR-50333',
    guest: 'Julian Brandt',
    type: 'guest',
    room: 'rm-207',
    from: 3,
    to: 6,
    status: 'confirmed',
    locked: true,
  },
  {
    id: 'rr-13',
    res: 'rs-10',
    conf: 'GR-50150',
    guest: 'Grace Nakamura',
    type: 'member',
    room: 'rm-301',
    from: -8,
    to: -5,
    status: 'checked-out',
  },
  {
    id: 'rr-14',
    res: 'rs-11',
    conf: 'GR-50271',
    guest: 'Victor Almeida',
    type: 'owner',
    room: 'rm-301',
    from: -1,
    to: 4,
    status: 'checked-in',
  },
  {
    id: 'rr-15',
    res: 'rs-12',
    conf: 'GR-50344',
    guest: 'Olivia Hartman',
    type: 'member',
    room: 'rm-302',
    from: 1,
    to: 3,
    status: 'confirmed',
  },
  {
    id: 'rr-16',
    res: 'rs-13',
    conf: 'GR-50351',
    guest: 'Marcus Feldman',
    type: 'guest',
    room: 'rm-101',
    from: 0,
    to: 2,
    status: 'nyci',
    linked: {
      roomNumber: '102',
      reserverName: 'Beatrice Quinn',
      earlyCheckIn: true,
      lateCheckOut: true,
    },
  },
  {
    id: 'rr-17',
    res: 'rs-14',
    conf: 'GR-50236',
    guest: 'Beatrice Quinn',
    type: 'member',
    room: 'rm-102',
    from: -4,
    to: -1,
    status: 'checked-out',
  },
  {
    id: 'rr-18',
    res: 'rs-15',
    conf: 'GR-50361',
    guest: 'Samuel Adeyemi',
    type: 'guest',
    room: 'rm-103',
    from: 4,
    to: 8,
    status: 'confirmed',
  },
  {
    id: 'rr-19',
    res: 'rs-16',
    conf: 'GR-50252',
    guest: 'Lucia Fernandez',
    type: 'member',
    room: 'rm-104',
    from: -2,
    to: 1,
    status: 'checked-in',
  },
  {
    id: 'rr-20',
    res: 'rs-17',
    conf: 'GR-50366',
    guest: 'Peter Vandenberg',
    type: 'none',
    room: 'rm-105',
    from: -1,
    to: 3,
    status: 'checked-in',
  },
  {
    id: 'rr-21',
    res: 'rs-18',
    conf: 'GR-50370',
    guest: 'Naomi Castellano',
    type: 'guest',
    room: 'rm-105',
    from: 3,
    to: 5,
    status: 'confirmed',
  },
  {
    id: 'rr-22',
    res: 'rs-19',
    conf: 'GR-50375',
    guest: 'Ibrahim Haddad',
    type: 'member',
    room: 'rm-109',
    from: 6,
    to: 13,
    status: 'confirmed',
  },
  {
    id: 'rr-23',
    res: 'rs-20',
    conf: 'GR-50259',
    guest: 'Claire Beaumont',
    type: 'guest',
    room: 'rm-C1',
    from: -5,
    to: 2,
    status: 'checked-in',
  },
  {
    id: 'rr-24',
    res: 'rs-21',
    conf: 'GR-50380',
    guest: 'Wesley Tran',
    type: 'owner',
    room: 'rm-C2',
    from: 1,
    to: 4,
    status: 'confirmed',
  },
  {
    id: 'rr-25',
    res: 'rs-22',
    conf: 'GR-50385',
    guest: 'Hannah Goldberg',
    type: 'member',
    room: 'rm-C3',
    from: 0,
    to: 3,
    status: 'nyci',
  },
  {
    id: 'rr-26',
    res: 'rs-23',
    conf: 'GR-50390',
    guest: 'Leonard Pruitt',
    type: 'guest',
    room: 'rm-C7',
    from: 10,
    to: 14,
    status: 'confirmed',
  },
  {
    id: 'rr-27',
    res: 'rs-24',
    conf: 'GR-50171',
    guest: 'Elise Moreau',
    type: 'guest',
    room: 'rm-C5',
    from: -3,
    to: 0,
    status: 'checked-out',
  },
];

interface ClosureSeed {
  id: string;
  room: string;
  from: number;
  to: number;
  reason: string;
  marker: boolean;
}

const CLOSURE_SEEDS: ClosureSeed[] = [
  { id: 'cl-1', room: 'rm-208', from: 1, to: 4, reason: 'Reserved: Fixed Loss', marker: true },
  {
    id: 'cl-2',
    room: 'rm-102',
    from: 0,
    to: 3,
    reason: 'Maintenance: Carpet replacement',
    marker: false,
  },
  { id: 'cl-3', room: 'rm-C4', from: -2, to: 6, reason: 'Reserved: Fixed Loss', marker: true },
  { id: 'cl-4', room: 'rm-302', from: 5, to: 9, reason: 'Member event hold', marker: false },
];

// Reservations booked without a room (shown in the grid's Unassigned section). Day offsets are
// relative to `today`; spread out so a narrower date range shows one, two or three.
const UNASSIGNED_SEEDS: {
  id: string;
  res: string;
  conf: string;
  guest: string;
  type: ScheduleGuestType;
  from: number;
  to: number;
}[] = [
  {
    id: 'rr-u1',
    res: 'rs-u1',
    conf: 'GR-50411',
    guest: 'Harriet Lowell',
    type: 'member',
    from: 1,
    to: 4,
  },
  {
    id: 'rr-u2',
    res: 'rs-u2',
    conf: 'GR-50412',
    guest: 'Devon Achterberg',
    type: 'guest',
    from: 3,
    to: 6,
  },
  {
    id: 'rr-u3',
    res: 'rs-u3',
    conf: 'GR-50413',
    guest: 'Priya Natarajan',
    type: 'member',
    from: 9,
    to: 12,
  },
];

/**
 * PLACEHOLDER: the seeded unassigned reservations exist for the grid only. The Reservation List
 * mock keeps its own list-only unassigned reservations (`EXTRA_SEEDS`, GR-50402 and GR-50403) and
 * does not list these, so its first page keeps the rows its tests expect. Ones created through
 * the API are listed like any reservation.
 */
export const isSeededUnassigned = (blockId: string): boolean =>
  UNASSIGNED_SEEDS.some((u) => u.id === blockId);

function seedExtras(): Record<string, ReservationExtras> {
  const base = { adults: 2, children: 0, earlyCheckIn: false, lateCheckOut: false, version: 'r1' };
  return {
    'rs-2': {
      ...base,
      children: 2,
      earlyCheckIn: true,
      addOns: [{ id: 'ao-1', name: 'Late Dinner Reservation', quantity: 1, priceCents: 6500 }],
      publicNotes: 'Guest is celebrating a birthday!',
      privateNotes: 'Guest likes soft pillows.',
    },
    'rs-7': {
      ...base,
      adults: 4,
      children: 2,
      lateCheckOut: true,
      addOns: [{ id: 'ao-2', name: 'Golf Cart Rental', quantity: 2, priceCents: 4000 }],
      publicNotes: 'Family reunion, please keep the three rooms close together.',
      privateNotes: '',
    },
  };
}

function defaultState(today: IsoDate): ScheduleState {
  const at = (n: number) => addDays(today, n);
  return {
    today,
    locations: structuredClone(SCHEDULE_LOCATIONS),
    roomTypes: structuredClone(SCHEDULE_ROOM_TYPES),
    rooms: defaultRooms(),
    blocks: BLOCK_SEEDS.map((s) => ({
      kind: 'reservation',
      id: s.id,
      reservationId: s.res,
      confirmationNumber: s.conf,
      guestName: s.guest,
      guestType: s.type,
      roomId: s.room,
      startDate: at(s.from),
      endDate: at(s.to),
      status: s.status,
      roomCount: s.rooms ?? 1,
      roomTypeLocked: s.locked ?? false,
      version: 'v1',
      ...(s.linked ? { linkedTo: s.linked } : {}),
    })),
    closures: CLOSURE_SEEDS.map((c) => ({
      kind: 'closure',
      id: c.id,
      roomId: c.room,
      startDate: at(c.from),
      endDate: at(c.to),
      reason: c.reason,
      endMarker: c.marker,
    })),
    versionSeq: 1,
    extras: seedExtras(),
    createdSeq: 0,
    unassigned: UNASSIGNED_SEEDS.map((u) => ({
      kind: 'reservation',
      id: u.id,
      reservationId: u.res,
      confirmationNumber: u.conf,
      guestName: u.guest,
      guestType: u.type,
      roomId: '',
      startDate: at(u.from),
      endDate: at(u.to),
      status: 'confirmed',
      roomCount: 1,
      roomTypeLocked: false,
      version: 'v1',
    })),
    rateOverrides: {},
    segmentSeq: 0,
  };
}

/** Small seeded PRNG (mulberry32): the same seed always gives the same sequence. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LARGE_LOCATIONS: ScheduleLocation[] = [
  ...SCHEDULE_LOCATIONS,
  { id: 'east-wing', name: 'East Wing' },
  { id: 'garden-court', name: 'Garden Court' },
];
const FIRST_NAMES = ['Ava', 'Noah', 'Mia', 'Liam', 'Zoe', 'Ethan', 'Ines', 'Omar', 'Lena', 'Hugo'];
const LAST_NAMES = ['Keller', 'Osei', 'Ward', 'Moretti', 'Singh', 'Hale', 'Duval', 'Park', 'Rossi'];
const GUEST_TYPES: ScheduleGuestType[] = ['guest', 'member', 'owner', 'none'];

/** 200 rooms with back-to-back stays from 14 days before to 60 days after `today`; deterministic. */
function largeState(today: IsoDate): ScheduleState {
  const random = seededRandom(20261016);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const rooms: ScheduleRoom[] = [];
  const blocks: ScheduleBlock[] = [];
  const closures: ScheduleClosure[] = [];
  const horizon = addDays(today, 60);
  let serial = 0;
  for (let i = 0; i < LARGE_ROOM_COUNT; i++) {
    const id = `rm-L${String(i + 1).padStart(3, '0')}`;
    rooms.push(
      room(
        id,
        String(100 + i + 1),
        LARGE_LOCATIONS[i % LARGE_LOCATIONS.length].id,
        SCHEDULE_ROOM_TYPES[Math.floor(i / LARGE_LOCATIONS.length) % SCHEDULE_ROOM_TYPES.length].id,
      ),
    );
    let cursor = addDays(today, -14 + Math.floor(random() * 3));
    while (cursor < horizon) {
      const nights = 1 + Math.floor(random() * 5);
      const end = addDays(cursor, nights);
      if (random() < 0.12) {
        closures.push({
          kind: 'closure',
          id: `cl-L${++serial}`,
          roomId: id,
          startDate: cursor,
          endDate: end,
          reason: pick(['Reserved: Fixed Loss', 'Maintenance: Plumbing', 'Member event hold']),
          endMarker: random() < 0.5,
        });
      } else if (random() < 0.85) {
        const status: ScheduleBlockStatus =
          end <= today
            ? 'checked-out'
            : cursor > today
              ? 'confirmed'
              : cursor === today && random() < 0.5
                ? 'nyci'
                : 'checked-in';
        serial++;
        blocks.push({
          kind: 'reservation',
          id: `rr-L${serial}`,
          reservationId: `rs-L${serial}`,
          confirmationNumber: `GR-${60000 + serial}`,
          guestName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
          guestType: pick(GUEST_TYPES),
          roomId: id,
          startDate: cursor,
          endDate: end,
          status,
          roomCount: 1,
          roomTypeLocked: random() < 0.1,
          version: 'v1',
        });
      }
      // Sometimes a gap night, sometimes same-day turnover.
      cursor = random() < 0.3 ? addDays(end, 1) : end;
    }
  }
  return {
    today,
    locations: LARGE_LOCATIONS,
    roomTypes: structuredClone(SCHEDULE_ROOM_TYPES),
    rooms,
    blocks,
    closures,
    versionSeq: 1,
    extras: {},
    createdSeq: 0,
    unassigned: [],
    rateOverrides: {},
    segmentSeq: 0,
  };
}

export function createScheduleState(today: IsoDate, size: ScheduleSize = 'default'): ScheduleState {
  const state = size === 'large' ? largeState(today) : defaultState(today);
  // The grid's edge markers mirror the reservation's early/late flags.
  for (const block of state.blocks) {
    const extras = state.extras[block.reservationId];
    if (extras?.earlyCheckIn) block.earlyCheckIn = true;
    if (extras?.lateCheckOut) block.lateCheckOut = true;
  }
  // Demo housekeeping states until the backend supplies them: in-house rooms are not checked out,
  // departed rooms cycle through the cleaning states.
  const departed: HousekeepingStatus[] = [
    'needs-cleaning',
    'cleaned',
    'ready',
    'needs-maintenance',
  ];
  let n = 0;
  for (const block of state.blocks) {
    if (block.status === 'checked-in') block.housekeeping = 'not-checked-out';
    else if (block.status === 'checked-out') block.housekeeping = departed[n++ % departed.length];
    if (
      block.housekeeping === 'not-checked-out' &&
      !state.blocks.some((b) => b.housekeepingNotes)
    ) {
      block.housekeepingNotes = 'Guest asked for extra towels.';
    }
  }
  return state;
}

// ---- mutations ----------------------------------------------------------------------------------

const notFound = (what: string) => new ApiError(404, `${what} not found`);
const notMovable = (message: string) => new ApiError(409, message, { code: 'not-movable' });

export function conflictError(roomIds: string[]): ApiError {
  return new ApiError(409, 'A target room is already booked or closed on those dates', {
    code: 'conflict',
    details: { roomId: [...new Set(roomIds)] },
  });
}

interface Placement {
  block: ScheduleBlock;
  roomId: string;
  startDate: IsoDate;
  endDate: IsoDate;
}

/** Throws 409 `conflict` if a placement overlaps a closure, a block that stays put, or another placement. */
export function assertFree(state: ScheduleState, placements: Placement[]): void {
  const moving = new Set(placements.map((p) => p.block.id));
  const clashes: string[] = [];
  placements.forEach((p, i) => {
    const hit =
      state.blocks.some(
        (b) =>
          !moving.has(b.id) &&
          b.roomId === p.roomId &&
          nightsOverlap(b.startDate, b.endDate, p.startDate, p.endDate),
      ) ||
      state.closures.some(
        (c) =>
          c.roomId === p.roomId && nightsOverlap(c.startDate, c.endDate, p.startDate, p.endDate),
      ) ||
      placements.some(
        (q, j) =>
          j !== i &&
          q.roomId === p.roomId &&
          nightsOverlap(q.startDate, q.endDate, p.startDate, p.endDate),
      );
    if (hit) clashes.push(p.roomId);
  });
  if (clashes.length) throw conflictError(clashes);
}

export function findBlock(state: ScheduleState, id: string): ScheduleBlock {
  const block = state.blocks.find((b) => b.id === id);
  if (!block) throw notFound('Reservation room');
  return block;
}

export function findRoom(state: ScheduleState, id: string): ScheduleRoom {
  const found = state.rooms.find((r) => r.id === id);
  if (!found) throw notFound('Room');
  return found;
}

function assertRoomTypeAllowed(state: ScheduleState, block: ScheduleBlock, toRoomId: string) {
  const from = findRoom(state, block.roomId);
  const to = findRoom(state, toRoomId);
  if (block.roomTypeLocked && from.roomTypeId !== to.roomTypeId) {
    throw notMovable('This reservation is locked to its room type');
  }
}

const stale = () =>
  new ApiError(409, 'This reservation changed since it was loaded', { code: 'stale' });

/** 409 `stale` unless the block is still what the request was made from. */
function assertCurrent(
  block: ScheduleBlock,
  expected: { version: string; fromRoomId: string; fromStartDate?: IsoDate },
): void {
  if (
    block.version !== expected.version ||
    block.roomId !== expected.fromRoomId ||
    (expected.fromStartDate !== undefined && block.startDate !== expected.fromStartDate)
  ) {
    throw stale();
  }
}

/** A stay that changed room (ticket 2.3) has several segments: they are edited with Change Room only. */
function assertNotSplit(block: ScheduleBlock): void {
  if (block.roomChange) {
    throw notMovable('This stay has several rooms; change them with Change Room During Stay');
  }
}

/** A changed block gets a new version. */
export function bump(state: ScheduleState, block: ScheduleBlock): void {
  block.version = `v${++state.versionSeq}`;
}

/** Room change only (same dates). Allowed for checked-in rooms, refused for checked-out ones. */
function relocate(state: ScheduleState, block: ScheduleBlock, toRoomId: string): ScheduleBlock[] {
  findRoom(state, toRoomId);
  if (block.status === 'checked-out') throw notMovable('A checked-out room cannot be moved');
  assertRoomTypeAllowed(state, block, toRoomId);
  if (toRoomId === block.roomId) return [structuredClone(block)];
  assertFree(state, [
    { block, roomId: toRoomId, startDate: block.startDate, endDate: block.endDate },
  ]);
  block.roomId = toRoomId;
  bump(state, block);
  return [structuredClone(block)];
}

/** The price of one night of a block: a retained rate, else the nightly rate of its room type. */
export function nightRate(state: ScheduleState, block: ScheduleBlock, date: IsoDate): number {
  const kept = state.rateOverrides[`${block.id}|${date}`];
  if (kept !== undefined) return kept;
  const room = state.rooms.find((r) => r.id === block.roomId);
  return state.roomTypes.find((t) => t.id === room?.roomTypeId)?.nightlyRate ?? 0;
}

/** Validates then applies; nothing changes when it throws. Returns the changed blocks (copies). */
export function moveRoom(state: ScheduleState, request: MoveRoomRequest): ScheduleBlock[] {
  const block = findBlock(state, request.reservationRoomId);
  findRoom(state, request.toRoomId);
  assertCurrent(block, request);
  assertNotSplit(block);
  return relocate(state, block, request.toRoomId);
}

/**
 * Sets the housekeeping status (and the note when `notes` is sent; empty removes it) of a block.
 * `version`, when given, must be the current one. Returns the changed block (copy).
 */
export function setHousekeeping(
  state: ScheduleState,
  request: SetHousekeepingRequest,
): ScheduleBlock[] {
  const block = findBlock(state, request.reservationRoomId);
  if (request.version !== undefined && block.version !== request.version) throw stale();
  block.housekeeping = request.status;
  if (request.notes !== undefined) {
    if (request.notes === '') delete block.housekeepingNotes;
    else block.housekeepingNotes = request.notes;
  }
  bump(state, block);
  return [structuredClone(block)];
}

export function moveDates(state: ScheduleState, request: MoveDatesRequest): ScheduleBlock[] {
  const block = findBlock(state, request.reservationRoomId);
  if (request.toRoomId !== undefined) findRoom(state, request.toRoomId);
  assertCurrent(block, request);
  assertNotSplit(block);
  const shift = daysBetween(block.startDate, request.toStartDate);
  // No date change: this is a room change, with the same rules as moveRoom.
  if (shift === 0) {
    return request.toRoomId === undefined
      ? [structuredClone(block)]
      : relocate(state, block, request.toRoomId);
  }
  const group = state.blocks.filter((b) => b.reservationId === block.reservationId);
  const moved = request.scope === 'all-rooms' ? group : [block];
  if (moved.some((b) => b.status === 'checked-out' || b.status === 'checked-in')) {
    throw notMovable('Only rooms not yet checked in can change dates');
  }
  // Every room that moves must arrive today or later, not only the one that was dragged.
  if (moved.some((b) => addDays(b.startDate, shift) < state.today)) {
    throw notMovable('Arrival cannot be moved into the past');
  }
  if (request.toRoomId !== undefined) assertRoomTypeAllowed(state, block, request.toRoomId);

  const placements: Placement[] = moved.map((b) => ({
    block: b,
    roomId: b === block && request.toRoomId !== undefined ? request.toRoomId : b.roomId,
    startDate: addDays(b.startDate, shift),
    endDate: addDays(b.endDate, shift),
  }));
  assertFree(state, placements);

  const changed = new Set<ScheduleBlock>();
  for (const p of placements) {
    p.block.roomId = p.roomId;
    p.block.startDate = p.startDate;
    p.block.endDate = p.endDate;
    bump(state, p.block);
    changed.add(p.block);
  }
  if (request.scope === 'this-room' && group.length > 1) {
    // Split: the room leaves the reservation; the rest keep their dates with one room fewer.
    const rest = group.filter((b) => b !== block);
    block.reservationId = `${block.reservationId}-split-${block.id}`;
    block.roomCount = 1;
    for (const b of rest) {
      b.roomCount = rest.length;
      bump(state, b);
      changed.add(b);
    }
  }
  return [...changed].map((b) => structuredClone(b));
}

const invalidChange = (details?: Record<string, string[]>) =>
  new ApiError(400, 'Invalid room change request', { code: 'invalid-query', details });

/** The blocks of one stay (all its segments), oldest first. */
const chainOf = (state: ScheduleState, stayId: string) =>
  state.blocks
    .filter((b) => stayOf(b) === stayId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

/**
 * Change the rooms of a checked-in reservation room for the rest of its stay, night by night (ticket
 * 2.3). `request.nights` is the whole remaining stay with a room per night. Checks, in order: 404,
 * 409 `stale`, 409 `not-movable` (not checked in, locked room type), 400 (the nights are not exactly
 * the remaining ones, no change, rate choice missing), 409 `conflict` (a changed night's room is
 * booked or closed that night). Nothing changes when it throws. The stay is then rebuilt as one block
 * per run of consecutive nights in one room: nights already stayed become `previous` blocks
 * (checked out), the run holding the first remaining night keeps the reservation-room id.
 */
export function changeRoomDuringStay(
  state: ScheduleState,
  request: ChangeRoomRequest,
  rule: RoomChangeRule,
): ChangeRoomResult {
  const block = findBlock(state, request.reservationRoomId);
  if (block.roomChange && block.roomChange.stayId !== block.id) throw notFound('Reservation room');
  for (const night of request.nights) findRoom(state, night.roomId);
  assertCurrent(block, request);
  if (block.status !== 'checked-in') {
    throw notMovable('Only a checked-in room can change room during the stay');
  }
  const chain = chainOf(state, block.id);
  const start = chain[0].startDate;
  const end = chain.reduce((max, b) => (b.endDate > max ? b.endDate : max), block.endDate);
  const from = state.today > block.startDate ? state.today : block.startDate;
  // The server owns "today" (the club's, from its time zone): the client's effective date is advisory.
  if (from < end && request.nights[0].date !== from) {
    throw new ApiError(409, 'The effective date changed', {
      code: 'stale',
      details: { reason: ['effective-date'], today: [state.today] },
    });
  }
  if (from >= end || planProblem(request.nights, from, end) !== null) {
    throw invalidChange({ nights: ['Must list every night not yet stayed, once, in order'] });
  }
  const now = planFromBlocks(chain, from, end);
  const changed = changedNights(now, request.nights);
  if (changed.length === 0) throw invalidChange({ nights: ['No night changes room'] });
  const roomOf = (id: string) => findRoom(state, id);
  const currentType = roomOf(block.roomId).roomTypeId;
  if (
    block.roomTypeLocked &&
    request.nights.some((n) => roomOf(n.roomId).roomTypeId !== currentType)
  ) {
    throw notMovable('This reservation is locked to its room type');
  }
  // A changed night's room must be free that night: no other stay, no closure.
  const own = new Set(chain.map((b) => b.id));
  const planned = new Map(request.nights.map((n) => [n.date, n.roomId]));
  const clashes = changed.filter((date) => {
    const roomId = planned.get(date)!;
    const next = addDays(date, 1);
    return (
      state.blocks.some(
        (b) =>
          !own.has(b.id) &&
          b.roomId === roomId &&
          nightsOverlap(b.startDate, b.endDate, date, next),
      ) ||
      state.closures.some(
        (c) => c.roomId === roomId && nightsOverlap(c.startDate, c.endDate, date, next),
      )
    );
  });
  if (clashes.length) throw conflictError(clashes.map((d) => planned.get(d)!));

  // Prices per night, before the change.
  const ownerOf = (date: IsoDate) => chain.find((b) => b.startDate <= date && date < b.endDate)!;
  const nights = Array.from({ length: daysBetween(start, end) }, (_, i) => {
    const date = addDays(start, i);
    return { date, amountCents: nightRate(state, ownerOf(date), date) };
  });
  const rateOfRoom = (roomId: string) =>
    state.roomTypes.find((t) => t.id === roomOf(roomId).roomTypeId)?.nightlyRate ?? 0;
  const changedSet = new Set(changed);
  const rate = (choice: typeof request.rateChoice) =>
    rateOutcome({
      nights,
      newRateCents: (date) => rateOfRoom(planned.get(date) ?? ownerOf(date).roomId),
      today: state.today,
      choice,
      changed: (date) => changedSet.has(date),
    });
  const outcome = rate(request.rateChoice);
  if (rule.askRateOnRoomChange && rate('update').ratesDiffer && request.rateChoice === null) {
    throw invalidChange({ rateChoice: ['Required when the rates differ'] });
  }

  // ---- apply: rebuild the stay as runs ----
  // Every night of the stay, stayed ones included, merged by room: a stayed night in the same room as
  // the first remaining night belongs to the same block (which keeps its checked-in status).
  const runs = normalizeRuns([...planFromBlocks(chain, start, from), ...request.nights]);
  const currentIndex = runs.findIndex((r) => r.startDate <= from && from < r.endDate);
  const template = structuredClone(block);
  const early = chain.some((b) => b.earlyCheckIn);
  const late = chain.some((b) => b.lateCheckOut);
  const old = new Map(chain.map((b) => [`${b.roomId}|${b.startDate}|${b.endDate}`, b]));
  // Every night is priced again below from `outcome`; the old stored prices of this stay go.
  for (const key of Object.keys(state.rateOverrides)) {
    if (chain.some((b) => key.startsWith(`${b.id}|`))) delete state.rateOverrides[key];
  }

  const next: ScheduleBlock[] = runs.map((run, i) => {
    const reused = old.get(`${run.roomId}|${run.startDate}|${run.endDate}`);
    const isCurrent = i === currentIndex;
    // Ids of new blocks are opaque to clients; nothing parses them.
    const id = isCurrent
      ? block.id
      : reused && reused.id !== block.id
        ? reused.id
        : `${block.id}~${++state.segmentSeq}`;
    const out: ScheduleBlock = {
      ...template,
      id,
      roomId: run.roomId,
      startDate: run.startDate,
      endDate: run.endDate,
      status: i < currentIndex ? 'checked-out' : 'checked-in',
      earlyCheckIn: (early && i === 0) || undefined,
      lateCheckOut: (late && i === runs.length - 1) || undefined,
    };
    // A stay that is a single block again carries no link at all.
    if (runs.length > 1) {
      out.roomChange = {
        part: i < currentIndex ? 'previous' : isCurrent ? 'current' : 'next',
        index: i + 1,
        count: runs.length,
        stayId: block.id,
      };
    } else {
      delete out.roomChange;
    }
    return out;
  });
  // The ids that disappear, and the ones that stay (their stored price overrides move with them).
  const nextIds = new Set(next.map((b) => b.id));
  const removedBlockIds = chain.filter((b) => !nextIds.has(b.id)).map((b) => b.id);
  // The rebuilt blocks take the place of the old ones, so the order of the grid and of the rooms of a
  // multi-room reservation does not change.
  const at = state.blocks.findIndex((b) => own.has(b.id));
  state.blocks = state.blocks.filter((b) => !own.has(b.id));
  for (const b of next) bump(state, b);
  state.blocks.splice(at, 0, ...next);
  // Prices: a night whose price differs from its room type's rate (a retained rate, or an earlier
  // retained one) is stored as an override under the block that now holds it.
  const after = new Map(outcome.nights.map((n) => [n.date, n.amountCents]));
  for (const b of next) {
    const base = rateOfRoom(b.roomId);
    for (let date = b.startDate; date < b.endDate; date = addDays(date, 1)) {
      const price = after.get(date) ?? base;
      if (price !== base) state.rateOverrides[`${b.id}|${date}`] = price;
    }
  }

  // The room the guest sleeps in tonight, when it changed, needs housekeeping (PLACEHOLDER, 6.4).
  const tonightBefore = now[0].roomId;
  const tonightAfter = request.nights[0].roomId;
  let vacatedRoom: ChangeRoomResult['vacatedRoom'] = null;
  if (tonightBefore !== tonightAfter) {
    findRoom(state, tonightBefore).housekeeping = 'dirty';
    vacatedRoom = { roomId: tonightBefore, housekeeping: 'dirty', since: from };
  }
  return {
    blocks: chainOf(state, block.id).map((b) => structuredClone(b)),
    removedBlockIds,
    folio: {
      deltaCents: outcome.deltaCents,
      repricedNights: outcome.repricedNights,
      roomChargesCents: outcome.nights.reduce((sum, n) => sum + n.amountCents, 0),
    },
    vacatedRoom,
  };
}
