// The three linked dropdowns of the New Reservation panel (Location, Room Type, Room). Each one
// narrows the others; "" means Unassigned (no choice). The rooms are always every room of the
// club: the schedule's own filters are not applied here. Pure; the component only renders it.
import type { ScheduleRoom } from '../api/types';

export interface RoomSelection {
  locationId: string;
  roomTypeId: string;
  roomId: string;
  /** The location was filled in by choosing a room (not chosen by the user): clearing the room undoes it. */
  autoLocation: boolean;
  /** Same for the room type. */
  autoRoomType: boolean;
}

export const UNASSIGNED_SELECTION: RoomSelection = {
  locationId: '',
  roomTypeId: '',
  roomId: '',
  autoLocation: false,
  autoRoomType: false,
};

export interface RoomChoices {
  /** Location ids that still have a room for the chosen type (all when none is chosen). */
  locationIds: ReadonlySet<string>;
  /** Room type ids that still have a room in the chosen location. */
  roomTypeIds: ReadonlySet<string>;
  /** Rooms matching both. */
  rooms: ScheduleRoom[];
}

export function roomChoices(
  rooms: readonly ScheduleRoom[],
  sel: Pick<RoomSelection, 'locationId' | 'roomTypeId'>,
): RoomChoices {
  const inLocation = (r: ScheduleRoom) => sel.locationId === '' || r.locationId === sel.locationId;
  const ofType = (r: ScheduleRoom) => sel.roomTypeId === '' || r.roomTypeId === sel.roomTypeId;
  return {
    locationIds: new Set(rooms.filter(ofType).map((r) => r.locationId)),
    roomTypeIds: new Set(rooms.filter(inLocation).map((r) => r.roomTypeId)),
    rooms: rooms.filter((r) => inLocation(r) && ofType(r)),
  };
}

/**
 * The room goes back to Unassigned: whatever its choice filled in (the location and/or the type the
 * user did not pick themselves) goes back to Unassigned with it. Explicit choices stay.
 */
function withoutRoom(sel: RoomSelection): RoomSelection {
  return {
    locationId: sel.autoLocation ? '' : sel.locationId,
    roomTypeId: sel.autoRoomType ? '' : sel.roomTypeId,
    roomId: '',
    autoLocation: false,
    autoRoomType: false,
  };
}

const fits = (
  rooms: readonly ScheduleRoom[],
  roomId: string,
  locationId: string,
  roomTypeId: string,
) =>
  rooms.some(
    (r) =>
      r.id === roomId &&
      (locationId === '' || r.locationId === locationId) &&
      (roomTypeId === '' || r.roomTypeId === roomTypeId),
  );

/**
 * A location was picked ("" = Unassigned). Unassigned also clears the room: a room determines its
 * location, so "Unassigned location, Room 302" never shows. A type or room that no longer fits goes
 * back to Unassigned. The location is now an explicit choice.
 */
export function selectLocation(
  rooms: readonly ScheduleRoom[],
  sel: RoomSelection,
  locationId: string,
): RoomSelection {
  const base = sel.roomId !== '' && locationId === '' ? withoutRoom(sel) : sel;
  const next = { ...base, locationId, autoLocation: false };
  const types = roomChoices(rooms, next).roomTypeIds;
  const typeGone = next.roomTypeId !== '' && !types.has(next.roomTypeId);
  const roomTypeId = typeGone ? '' : next.roomTypeId;
  if (next.roomId !== '' && !fits(rooms, next.roomId, locationId, roomTypeId)) {
    return { ...withoutRoom(next), locationId, roomTypeId };
  }
  return { ...next, roomTypeId, autoRoomType: typeGone ? false : next.autoRoomType };
}

/** A room type was picked ("" = Unassigned): the mirror of `selectLocation`. */
export function selectRoomType(
  rooms: readonly ScheduleRoom[],
  sel: RoomSelection,
  roomTypeId: string,
): RoomSelection {
  const base = sel.roomId !== '' && roomTypeId === '' ? withoutRoom(sel) : sel;
  const next = { ...base, roomTypeId, autoRoomType: false };
  const locations = roomChoices(rooms, next).locationIds;
  const locationGone = next.locationId !== '' && !locations.has(next.locationId);
  const locationId = locationGone ? '' : next.locationId;
  if (next.roomId !== '' && !fits(rooms, next.roomId, locationId, roomTypeId)) {
    return { ...withoutRoom(next), locationId, roomTypeId };
  }
  return { ...next, locationId, autoLocation: locationGone ? false : next.autoLocation };
}

/**
 * A room was picked: its location and type are set (marked as filled in by the room unless the user
 * had already chosen them). "" (Unassigned) clears the room and undoes what it filled in.
 */
export function selectRoom(
  rooms: readonly ScheduleRoom[],
  sel: RoomSelection,
  roomId: string,
): RoomSelection {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return withoutRoom(sel);
  return {
    locationId: room.locationId,
    roomTypeId: room.roomTypeId,
    roomId: room.id,
    autoLocation: sel.locationId === '' ? true : sel.autoLocation,
    autoRoomType: sel.roomTypeId === '' ? true : sel.autoRoomType,
  };
}
