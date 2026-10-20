// Pure rules for the New Reservation search (Figma 69:3803): dates, nights, rooms and guests, and
// the URL form of the criteria. Dates are ISO "yyyy-mm-dd" strings (see dateSelection.ts).
import { NEW_RESERVATION_RESULTS_PATH } from './routes';
import { daysBetween, isValidIsoDate, type IsoDate } from './dateSelection';

// Limits are not in Figma or the ticket; these are the stated defaults and need the owner's confirmation.
export const MIN_ADULTS = 1;
export const MAX_ADULTS = 8;
export const MIN_CHILDREN = 0;
export const MAX_CHILDREN = 8;
export const MAX_ROOMS = 5;
export const DEFAULT_ADULTS = 2;
export const DEFAULT_CHILDREN = 2;

/** Select value meaning every location; it is not put in the URL. */
export const ALL_LOCATIONS_VALUE = 'all';
export const SEARCH_RESULTS_PATH = NEW_RESERVATION_RESULTS_PATH;

export interface RoomGuests {
  adults: number;
  children: number;
}

export interface SearchCriteria {
  checkIn: IsoDate;
  checkOut: IsoDate;
  /** Location id, or ALL_LOCATIONS_VALUE. */
  location: string;
  rooms: RoomGuests[];
}

export interface DateErrors {
  checkIn?: string;
  checkOut?: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Whole nights from check-in to check-out; NaN when either date is invalid. */
export function nightsBetween(checkIn: IsoDate, checkOut: IsoDate): number {
  return daysBetween(checkIn, checkOut);
}

/**
 * Check-in is required, valid and not before `today`; check-out is required, valid and after
 * check-in (a 0-night stay is not allowed). Empty object when both are usable.
 */
export function validateDates(checkIn: string, checkOut: string, today: IsoDate): DateErrors {
  const errors: DateErrors = {};
  if (!checkIn) errors.checkIn = 'Enter a check-in date.';
  else if (!isValidIsoDate(checkIn)) errors.checkIn = 'Enter a valid date.';
  else if (checkIn < today) errors.checkIn = 'Check-in cannot be in the past.';
  if (!checkOut) errors.checkOut = 'Enter a check-out date.';
  else if (!isValidIsoDate(checkOut)) errors.checkOut = 'Enter a valid date.';
  else if (!errors.checkIn && checkOut <= checkIn) {
    errors.checkOut = 'Check-out must be after check-in.';
  }
  return errors;
}

export function datesAreValid(checkIn: string, checkOut: string, today: IsoDate): boolean {
  const e = validateDates(checkIn, checkOut, today);
  return !e.checkIn && !e.checkOut;
}

/** "SEARCH 1 NIGHT STAY", "SEARCH 3 NIGHT STAY"; without valid dates, "SEARCH STAY". */
export function searchLabel(nights: number): string {
  return Number.isInteger(nights) && nights > 0 ? `SEARCH ${nights} NIGHT STAY` : 'SEARCH STAY';
}

// Guests ---------------------------------------------------------------------------------------

export const initialRooms = (): RoomGuests[] => [
  { adults: DEFAULT_ADULTS, children: DEFAULT_CHILDREN },
];

export type RoomsAction =
  | { type: 'addRoom' }
  | { type: 'removeRoom'; index: number }
  | { type: 'setAdults'; index: number; value: number }
  | { type: 'setChildren'; index: number; value: number };

/** Reducer for the rooms list. Room 1 cannot be removed; counts and room total are clamped. */
export function roomsReducer(rooms: RoomGuests[], action: RoomsAction): RoomGuests[] {
  switch (action.type) {
    case 'addRoom':
      return rooms.length >= MAX_ROOMS
        ? rooms
        : [...rooms, { adults: DEFAULT_ADULTS, children: DEFAULT_CHILDREN }];
    case 'removeRoom':
      return action.index <= 0 || action.index >= rooms.length
        ? rooms
        : rooms.filter((_, i) => i !== action.index);
    case 'setAdults':
      return rooms.map((r, i) =>
        i === action.index
          ? { ...r, adults: clamp(Math.trunc(action.value), MIN_ADULTS, MAX_ADULTS) }
          : r,
      );
    case 'setChildren':
      return rooms.map((r, i) =>
        i === action.index
          ? { ...r, children: clamp(Math.trunc(action.value), MIN_CHILDREN, MAX_CHILDREN) }
          : r,
      );
  }
}

export const canAddRoom = (rooms: readonly RoomGuests[]) => rooms.length < MAX_ROOMS;

/** Stepper value as shown in Figma: two digits ("02"). */
export const formatCount = (n: number) => String(n).padStart(2, '0');

// URL ------------------------------------------------------------------------------------------

/** Query string (no leading "?"): checkIn, checkOut, location (when not all), rooms="2.1,1.0". */
export function toSearchParams(c: SearchCriteria): URLSearchParams {
  const p = new URLSearchParams();
  p.set('checkIn', c.checkIn);
  p.set('checkOut', c.checkOut);
  if (c.location && c.location !== ALL_LOCATIONS_VALUE) p.set('location', c.location);
  p.set('rooms', c.rooms.map((r) => `${r.adults}.${r.children}`).join(','));
  return p;
}

function parseRooms(raw: string | null): RoomGuests[] {
  const rooms: RoomGuests[] = [];
  for (const part of (raw ?? '').split(',').slice(0, MAX_ROOMS)) {
    const m = /^(\d{1,3})\.(\d{1,3})$/.exec(part);
    if (!m) continue;
    rooms.push({
      adults: clamp(Number(m[1]), MIN_ADULTS, MAX_ADULTS),
      children: clamp(Number(m[2]), MIN_CHILDREN, MAX_CHILDREN),
    });
  }
  return rooms.length > 0 ? rooms : initialRooms();
}

/**
 * Tolerant parse: never throws. Missing or invalid dates come back as "" (so callers can tell the
 * criteria are incomplete), bad room entries are dropped and counts clamped.
 */
export function fromSearchParams(p: URLSearchParams): SearchCriteria {
  const date = (key: string) => {
    const v = p.get(key) ?? '';
    return isValidIsoDate(v) ? v : '';
  };
  return {
    checkIn: date('checkIn'),
    checkOut: date('checkOut'),
    location: p.get('location') || ALL_LOCATIONS_VALUE,
    rooms: parseRooms(p.get('rooms')),
  };
}

export function searchUrl(c: SearchCriteria): string {
  return `${SEARCH_RESULTS_PATH}?${toSearchParams(c).toString()}`;
}
