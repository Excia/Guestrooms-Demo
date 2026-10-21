// The Room field of the New Reservation panel (Figma "Room Details"): every room of the club,
// grouped by "Location | Room type" and searchable. Deliberately takes no filter: the panel
// ignores the schedule's location and room-type filters (Figma annotation).
import type { ScheduleLocation, ScheduleRoom, ScheduleRoomType } from '../api/types';

export interface RoomOption {
  id: string;
  number: string;
  label: string;
  group: string;
  locationName: string;
  roomTypeName: string;
  locationId: string;
  roomTypeId: string;
}

const NATURAL = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** All rooms, ordered by location, room type and room number (numbers sorted naturally, 2 before 10). */
export function buildRoomOptions(
  rooms: readonly ScheduleRoom[],
  locations: readonly ScheduleLocation[],
  roomTypes: readonly ScheduleRoomType[],
): RoomOption[] {
  const locationIndex = new Map(locations.map((l, i) => [l.id, i]));
  const typeIndex = new Map(roomTypes.map((t, i) => [t.id, i]));
  const options = rooms.map((room): RoomOption => {
    const locationName =
      locations.find((l) => l.id === room.locationId)?.name ?? 'Unknown location';
    const roomTypeName = roomTypes.find((t) => t.id === room.roomTypeId)?.name ?? 'Unknown type';
    return {
      id: room.id,
      number: room.number,
      label: `Room ${room.number}`,
      group: `${locationName} | ${roomTypeName}`,
      locationName,
      roomTypeName,
      locationId: room.locationId,
      roomTypeId: room.roomTypeId,
    };
  });
  return options.sort(
    (a, b) =>
      (locationIndex.get(a.locationId) ?? 1e9) - (locationIndex.get(b.locationId) ?? 1e9) ||
      (typeIndex.get(a.roomTypeId) ?? 1e9) - (typeIndex.get(b.roomTypeId) ?? 1e9) ||
      NATURAL.compare(a.number, b.number),
  );
}

/** Matches the room number, the location or the room type; every word must match somewhere. */
export function filterRoomOptions(options: readonly RoomOption[], query: string): RoomOption[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...options];
  return options.filter((o) => {
    const haystack = `${o.label} ${o.number} ${o.locationName} ${o.roomTypeName}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}
