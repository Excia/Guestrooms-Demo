// Mock check in on any date (ticket 163), on the schedule's in-memory state. Replaced by the
// backend later. A past-date check in charges the nights before today to the folio; an automatic
// check out (departure passed) charges the rest and leaves the room needing cleaning.
import { nightsOverlap, type IsoDate } from '../lib/dates';
import { departurePassed, type ClubClock } from '../lib/clubTime';
import { stayOf } from '../lib/stayPlan';
import type { CheckInLevel } from '../app/permissions';
import { getFolio } from './folioData';
import type { FolioStore } from './folioData';
import { buildDetail, extrasFor, roomNotReady } from './reservationDetailData';
import { hasPaymentOnFile } from './reservationListData';
import { bump } from './scheduleData';
import type { ScheduleState } from './scheduleData';
import type {
  AddPaymentMethodRequest,
  CheckInFailureCode,
  CheckInReservationRequest,
  CheckInReservationResult,
  CheckInRoomOutcome,
  Folio,
  ReservationDetail,
  ScheduleBlock,
  SplitRoomRequest,
} from './types';
import { ApiError } from './types';

/**
 * PLACEHOLDER (P-163-1): the one override code the mock accepts, until the real PIN prompt and
 * validation (ticket 127). It is not a secret; it stands in for a manager's PIN.
 */
export const MOCK_OVERRIDE_CODE = '4321';

export const isMockOverrideCode = (code: string | undefined) => code === MOCK_OVERRIDE_CODE;

const conflict = (code: string, message: string) => new ApiError(409, message, { code });
const notFound = () => new ApiError(404, 'Reservation not found');

const groupOf = (state: ScheduleState, reservationId: string): ScheduleBlock[] =>
  [...state.blocks, ...state.unassigned].filter((b) => b.reservationId === reservationId);

/** Mock payment rule: a placeholder hash, plus a card added through the placeholder dialog. */
export const paymentOnFile = (state: ScheduleState, reservationId: string): boolean =>
  extrasFor(state, reservationId).paymentAdded === true || hasPaymentOnFile(reservationId);

export interface CheckInEnv {
  /** The instant the request is handled; recorded as the check in / out time. */
  now: Date;
  /** The club's clock at that instant. */
  clock: ClubClock;
  checkOutTime: string;
  level: CheckInLevel;
}

/** The check in outcome per room, before the reservation is rebuilt. */
export type CheckInApplied = Omit<CheckInReservationResult, 'reservation'>;

function failureFor(
  state: ScheduleState,
  block: ScheduleBlock,
  hasPayment: boolean,
): CheckInFailureCode | null {
  if (block.status !== 'nyci' && block.status !== 'confirmed') return 'not-checkable';
  if (state.unassigned.includes(block) || !block.roomId) return 'unassigned';
  if (roomNotReady(state, block)) return 'room-not-ready';
  const occupied = state.blocks.some(
    (o) =>
      o !== block &&
      o.reservationId !== block.reservationId &&
      o.roomId === block.roomId &&
      o.status === 'checked-in' &&
      nightsOverlap(o.startDate, o.endDate, block.startDate, block.endDate),
  );
  if (occupied) return 'occupied';
  return hasPayment ? null : 'no-payment-method';
}

/** Posts the room's unposted room-rate nights dated before `before`; returns how many. */
function postNights(folio: Folio, reservationRoomId: string, before: IsoDate | null): number {
  let posted = 0;
  for (const charge of folio.charges) {
    if (
      charge.type === 'room-rate' &&
      charge.roomId === reservationRoomId &&
      charge.status === 'unposted' &&
      (before === null || charge.date < before)
    ) {
      charge.status = 'posted';
      posted++;
    }
  }
  return posted;
}

const stayDeparture = (state: ScheduleState, block: ScheduleBlock): IsoDate =>
  groupOf(state, block.reservationId)
    .filter((p) => stayOf(p) === block.id)
    .reduce((max, p) => (p.endDate > max ? p.endDate : max), block.endDate);

/**
 * Checks in the requested rooms as the backend would. Whole-request problems throw (see
 * `CheckInReservationRequest`); a room that cannot be checked in is reported in its outcome and does
 * not stop the others.
 */
export function checkInReservation(
  state: ScheduleState,
  folioStore: FolioStore,
  env: CheckInEnv,
  request: CheckInReservationRequest,
): CheckInApplied {
  if (env.level === 'never') {
    throw new ApiError(403, 'You may not check in', { code: 'forbidden' });
  }
  const group = groupOf(state, request.reservationId);
  if (group.length === 0) throw notFound();
  const extras = extrasFor(state, request.reservationId);
  if (extras.version !== request.version) throw conflict('stale', 'This reservation changed since it was loaded');

  const current = group.filter(
    (b) => b.roomChange?.part !== 'previous' && b.roomChange?.part !== 'next',
  );
  const blocks = request.reservationRoomIds.map((id) => {
    const found = current.find((b) => b.id === id);
    if (!found) throw new ApiError(404, 'Reservation room not found');
    return found;
  });

  const waiting = blocks.filter((b) => b.status === 'nyci' || b.status === 'confirmed');
  if (waiting.some((b) => b.startDate > env.clock.date)) {
    throw conflict('future-arrival', 'Check in is only allowed on the arrival date');
  }
  if (waiting.some((b) => b.startDate < env.clock.date)) {
    if (!request.pastDateConfirmed) {
      throw conflict('past-date-unconfirmed', 'Confirm that you want to check in for a prior date');
    }
    if (env.level === 'arrival-date-only') {
      if (!request.overrideCode) {
        throw new ApiError(403, 'An override code is needed to check in after the arrival date', {
          code: 'override-required',
        });
      }
      if (!isMockOverrideCode(request.overrideCode)) {
        throw new ApiError(403, 'That override code is not valid', { code: 'override-invalid' });
      }
    }
  }

  // The folio must exist before anything changes, so its nights start out unposted for rooms that
  // have not checked in.
  const folio = (getFolio(state, folioStore, request.reservationId), folioStore.get(request.reservationId)!);
  const hasPayment = paymentOnFile(state, request.reservationId);
  const stamp = env.now.toISOString();
  const stamps = (extras.stamps ??= {});
  const rooms: CheckInRoomOutcome[] = [];
  let nightsPosted = 0;
  let autoCheckedOut = false;

  for (const block of blocks) {
    const failure = failureFor(state, block, hasPayment);
    if (failure) {
      rooms.push({ reservationRoomId: block.id, checkedIn: false, failure });
      continue;
    }
    block.status = 'checked-in';
    stamps[block.id] = { ...stamps[block.id], checkedInAt: stamp };
    nightsPosted += postNights(folio, block.id, env.clock.date);
    const outcome: CheckInRoomOutcome = {
      reservationRoomId: block.id,
      checkedIn: true,
      checkedInAt: stamp,
    };
    const departure = stayDeparture(state, block);
    if (request.checkOutAfter && departurePassed(departure, env.checkOutTime, env.clock)) {
      block.status = 'checked-out';
      block.housekeeping = 'needs-cleaning';
      stamps[block.id] = { ...stamps[block.id], checkedOutAt: stamp };
      nightsPosted += postNights(folio, block.id, null);
      outcome.checkedOutAt = stamp;
      autoCheckedOut = true;
    }
    bump(state, block);
    rooms.push(outcome);
  }

  if (rooms.some((r) => r.checkedIn)) {
    extras.version = `r${++state.versionSeq}`;
    const status = buildDetail(state, request.reservationId).status;
    folio.checkInStatus =
      status === 'checked-in' ? 'checked-in' : status === 'checked-out' ? 'checked-out' : 'not-checked-in';
  }
  return { rooms, autoCheckedOut, nightsPosted, integrationErrors: [] };
}

/** Puts a mock card on file (the placeholder Payment Methods dialog, ticket 3.9). */
export function addPaymentMethod(
  state: ScheduleState,
  request: AddPaymentMethodRequest,
): ReservationDetail {
  const detail = buildDetail(state, request.reservationId); // 404 when unknown
  const extras = extrasFor(state, detail.id);
  extras.paymentAdded = true;
  extras.version = `r${++state.versionSeq}`;
  return { ...buildDetail(state, detail.id) };
}

/**
 * Splits one room off a multi-room reservation: it becomes a reservation of its own (new id and
 * confirmation number) and the old one keeps the rest. Answers the new reservation.
 */
export function splitRoom(
  state: ScheduleState,
  folioStore: FolioStore,
  request: SplitRoomRequest,
): ReservationDetail {
  const group = groupOf(state, request.reservationId);
  if (group.length === 0) throw notFound();
  const extras = extrasFor(state, request.reservationId);
  if (extras.version !== request.version) throw conflict('stale', 'This reservation changed since it was loaded');
  const current = group.filter(
    (b) => b.roomChange?.part !== 'previous' && b.roomChange?.part !== 'next',
  );
  const target = current.find((b) => b.id === request.reservationRoomId);
  if (!target) throw new ApiError(404, 'Reservation room not found');
  if (current.length < 2) throw conflict('not-splittable', 'A one-room reservation cannot be split');

  const seq = ++state.createdSeq;
  const reservationId = `rs-split-${seq}`;
  const confirmationNumber = `GR-${80000 + seq}`;
  for (const block of group.filter((b) => stayOf(b) === target.id)) {
    block.reservationId = reservationId;
    block.confirmationNumber = confirmationNumber;
    block.roomCount = 1;
    bump(state, block);
  }
  const rest = current.filter((b) => b !== target);
  for (const block of group.filter((b) => rest.some((r) => stayOf(b) === r.id))) {
    block.roomCount = rest.length;
    bump(state, block);
  }
  const moved = extras.stamps?.[target.id];
  state.extras[reservationId] = {
    ...structuredClone(extras),
    version: 'r1',
    stamps: moved ? { [target.id]: moved } : undefined,
  };
  if (extras.stamps && moved) delete extras.stamps[target.id];
  extras.version = `r${++state.versionSeq}`;
  folioStore.delete(request.reservationId);
  folioStore.delete(reservationId);
  return buildDetail(state, reservationId);
}
