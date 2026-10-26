import { functionPermission, type FunctionPermission, type Permissions } from './permissions';

// Legacy "lock" icons next to Location, Room Type and Room of a reservation room: they start locked
// for a user without the matching function (Permissions page), and a manager's PIN unlocks one field
// (ticket 187 follow-up, owner decision "match legacy"). Pure rules, shared by the UI and the mock backend.

export type UnlockField = 'location' | 'roomType' | 'room';

export const UNLOCK_FIELDS: readonly UnlockField[] = ['location', 'roomType', 'room'];

/** The function a user needs to change each field without a PIN. */
export const UNLOCK_PERMISSION: Readonly<Record<UnlockField, FunctionPermission>> = {
  location: functionPermission('changeReservationLocation'),
  roomType: functionPermission('changeReservationRoomType'),
  room: functionPermission('changeReservationRoom'),
};

export const UNLOCK_LABEL: Readonly<Record<UnlockField, string>> = {
  location: 'Location',
  roomType: 'Room Type',
  room: 'Room',
};

/** Fields the user may not change yet: no function, and not unlocked with a PIN in this session of the panel. */
export function lockedFields(
  can: Permissions['can'],
  unlocked: ReadonlySet<UnlockField>,
): ReadonlySet<UnlockField> {
  return new Set(UNLOCK_FIELDS.filter((f) => !can(UNLOCK_PERMISSION[f]) && !unlocked.has(f)));
}

interface RoomFacts {
  roomTypeId: string;
  locationId: string;
}

/**
 * The fields a plan changes, night by night: the room changes whenever the id does; the room type and
 * location when the new room differs from the old one in them.
 */
export function changedFields(
  nights: readonly { from: RoomFacts & { id: string }; to: RoomFacts & { id: string } }[],
): ReadonlySet<UnlockField> {
  const out = new Set<UnlockField>();
  for (const { from, to } of nights) {
    if (from.id === to.id) continue;
    out.add('room');
    if (from.roomTypeId !== to.roomTypeId) out.add('roomType');
    if (from.locationId !== to.locationId) out.add('location');
  }
  return out;
}

/** The functions a change needs that the user lacks: each one needs the PIN of a holder. */
export function missingFunctions(
  changed: ReadonlySet<UnlockField>,
  can: Permissions['can'],
): FunctionPermission[] {
  return UNLOCK_FIELDS.filter((f) => changed.has(f) && !can(UNLOCK_PERMISSION[f])).map(
    (f) => UNLOCK_PERMISSION[f],
  );
}
