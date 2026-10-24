// Cancel and undo check in (ticket 2.5): request guards, kept apart from the shared validation.ts.
import { ApiError } from './types';
import type { CancelReservationRequest, UndoCheckInRequest } from './types';
import { assertRequestId, assertResourceId } from './validation';

const version = (v: unknown) => typeof v === 'string' && v !== '' && v.length <= 128;

function assertGuard(request: { requestId: string; reservationId: string; version: string }) {
  assertRequestId(request.requestId);
  assertResourceId(request.reservationId, 'reservation');
  if (!version(request.version)) {
    throw new ApiError(400, 'Invalid reservation version', { code: 'invalid-query' });
  }
}

export function assertCancelReservationRequest(request: CancelReservationRequest): void {
  assertGuard(request);
}

export function assertUndoCheckInRequest(request: UndoCheckInRequest): void {
  assertGuard(request);
  if (request.reservationRoomId !== undefined) {
    assertResourceId(request.reservationRoomId, 'reservation room');
  }
}
