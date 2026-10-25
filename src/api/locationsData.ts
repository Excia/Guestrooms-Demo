import { PLACEHOLDER_LOCATIONS } from '../app/placeholderLocations';
import type { LocationSetup, LocationUsage, LookupRef } from './types';

// PLACEHOLDER sample data until the backend exists (see entries/182-locations.md). Areas are the
// revenue areas a location can be tied to; names are illustrative only.
export const MOCK_LOCATION_AREAS: LookupRef[] = [
  { id: 'area-guest-rooms', label: 'Guest Rooms' },
  { id: 'area-cottages', label: 'Cottage Rentals' },
  { id: 'area-lodge', label: 'Lodge Rooms' },
  { id: 'area-events', label: 'Event Lodging' },
  { id: 'area-resort', label: 'Resort Fees' },
];

// Ids and names come from the placeholder list the other screens use, so the Locations page and
// the selectors agree. The usage is invented: two locations are in use, North Lodge is free.
export function mockLocations(): LocationSetup[] {
  const area = (id: string) => MOCK_LOCATION_AREAS.find((a) => a.id === id) ?? null;
  const usage: Record<string, LocationUsage> = {
    'main-clubhouse': { roomTypes: ['Double Queen Room', 'King Room'], roomCount: 8 },
    'north-lodge': { roomTypes: [], roomCount: 0 },
    lakeside: { roomTypes: ['Two-Bedroom Cottage'], roomCount: 4 },
  };
  const areas: Record<string, string> = {
    'main-clubhouse': 'area-guest-rooms',
    'north-lodge': 'area-lodge',
    lakeside: 'area-cottages',
  };
  return PLACEHOLDER_LOCATIONS.map((l) => ({
    id: l.id,
    name: l.name,
    area: area(areas[l.id]),
    usage: structuredClone(usage[l.id]),
  }));
}
