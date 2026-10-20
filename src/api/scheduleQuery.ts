// Pure schedule filtering shared by the mock (as the backend would do it) and the grid (to filter
// already loaded data without a round trip).
import { addDays, nightsOverlap } from '../lib/dates';
import type { ScheduleAvailability, ScheduleData, ScheduleQuery } from './types';

export interface ScheduleFilters {
  /** Absent: every location. An empty list ("Select None") matches nothing. */
  locationIds?: readonly string[];
  roomTypeIds?: readonly string[];
  availability?: ScheduleAvailability;
}

/**
 * Keeps the rooms that match the filters, and only their blocks and closures.
 * - Locations and room types: a room must be in a selected location AND a selected room type.
 * - 'booked': at least one reservation overlaps the data's range.
 * - 'available': no reservation and no closure overlaps the range (a room that is free all range).
 *   A room with only a closure is therefore neither available nor booked.
 */
export function applyScheduleFilters(data: ScheduleData, filters: ScheduleFilters): ScheduleData {
  const { startDate, days } = data;
  const end = addDays(startDate, days);
  const locations = filters.locationIds && new Set(filters.locationIds);
  const types = filters.roomTypeIds && new Set(filters.roomTypeIds);
  const availability = filters.availability ?? 'all';

  const booked = new Set<string>();
  const closed = new Set<string>();
  if (availability !== 'all') {
    for (const b of data.blocks) {
      if (nightsOverlap(b.startDate, b.endDate, startDate, end)) booked.add(b.roomId);
    }
    for (const c of data.closures) {
      if (nightsOverlap(c.startDate, c.endDate, startDate, end)) closed.add(c.roomId);
    }
  }

  const rooms = data.rooms.filter(
    (r) =>
      (!locations || locations.has(r.locationId)) &&
      (!types || types.has(r.roomTypeId)) &&
      (availability === 'all' ||
        (availability === 'booked' ? booked.has(r.id) : !booked.has(r.id) && !closed.has(r.id))),
  );
  const ids = new Set(rooms.map((r) => r.id));
  return {
    ...data,
    rooms,
    blocks: data.blocks.filter((b) => ids.has(b.roomId)),
    closures: data.closures.filter((c) => ids.has(c.roomId)),
  };
}

/** The part of `all` the query asks for: the window's blocks and closures, then the filters. */
export function queryScheduleData(
  all: Omit<ScheduleData, 'startDate' | 'days'>,
  query: ScheduleQuery,
): ScheduleData {
  const { startDate, days } = query;
  const end = addDays(startDate, days);
  const windowed: ScheduleData = {
    startDate,
    days,
    locations: all.locations,
    roomTypes: all.roomTypes,
    rooms: all.rooms,
    blocks: all.blocks.filter((b) => nightsOverlap(b.startDate, b.endDate, startDate, end)),
    closures: all.closures.filter((c) => nightsOverlap(c.startDate, c.endDate, startDate, end)),
  };
  return applyScheduleFilters(windowed, query);
}
