// The reservation panel's split CTA (Figma "Res Panel Split CTAs", frames RDP - ..., and the
// "Reservation Menus" / "Split CTA Menu" frames). Which primary action and which menu entries a
// reservation gets, from its state. Pure: the component only renders the answer. The menu behind
// the arrow is `reservationMenu` (src/app/reservationMenu.ts, ticket 2.5).
import type { ReservationDetail } from '../api/types';

export type CtaActionId =
  | 'check-in'
  | 'check-in-all'
  | 'check-in-remaining'
  | 'check-out'
  | 'check-out-all'
  | 'check-out-remaining'
  | 'manage';

export interface CtaAction {
  id: CtaActionId;
  label: string;
}

export interface SplitCta {
  primary: CtaAction & {
    /** 'contained' for check in/out; Manage Reservation is outlined (Figma). */
    variant: 'contained' | 'outlined';
    /** Why the primary action cannot run right now, or null. */
    blockedReason: string | null;
  };
}

const LABELS: Record<CtaActionId, string> = {
  'check-in': 'Check In',
  'check-in-all': 'Check In All Rooms',
  'check-in-remaining': 'Check In Remaining Rooms',
  'check-out': 'Check Out',
  'check-out-all': 'Check Out All Rooms',
  'check-out-remaining': 'Check Out Remaining Rooms',
  manage: 'Manage Reservation',
};

const action = (id: CtaActionId): CtaAction => ({ id, label: LABELS[id] });

export const UNASSIGNED_REASON = 'Assign a room before checking in.';

type CtaInput = Pick<ReservationDetail, 'status' | 'rooms'>;

/**
 * - Cancelled, or every room checked out: "Manage Reservation" (outlined).
 * - Nothing checked in yet: "Check In" (one room) or "Check In All Rooms".
 * - Some rooms checked in or out but others not yet checked in: "Check In Remaining Rooms".
 * - Everything left is in house: "Check Out" / "Check Out All Rooms", or "Check Out Remaining
 *   Rooms" once some room has already left.
 * Check in is blocked while a room it would check in has no room assigned.
 */
export function splitCta(reservation: CtaInput): SplitCta {
  const { rooms } = reservation;
  const count = (status: ReservationDetail['rooms'][number]['status']) =>
    rooms.filter((r) => r.status === status).length;
  const nyci = count('nyci');
  const inHouse = count('checked-in');
  const out = count('checked-out');
  const multi = rooms.length > 1;

  if (reservation.status === 'cancelled' || (nyci === 0 && inHouse === 0)) {
    return {
      primary: { ...action('manage'), variant: 'outlined', blockedReason: null },
    };
  }

  let id: CtaActionId;
  if (nyci > 0) {
    id = !multi ? 'check-in' : inHouse + out === 0 ? 'check-in-all' : 'check-in-remaining';
  } else {
    id = !multi ? 'check-out' : out === 0 ? 'check-out-all' : 'check-out-remaining';
  }
  const blockedReason =
    nyci > 0 && rooms.some((r) => r.status === 'nyci' && r.roomId === null)
      ? UNASSIGNED_REASON
      : null;
  return {
    primary: { ...action(id), variant: 'contained', blockedReason },
  };
}

/** Where each action goes until the ticket that builds it exists (see the report). */
export const STUB_TICKETS: Partial<Record<CtaActionId, string>> = {
  'check-in': 'Check in arrives with the Reservation Hub (ticket 3.12).',
  'check-in-all': 'Check in arrives with the Reservation Hub (ticket 3.12).',
  'check-in-remaining': 'Check in arrives with the Reservation Hub (ticket 3.12).',
  'check-out': 'Check out arrives with the Reservation Hub (ticket 3.12).',
  'check-out-all': 'Check out arrives with the Reservation Hub (ticket 3.12).',
  'check-out-remaining': 'Check out arrives with the Reservation Hub (ticket 3.12).',
  manage: 'The Reservation Hub arrives with ticket 3.12.',
};
