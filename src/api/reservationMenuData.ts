// Mock cancel and undo check in (ticket 2.5), on the schedule's in-memory state. Replaced by the
// backend later.
import { addDays, type IsoDate } from '../lib/dates';
import { buildDetail, extrasFor } from './reservationDetailData';
import { bump } from './scheduleData';
import type { ScheduleState } from './scheduleData';
import type {
  CancelReservationRequest,
  ReservationDetail,
  ScheduleBlock,
  UndoCheckInRequest,
} from './types';
import { ApiError } from './types';

/** Cancelled reservations leave the grid; their last detail is kept so the panel can still open. */
export type CancelledStore = Map<string, ReservationDetail>;

/** The mock club's last audited business date: the night before the schedule's "today". */
export const mockLastAuditedDate = (today: IsoDate): IsoDate => addDays(today, -1);

const conflict = (code: string, message: string) => new ApiError(409, message, { code });

const stale = () => conflict('stale', 'This reservation changed since it was loaded');

const blocksOf = (state: ScheduleState, reservationId: string): ScheduleBlock[] =>
  [...state.blocks, ...state.unassigned].filter((b) => b.reservationId === reservationId);

function bumpVersion(state: ScheduleState, reservationId: string): string {
  const extras = extrasFor(state, reservationId);
  extras.version = `r${++state.versionSeq}`;
  return extras.version;
}

export function cancelReservation(
  state: ScheduleState,
  cancelled: CancelledStore,
  request: CancelReservationRequest,
  lastAuditedDate: IsoDate,
): ReservationDetail {
  if (cancelled.has(request.reservationId)) {
    throw conflict('not-cancellable', 'This reservation is already cancelled');
  }
  const detail = buildDetail(state, request.reservationId); // 404 when unknown
  if (detail.version !== request.version) throw stale();
  if (detail.rooms.some((r) => r.status !== 'nyci')) {
    throw conflict(
      'not-cancellable',
      'A reservation with a checked-in or checked-out room cannot be cancelled',
    );
  }
  const version = bumpVersion(state, request.reservationId);
  const answer: ReservationDetail = {
    ...detail,
    status: 'cancelled',
    version,
    lastAuditedDate,
  };
  cancelled.set(request.reservationId, structuredClone(answer));
  const ids = new Set(blocksOf(state, request.reservationId));
  state.blocks = state.blocks.filter((b) => !ids.has(b));
  state.unassigned = state.unassigned.filter((b) => !ids.has(b));
  return answer;
}

export function undoCheckIn(
  state: ScheduleState,
  request: UndoCheckInRequest,
  lastAuditedDate: IsoDate,
): ReservationDetail {
  const detail = buildDetail(state, request.reservationId); // 404 when unknown
  if (detail.version !== request.version) throw stale();
  const targets = blocksOf(state, request.reservationId).filter(
    (b) =>
      b.status === 'checked-in' &&
      (request.reservationRoomId === undefined || b.id === request.reservationRoomId),
  );
  if (targets.length === 0 || detail.rooms.some((r) => r.status === 'checked-out')) {
    throw conflict('not-checked-in', 'There is no check in to undo');
  }
  // The check-in business date is taken as the room's arrival date (the mock keeps no check-in log).
  if (targets.some((b) => b.startDate <= lastAuditedDate)) {
    throw conflict('audit-closed', 'The night audit has already run for this check in');
  }
  for (const block of targets) {
    block.status = block.startDate <= state.today ? 'nyci' : 'confirmed';
    delete block.housekeeping; // not checked in again: nothing stored (it shows NYCI)
    bump(state, block);
  }
  const version = bumpVersion(state, request.reservationId);
  return { ...buildDetail(state, request.reservationId), version, lastAuditedDate };
}
