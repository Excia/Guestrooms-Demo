// Pure rules for the online booking search (ticket 5.2): the reservation widget and the Adjust
// Search panel share them. Dates are ISO "yyyy-mm-dd" strings. The staff-side New Reservation search
// (reservationSearch.ts) has different limits and defaults (D-042); only its generic helpers are reused.
import { addDays, isValidIsoDate, type IsoDate } from './dateSelection';
import {
  ALL_LOCATIONS_VALUE,
  nightsBetween,
  toSearchParams,
  type RoomGuests,
  type SearchCriteria,
} from './reservationSearch';

export { ALL_LOCATIONS_VALUE, nightsBetween };
export type { RoomGuests, SearchCriteria };

/** Where Search opens the results. The route arrives with the Results ticket (5.3). */
export const BOOKING_RESULTS_PATH = '/book/results';

/** Limits that come from the club's data and Booking Rules (7.5); the defaults are placeholders. */
export interface BookingLimits {
  /** Highest Max Occupancy of any room type or room: the most guests (adults plus children) per room. */
  maxGuests: number;
  /** Max rooms per booking (Booking Rules). */
  maxRooms: number;
  /** Furthest-ahead check-in and longest stay, in days; no source yet (owner to confirm). */
  advanceDays: number;
  maxNights: number;
}

export const DEFAULT_BOOKING_LIMITS: BookingLimits = {
  maxGuests: 4,
  maxRooms: 3,
  advanceDays: 365,
  maxNights: 30,
};

export const DEFAULT_ADULTS = 1;
export const DEFAULT_CHILDREN = 0;
const MIN_ADULTS = 1;

export interface BookingRoom extends RoomGuests {
  /** Stable across removals (React keys, focus). */
  id: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Defaults: check-in today, check-out the next day, any location, one room with 1 adult. */
export function defaultBookingCriteria(today: IsoDate): SearchCriteria {
  return {
    checkIn: today,
    checkOut: addDays(today, 1),
    location: ALL_LOCATIONS_VALUE,
    rooms: [{ adults: DEFAULT_ADULTS, children: DEFAULT_CHILDREN }],
  };
}

export interface BookingDateErrors {
  checkIn?: string;
  checkOut?: string;
}

/** Check-in valid, not in the past and within the advance limit; check-out after check-in, within the stay limit. */
export function validateBookingDates(
  checkIn: string,
  checkOut: string,
  today: IsoDate,
  limits: Pick<BookingLimits, 'advanceDays' | 'maxNights'> = DEFAULT_BOOKING_LIMITS,
): BookingDateErrors {
  const errors: BookingDateErrors = {};
  if (!checkIn) errors.checkIn = 'Enter a check-in date.';
  else if (!isValidIsoDate(checkIn)) errors.checkIn = 'Enter a valid date.';
  else if (checkIn < today) errors.checkIn = 'Check-in cannot be in the past.';
  else if (checkIn > addDays(today, limits.advanceDays)) {
    errors.checkIn = `Check-in cannot be more than ${limits.advanceDays} days ahead.`;
  }
  if (!checkOut) errors.checkOut = 'Enter a check-out date.';
  else if (!isValidIsoDate(checkOut)) errors.checkOut = 'Enter a valid date.';
  else if (!errors.checkIn) {
    if (checkOut <= checkIn) errors.checkOut = 'Check-out must be after check-in.';
    else if (nightsBetween(checkIn, checkOut) > limits.maxNights) {
      errors.checkOut = `A stay cannot be longer than ${limits.maxNights} nights.`;
    }
  }
  return errors;
}

export const bookingDatesValid = (
  checkIn: string,
  checkOut: string,
  today: IsoDate,
  limits?: Pick<BookingLimits, 'advanceDays' | 'maxNights'>,
) => {
  const e = validateBookingDates(checkIn, checkOut, today, limits);
  return !e.checkIn && !e.checkOut;
};

/** Search button text: "Search 1 Night Stay", "Search 3 Night Stay"; without valid dates, "Search Stay". */
export function searchStayLabel(nights: number): string {
  return Number.isInteger(nights) && nights > 0 ? `Search ${nights} Night Stay` : 'Search Stay';
}

// Guests ---------------------------------------------------------------------------------------

/** Most adults a room can take given its children (and at least the minimum). */
export const maxAdults = (children: number, limits: Pick<BookingLimits, 'maxGuests'>) =>
  Math.max(MIN_ADULTS, limits.maxGuests - children);

/** Most children a room can take given its adults. */
export const maxChildren = (adults: number, limits: Pick<BookingLimits, 'maxGuests'>) =>
  Math.max(0, limits.maxGuests - adults);

export function initialBookingRooms(rooms?: readonly RoomGuests[]): BookingRoom[] {
  const source = rooms?.length ? rooms : [{ adults: DEFAULT_ADULTS, children: DEFAULT_CHILDREN }];
  return source.map((r, i) => ({ id: i + 1, adults: r.adults, children: r.children }));
}

export type BookingRoomsAction =
  | { type: 'addRoom' }
  | { type: 'removeLast' }
  | { type: 'setAdults'; index: number; value: number }
  | { type: 'setChildren'; index: number; value: number }
  | { type: 'reset'; rooms: readonly RoomGuests[] };

/**
 * Reducer for the rooms list. "Remove" deletes the latest room, Room 1 stays, the room count is capped
 * by Booking Rules and a room's adults plus children never exceed the max occupancy.
 */
export function bookingRoomsReducer(
  limits: BookingLimits,
): (rooms: BookingRoom[], action: BookingRoomsAction) => BookingRoom[] {
  return (rooms, action) => {
    switch (action.type) {
      case 'addRoom':
        return rooms.length >= limits.maxRooms
          ? rooms
          : [
              ...rooms,
              {
                id: Math.max(0, ...rooms.map((r) => r.id)) + 1,
                adults: DEFAULT_ADULTS,
                children: DEFAULT_CHILDREN,
              },
            ];
      case 'removeLast':
        return rooms.length > 1 ? rooms.slice(0, -1) : rooms;
      case 'setAdults':
        return rooms.map((r, i) =>
          i === action.index
            ? {
                ...r,
                adults: clamp(Math.trunc(action.value), MIN_ADULTS, maxAdults(r.children, limits)),
              }
            : r,
        );
      case 'setChildren':
        return rooms.map((r, i) =>
          i === action.index
            ? { ...r, children: clamp(Math.trunc(action.value), 0, maxChildren(r.adults, limits)) }
            : r,
        );
      case 'reset':
        return initialBookingRooms(action.rooms);
    }
  };
}

export const canAddBookingRoom = (
  rooms: readonly RoomGuests[],
  limits: Pick<BookingLimits, 'maxRooms'>,
) => rooms.length < limits.maxRooms;

// URL and comparison ---------------------------------------------------------------------------

export function bookingSearchUrl(c: SearchCriteria, path: string = BOOKING_RESULTS_PATH): string {
  return `${path}?${toSearchParams(c).toString()}`;
}

/**
 * Criteria from the results URL. Never throws: missing or invalid dates and a malformed rooms param
 * fall back to the defaults, counts are clamped to the limits and extra rooms are dropped.
 */
export function bookingCriteriaFromParams(
  p: URLSearchParams,
  today: IsoDate,
  limits: BookingLimits = DEFAULT_BOOKING_LIMITS,
): SearchCriteria {
  const defaults = defaultBookingCriteria(today);
  const checkIn = p.get('checkIn') ?? '';
  const checkOut = p.get('checkOut') ?? '';
  const datesOk = isValidIsoDate(checkIn) && isValidIsoDate(checkOut) && checkOut > checkIn;
  const rooms: RoomGuests[] = [];
  for (const part of (p.get('rooms') ?? '').split(',')) {
    const m = /^(\d{1,3})\.(\d{1,3})$/.exec(part);
    if (!m) {
      rooms.length = 0;
      break;
    }
    const children = clamp(Number(m[2]), 0, Math.max(0, limits.maxGuests - MIN_ADULTS));
    rooms.push({ adults: clamp(Number(m[1]), MIN_ADULTS, maxAdults(children, limits)), children });
  }
  return {
    checkIn: datesOk ? checkIn : defaults.checkIn,
    checkOut: datesOk ? checkOut : defaults.checkOut,
    location: p.get('location') || ALL_LOCATIONS_VALUE,
    rooms: rooms.length ? rooms.slice(0, limits.maxRooms) : defaults.rooms,
  };
}

/** True when the two searches ask for different things (drives the "you changed the search" notice). */
export function criteriaDiffer(a: SearchCriteria, b: SearchCriteria): boolean {
  return (
    a.checkIn !== b.checkIn ||
    a.checkOut !== b.checkOut ||
    a.location !== b.location ||
    a.rooms.length !== b.rooms.length ||
    a.rooms.some((r, i) => r.adults !== b.rooms[i].adults || r.children !== b.rooms[i].children)
  );
}

/** "2 Nights 10/25 - 10/27 | 2 Rooms | Location A": the line under "Adjust Search" (Figma 12136:20583). */
export function criteriaSummary(
  c: SearchCriteria,
  locationName: (id: string) => string,
  showLocation = true,
): string {
  const nights = nightsBetween(c.checkIn, c.checkOut);
  const md = (iso: IsoDate) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
  const parts = [
    `${nights} ${nights === 1 ? 'Night' : 'Nights'} ${md(c.checkIn)} - ${md(c.checkOut)}`,
    `${c.rooms.length} ${c.rooms.length === 1 ? 'Room' : 'Rooms'}`,
  ];
  if (showLocation) {
    parts.push(c.location === ALL_LOCATIONS_VALUE ? 'All Locations' : locationName(c.location));
  }
  return parts.join(' | ');
}
