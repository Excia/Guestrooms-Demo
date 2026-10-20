// The three linked dropdowns of the New Reservation panel (Location, Room Type, Room). Each one
// narrows the others; "" means Unassigned (no choice). The rooms are always every room of the
// club: the schedule's own filters are not applied here. Pure; the component only renders it.
import type { ScheduleRoom } from '../api/types';

export interface RoomSelection {
  locationId: string;
  roomTypeId: string;
  roomId: string;
}

export const UNASSIGNED_SELECTION: RoomSelection = { locationId: '', roomTypeId: '', roomId: '' };

export interface RoomChoices {
  /** Location ids that still have a room for the chosen type (all when none is chosen). */
  locationIds: ReadonlySet<string>;
  /** Room type ids that still have a room in the chosen location. */
  roomTypeIds: ReadonlySet<string>;
  /** Rooms matching both. */
  rooms: ScheduleRoom[];
}

export function roomChoices(rooms: readonly ScheduleRoom[], sel: RoomSelection): RoomChoices {
  const inLocation = (r: ScheduleRoom) => sel.locationId === '' || r.locationId === sel.locationId;
  const ofType = (r: ScheduleRoom) => sel.roomTypeId === '' || r.roomTypeId === sel.roomTypeId;
  return {
    locationIds: new Set(rooms.filter(ofType).map((r) => r.locationId)),
    roomTypeIds: new Set(rooms.filter(inLocation).map((r) => r.roomTypeId)),
    rooms: rooms.filter((r) => inLocation(r) && ofType(r)),
  };
}

/** A location was picked ("" = Unassigned): a type or room that no longer fits goes back to Unassigned. */
export function selectLocation(
  rooms: readonly ScheduleRoom[],
  sel: RoomSelection,
  locationId: string,
): RoomSelection {
  const next = { ...sel, locationId };
  const choices = roomChoices(rooms, next);
  const roomTypeId =
    next.roomTypeId !== '' && !choices.roomTypeIds.has(next.roomTypeId) ? '' : next.roomTypeId;
  const roomOk = rooms.some(
    (r) =>
      r.id === next.roomId &&
      (locationId === '' || r.locationId === locationId) &&
      (roomTypeId === '' || r.roomTypeId === roomTypeId),
  );
  return { locationId, roomTypeId, roomId: roomOk ? next.roomId : '' };
}

/** A room type was picked ("" = Unassigned): a location or room that no longer fits is cleared. */
export function selectRoomType(
  rooms: readonly ScheduleRoom[],
  sel: RoomSelection,
  roomTypeId: string,
): RoomSelection {
  const next = { ...sel, roomTypeId };
  const choices = roomChoices(rooms, next);
  const locationId =
    next.locationId !== '' && !choices.locationIds.has(next.locationId) ? '' : next.locationId;
  const roomOk = rooms.some(
    (r) =>
      r.id === next.roomId &&
      (locationId === '' || r.locationId === locationId) &&
      (roomTypeId === '' || r.roomTypeId === roomTypeId),
  );
  return { locationId, roomTypeId, roomId: roomOk ? next.roomId : '' };
}

/** A room was picked ("" = Unassigned, which keeps the narrowing): its location and type are set. */
export function selectRoom(
  rooms: readonly ScheduleRoom[],
  sel: RoomSelection,
  roomId: string,
): RoomSelection {
  const room = rooms.find((r) => r.id === roomId);
  return room
    ? { locationId: room.locationId, roomTypeId: room.roomTypeId, roomId: room.id }
    : { ...sel, roomId: '' };
}
