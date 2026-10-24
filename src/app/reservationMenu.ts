// The reservation actions menu (Figma "Reservation Menus", ticket 2.5): which entries a reservation
// shows in each state, and the Undo Check In rule around the night audit. Pure: the component only
// renders the answer.
import type { IsoDate } from '../lib/dates';
import type { ReservationDetail, ReservationRoomDetail } from '../api/types';

export type MenuActionId =
  | 'undo-check-in'
  | 'edit-reservation'
  | 'assign-room'
  | 'cancel-reservation'
  | 'add-room'
  | 'print-registration-card'
  | 'jump-to-folio';

export interface MenuAction {
  id: MenuActionId;
  label: string;
}

const LABELS: Record<MenuActionId, string> = {
  'undo-check-in': 'Undo Check In',
  'edit-reservation': 'Edit Reservation',
  'assign-room': 'Assign Room',
  'cancel-reservation': 'Cancel Reservation',
  'add-room': 'Add Another Room',
  'print-registration-card': 'Print Registration Card(s)',
  'jump-to-folio': 'Jump to Folio',
};

const action = (id: MenuActionId): MenuAction => ({ id, label: LABELS[id] });

export type MenuInput = Pick<ReservationDetail, 'status' | 'rooms' | 'lastAuditedDate'> & {
  /** Holds `reservation.edit`: without it only Print and Jump to Folio remain. */
  canEdit?: boolean;
};

export type MenuState =
  'not-checked-in' | 'checked-in' | 'partly-checked-out' | 'checked-out' | 'cancelled';

/**
 * - cancelled: the reservation status says so.
 * - checked-out: every room has left; partly-checked-out: some have, others have not.
 * - checked-in: some room is in house and none has left (the others may still wait to check in).
 * - not-checked-in: nothing has happened yet.
 */
export function menuState(input: Pick<MenuInput, 'status' | 'rooms'>): MenuState {
  if (input.status === 'cancelled') return 'cancelled';
  const { rooms } = input;
  const out = rooms.filter((r) => r.status === 'checked-out').length;
  if (out > 0) return out === rooms.length ? 'checked-out' : 'partly-checked-out';
  return rooms.some((r) => r.status === 'checked-in') ? 'checked-in' : 'not-checked-in';
}

/** True when the night audit has closed `date`; null when it is not known (no audit data sent). */
export function nightAuditHasRun(
  date: IsoDate,
  lastAuditedDate: IsoDate | null | undefined,
): boolean | null {
  if (lastAuditedDate === undefined) return null;
  return lastAuditedDate !== null && lastAuditedDate >= date;
}

/**
 * Undo Check In is offered while the night audit has not run for the room's check-in business date
 * (taken as its arrival date) and the room is checked in. Unknown audit data hides it: the backend
 * would refuse an undo it cannot be sure of, and "Remove after NA run" says to take it away.
 */
export function canUndoCheckIn(
  room: Pick<ReservationRoomDetail, 'status' | 'arrival'>,
  lastAuditedDate: IsoDate | null | undefined,
): boolean {
  return room.status === 'checked-in' && nightAuditHasRun(room.arrival, lastAuditedDate) === false;
}

/** Whole-reservation undo: every checked-in room can be undone (the backend undoes them together). */
export function canUndoReservationCheckIn(
  input: Pick<MenuInput, 'status' | 'rooms' | 'lastAuditedDate'>,
): boolean {
  if (menuState(input) !== 'checked-in') return false;
  return input.rooms
    .filter((r) => r.status === 'checked-in')
    .every((r) => canUndoCheckIn(r, input.lastAuditedDate));
}

/** True when a room waiting for check in has no room assigned yet. */
export const hasUnassignedRoom = (rooms: readonly ReservationRoomDetail[]) =>
  rooms.some((r) => r.status === 'nyci' && r.roomId === null);

/**
 * The menu behind the split button, in Figma order.
 * - Not yet checked in: Edit Reservation (Assign Room when a room is unassigned), Cancel
 *   Reservation, Add Another Room, Print Registration Card(s), Jump to Folio.
 * - Checked in: Undo Check In (until the night audit has run), Edit Reservation, Add Another Room
 *   (not once the audit has run, as Figma's "before NA"), Print, Jump to Folio.
 * - Checked out or partly checked out: Print, Jump to Folio. Cancelled: Jump to Folio.
 */
export function reservationMenu(input: MenuInput): MenuAction[] {
  const state = menuState(input);
  const canEdit = input.canEdit ?? true;
  const ids: MenuActionId[] = [];
  const edit = hasUnassignedRoom(input.rooms) ? 'assign-room' : 'edit-reservation';
  if (state === 'not-checked-in') {
    if (canEdit) ids.push(edit, 'cancel-reservation', 'add-room');
    ids.push('print-registration-card');
  } else if (state === 'checked-in') {
    if (canEdit) {
      if (canUndoReservationCheckIn(input)) ids.push('undo-check-in');
      ids.push(edit);
      const auditRan = input.rooms.some(
        (r) =>
          r.status === 'checked-in' && nightAuditHasRun(r.arrival, input.lastAuditedDate) === true,
      );
      if (!auditRan) ids.push('add-room');
    }
    ids.push('print-registration-card');
  } else if (state !== 'cancelled') {
    ids.push('print-registration-card');
  }
  ids.push('jump-to-folio');
  return ids.map(action);
}

/** Where Print Registration Card(s) opens. Stub: the backend will generate the PDF (D-003). */
export const registrationCardUrl = (reservationId: string) =>
  `/files/registration-cards/${encodeURIComponent(reservationId)}.pdf`;

/** Copy of the Cancel Reservation confirmation (not in Figma: Q-22-1). */
export function cancelConfirmation(input: { confirmationNumber: string; rooms: number }) {
  const all = input.rooms > 1;
  return {
    title: all ? 'Cancel all rooms?' : 'Cancel this reservation?',
    message:
      `Reservation #${input.confirmationNumber}${all ? ` (${input.rooms} rooms)` : ''} will be cancelled and removed from the schedule. ` +
      'This cannot be undone.',
    confirmLabel: all ? 'Cancel All Rooms' : 'Cancel Reservation',
    keepLabel: 'Keep Reservation',
  };
}
