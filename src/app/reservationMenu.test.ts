import type { ReservationRoomDetail } from '../api/types';
import {
  canUndoCheckIn,
  canUndoRoomCheckIn,
  cancelConfirmation,
  menuState,
  nightAuditHasRun,
  registrationCardUrl,
  reservationMenu,
  type MenuInput,
} from './reservationMenu';

type Status = ReservationRoomDetail['status'];
const room = (
  status: Status,
  extra: Partial<ReservationRoomDetail> = {},
): ReservationRoomDetail => ({
  id: `rr-${Math.random()}`,
  roomId: 'rm-1',
  roomNumber: '10',
  locationName: 'L',
  roomTypeName: 'T',
  status,
  arrival: '2026-10-20',
  departure: '2026-10-23',
  ...extra,
});
const input = (statuses: Status[], extra: Partial<MenuInput> = {}): MenuInput => ({
  status: 'confirmed',
  rooms: statuses.map((s) => room(s)),
  lastAuditedDate: '2026-10-19',
  canEdit: true,
  ...extra,
});
const labels = (i: MenuInput) => reservationMenu(i).map((a) => a.label);

describe('reservationMenu', () => {
  it('not yet checked in', () => {
    expect(labels(input(['nyci']))).toEqual([
      'Edit Reservation',
      'Cancel Reservation',
      'Add Another Room',
      'Print Registration Card(s)',
      'Jump to Folio',
    ]);
  });

  it('unassigned: Assign Room replaces Edit Reservation', () => {
    const i = input(['nyci']);
    i.rooms[0].roomId = null;
    i.rooms[0].roomNumber = null;
    expect(labels(i)).toEqual([
      'Assign Room',
      'Cancel Reservation',
      'Add Another Room',
      'Print Registration Card(s)',
      'Jump to Folio',
    ]);
  });

  it('checked in, night audit not run: Undo Check In first, Add Another Room kept', () => {
    expect(labels(input(['checked-in']))).toEqual([
      'Undo Check In',
      'Edit Reservation',
      'Add Another Room',
      'Print Registration Card(s)',
      'Jump to Folio',
    ]);
    // Some rooms in house and others still waiting is still "checked in" (no Cancel).
    expect(labels(input(['checked-in', 'nyci']))).toContain('Undo Check In');
    expect(labels(input(['checked-in', 'nyci']))).not.toContain('Cancel Reservation');
  });

  it('checked in, night audit run for the business date: Undo Check In goes, Add Another Room stays', () => {
    const after = input(['checked-in'], { lastAuditedDate: '2026-10-20' });
    expect(labels(after)).toEqual([
      'Edit Reservation',
      'Add Another Room',
      'Print Registration Card(s)',
      'Jump to Folio',
    ]);
  });

  it('unknown audit data hides Undo Check In but keeps Add Another Room', () => {
    const unknown = input(['checked-in'], { lastAuditedDate: undefined });
    expect(labels(unknown)).toEqual([
      'Edit Reservation',
      'Add Another Room',
      'Print Registration Card(s)',
      'Jump to Folio',
    ]);
    expect(labels(input(['checked-in'], { lastAuditedDate: null }))).toContain('Undo Check In');
  });

  it('checked out or partly checked out: Print and Jump to Folio; cancelled: Jump to Folio', () => {
    const both = ['Print Registration Card(s)', 'Jump to Folio'];
    expect(labels(input(['checked-out']))).toEqual(both);
    expect(labels(input(['checked-out', 'checked-in']))).toEqual(both);
    expect(labels(input(['nyci'], { status: 'cancelled' }))).toEqual(['Jump to Folio']);
  });

  it('without edit permission only Print and Jump to Folio remain', () => {
    expect(labels(input(['nyci'], { canEdit: false }))).toEqual([
      'Print Registration Card(s)',
      'Jump to Folio',
    ]);
    expect(labels(input(['checked-in'], { canEdit: false }))).toEqual([
      'Print Registration Card(s)',
      'Jump to Folio',
    ]);
  });
});

describe('menuState', () => {
  it('derives the state from the rooms and status', () => {
    expect(menuState(input(['nyci']))).toBe('not-checked-in');
    expect(menuState(input(['checked-in', 'nyci']))).toBe('checked-in');
    expect(menuState(input(['checked-out', 'nyci']))).toBe('partly-checked-out');
    expect(menuState(input(['checked-out', 'checked-out']))).toBe('checked-out');
    expect(menuState(input(['checked-in'], { status: 'cancelled' }))).toBe('cancelled');
  });
});

describe('night audit rule', () => {
  it('a date is closed once the last audited date reaches it', () => {
    expect(nightAuditHasRun('2026-10-20', '2026-10-19')).toBe(false);
    expect(nightAuditHasRun('2026-10-20', '2026-10-20')).toBe(true);
    expect(nightAuditHasRun('2026-10-20', '2026-10-25')).toBe(true);
    expect(nightAuditHasRun('2026-10-20', null)).toBe(false);
    expect(nightAuditHasRun('2026-10-20', undefined)).toBeNull();
  });

  it('a room cannot be undone once another room of the reservation has checked out', () => {
    const rooms = [room('checked-in'), room('checked-out')];
    expect(canUndoRoomCheckIn(rooms, rooms[0], '2026-10-19')).toBe(false);
    const inHouse = [room('checked-in'), room('nyci')];
    expect(canUndoRoomCheckIn(inHouse, inHouse[0], '2026-10-19')).toBe(true);
    expect(canUndoRoomCheckIn(inHouse, inHouse[0], '2026-10-20')).toBe(false);
  });

  it('a room can be undone only while checked in and before the audit', () => {
    const r = room('checked-in');
    expect(canUndoCheckIn(r, '2026-10-19')).toBe(true);
    expect(canUndoCheckIn(r, '2026-10-20')).toBe(false);
    expect(canUndoCheckIn(room('nyci'), '2026-10-19')).toBe(false);
    expect(canUndoCheckIn(r, undefined)).toBe(false);
  });
});

describe('print and cancel copy', () => {
  it('the registration card URL is a stub path with the id encoded', () => {
    expect(registrationCardUrl('rs 1')).toBe('/files/registration-cards/rs%201.pdf');
  });

  it('names one reservation or all rooms', () => {
    expect(cancelConfirmation({ confirmationNumber: 'GR-1', rooms: 1 })).toMatchObject({
      title: 'Cancel this reservation?',
      confirmLabel: 'Yes, Cancel Reservation',
      keepLabel: 'No, Keep Reservation',
    });
    expect(cancelConfirmation({ confirmationNumber: 'GR-1', rooms: 3 })).toMatchObject({
      title: 'Cancel all rooms?',
    });
  });
});
