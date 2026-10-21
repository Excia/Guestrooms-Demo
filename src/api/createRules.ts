// Rules shared by the mock and the HTTP response guard for `reservations.create`.
import type { CreateReservationRequest } from './types';
import { GUEST_TBD } from './types';

/** Who the new reservation's lead occupant must be, given the request. */
export function expectedLeadOccupantName(
  request: Pick<CreateReservationRequest, 'bookingGuestRole' | 'guestName' | 'leadOccupant'>,
): string {
  if (request.bookingGuestRole === 'occupant') return request.guestName.trim();
  return request.leadOccupant?.name.trim() || GUEST_TBD;
}
