// Check in on past dates (ticket 163): request guards, kept apart from the shared validation.ts.
import { ApiError } from './types';
import type {
  AddPaymentMethodRequest,
  CheckInReservationRequest,
  SplitRoomRequest,
  VerifyOverrideCodeRequest,
} from './types';
import { assertRequestId, assertResourceId } from './validation';

const invalid = (what: string) => new ApiError(400, `Invalid ${what}`, { code: 'invalid-query' });

const version = (v: unknown) => typeof v === 'string' && v !== '' && v.length <= 128;

/** An override code is a short PIN; never logged or echoed. */
const MAX_CODE = 32;
/** One reservation has far fewer rooms; the cap only keeps a request small. */
const MAX_ROOMS = 50;

export function assertCheckInReservationRequest(request: CheckInReservationRequest): void {
  assertRequestId(request.requestId);
  assertResourceId(request.reservationId, 'reservation');
  if (!version(request.version)) throw invalid('reservation version');
  const ids = request.reservationRoomIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_ROOMS) {
    throw invalid('reservation rooms');
  }
  for (const id of ids) assertResourceId(id, 'reservation room');
  if (new Set(ids).size !== ids.length) throw invalid('reservation rooms');
  if (typeof request.pastDateConfirmed !== 'boolean') throw invalid('past date flag');
  if (typeof request.checkOutAfter !== 'boolean') throw invalid('check out flag');
  if (
    request.overrideCode !== undefined &&
    (typeof request.overrideCode !== 'string' ||
      request.overrideCode === '' ||
      request.overrideCode.length > MAX_CODE)
  ) {
    throw invalid('override code');
  }
}

export function assertVerifyOverrideCodeRequest(request: VerifyOverrideCodeRequest): void {
  if (request.permission !== 'reservation.check-in.any-time') throw invalid('permission');
  if (
    typeof request.code !== 'string' ||
    request.code.trim() === '' ||
    request.code.length > MAX_CODE
  ) {
    throw invalid('override code');
  }
}

export function assertSplitRoomRequest(request: SplitRoomRequest): void {
  assertRequestId(request.requestId);
  assertResourceId(request.reservationId, 'reservation');
  assertResourceId(request.reservationRoomId, 'reservation room');
  if (!version(request.version)) throw invalid('reservation version');
}

export function assertAddPaymentMethodRequest(request: AddPaymentMethodRequest): void {
  assertRequestId(request.requestId);
  assertResourceId(request.reservationId, 'reservation');
}
