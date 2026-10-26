import type { OverridePermission } from '../api/types';
import type { Permissions } from './permissions';

// Legacy "lock" icons next to Location, Room Type and Room of a reservation room: they start locked
// for a user without the matching function (Permissions page), and a manager's PIN unlocks one field
// (ticket 187 follow-up, owner decision "match legacy"). Pure rules, shared by the UI and the mock backend.

export type UnlockField = 'location' | 'roomType' | 'room';

export const UNLOCK_FIELDS: readonly UnlockField[] = ['location', 'roomType', 'room'];

/** The function a user needs to change each field without a PIN. */
export const UNLOCK_PERMISSION: Readonly<Record<UnlockField, OverridePermission>> = {
  location: 'function.changeReservationLocation',
  roomType: 'function.changeReservationRoomType',
  room: 'function.changeReservationRoom',
};

/** The PIN that unlocked each field: one per field (legacy kept only the last one). */
export type UnlockCodes = Partial<Record<UnlockField, string>>;

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

/** The fields a change touches that are still locked: what must be unlocked before it can be saved. */
export function fieldsToUnlock(
  changed: ReadonlySet<UnlockField>,
  locked: ReadonlySet<UnlockField>,
): UnlockField[] {
  return UNLOCK_FIELDS.filter((f) => changed.has(f) && locked.has(f));
}

/** The fields a change touches whose function the user lacks: each needs its own PIN. */
export function missingFields(
  changed: ReadonlySet<UnlockField>,
  can: Permissions['can'],
): UnlockField[] {
  return UNLOCK_FIELDS.filter((f) => changed.has(f) && !can(UNLOCK_PERMISSION[f]));
}

/** The text that tells the user which locks to open, e.g. "Unlock Room Type and Room to make this change." */
export function unlockMessage(fields: readonly UnlockField[]): string {
  const names = fields.map((f) => UNLOCK_LABEL[f]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  return `Unlock ${list} to make this change.`;
}

/** The codes to send: one per changed field whose function the user lacks (never an unneeded PIN). */
export function sentCodes(
  codes: UnlockCodes,
  changed: ReadonlySet<UnlockField>,
  can: Permissions['can'],
): UnlockCodes | undefined {
  const out: UnlockCodes = {};
  for (const f of missingFields(changed, can)) {
    const code = codes[f];
    if (code) out[f] = code;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
