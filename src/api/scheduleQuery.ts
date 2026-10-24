// Pure windowing of the mock's schedule state, as the backend would answer `schedule.get`.
import { addDays, nightsOverlap } from '../lib/dates';
import type { ScheduleData, ScheduleQuery } from './types';

/** The part of `all` the query asks for: every room, and the blocks and closures in the window. */
export function queryScheduleData(
  all: Omit<ScheduleData, 'startDate' | 'days'>,
  query: ScheduleQuery,
): ScheduleData {
  const { startDate, days } = query;
  const end = addDays(startDate, days);
  return {
    startDate,
    days,
    locations: all.locations,
    roomTypes: all.roomTypes,
    features: all.features,
    rooms: all.rooms,
    blocks: all.blocks.filter((b) => nightsOverlap(b.startDate, b.endDate, startDate, end)),
    unassigned: all.unassigned.filter((b) => nightsOverlap(b.startDate, b.endDate, startDate, end)),
    closures: all.closures.filter((c) => nightsOverlap(c.startDate, c.endDate, startDate, end)),
  };
}
