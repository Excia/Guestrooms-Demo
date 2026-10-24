import {
  BOOKING_RESULTS_PATH,
  bookingCriteriaFromParams,
  bookingDatesValid,
  bookingRoomsReducer,
  bookingSearchUrl,
  canAddBookingRoom,
  criteriaDiffer,
  criteriaSummary,
  defaultBookingCriteria,
  initialBookingRooms,
  maxAdults,
  maxChildren,
  searchStayLabel,
  validateBookingDates,
  type BookingLimits,
} from './bookingSearch';

const limits: BookingLimits = { maxGuests: 4, maxRooms: 3, advanceDays: 365, maxNights: 30 };
const today = '2026-10-21';
const reduce = bookingRoomsReducer(limits);

describe('defaults', () => {
  it('check-in today, check-out the next day, any location, 1 adult and 0 children', () => {
    expect(defaultBookingCriteria(today)).toEqual({
      checkIn: '2026-10-21',
      checkOut: '2026-10-22',
      location: 'all',
      rooms: [{ adults: 1, children: 0 }],
    });
  });
});

describe('searchStayLabel', () => {
  it('uses the night count', () => {
    expect(searchStayLabel(1)).toBe('Search 1 Night Stay');
    expect(searchStayLabel(3)).toBe('Search 3 Night Stay');
  });
  it('falls back without valid nights', () => {
    expect(searchStayLabel(NaN)).toBe('Search Stay');
    expect(searchStayLabel(0)).toBe('Search Stay');
  });
});

describe('validateBookingDates', () => {
  it('accepts the defaults', () => {
    expect(bookingDatesValid('2026-10-21', '2026-10-22', today)).toBe(true);
  });
  it('rejects a past check-in, a check-out not after check-in and over-long stays', () => {
    expect(validateBookingDates('2026-10-20', '2026-10-22', today).checkIn).toMatch(/past/);
    expect(validateBookingDates('2026-10-21', '2026-10-21', today).checkOut).toMatch(/after/);
    expect(validateBookingDates('2026-10-21', '2026-12-30', today).checkOut).toMatch(/30 nights/);
  });
  it('rejects empty and invalid dates', () => {
    expect(validateBookingDates('', '', today)).toEqual({
      checkIn: 'Enter a check-in date.',
      checkOut: 'Enter a check-out date.',
    });
    expect(validateBookingDates('2026-02-30', '2026-03-01', today).checkIn).toMatch(/valid/);
  });
  it('rejects check-in too far ahead', () => {
    expect(validateBookingDates('2028-01-01', '2028-01-02', today).checkIn).toMatch(/365 days/);
  });
});

describe('guest limits', () => {
  it('maximum guests per room is adults plus children', () => {
    expect(maxAdults(1, limits)).toBe(3);
    expect(maxChildren(2, limits)).toBe(2);
    expect(maxAdults(10, limits)).toBe(1);
  });
});

describe('bookingRoomsReducer', () => {
  const one = initialBookingRooms();

  it('adds rooms up to the Booking Rules maximum', () => {
    let rooms = one;
    for (let i = 0; i < 5; i++) rooms = reduce(rooms, { type: 'addRoom' });
    expect(rooms).toHaveLength(3);
    expect(canAddBookingRoom(rooms, limits)).toBe(false);
    expect(canAddBookingRoom(one, limits)).toBe(true);
  });

  it('new rooms start at 1 adult and 0 children with a fresh id', () => {
    const rooms = reduce(one, { type: 'addRoom' });
    expect(rooms[1]).toEqual({ id: 2, adults: 1, children: 0 });
  });

  it('Remove deletes the latest room and never Room 1', () => {
    const two = reduce(one, { type: 'addRoom' });
    expect(reduce(two, { type: 'removeLast' })).toEqual(one);
    expect(reduce(one, { type: 'removeLast' })).toEqual(one);
  });

  it('caps adults plus children at the max occupancy', () => {
    let rooms = reduce(one, { type: 'setAdults', index: 0, value: 9 });
    expect(rooms[0].adults).toBe(4);
    rooms = reduce(rooms, { type: 'setChildren', index: 0, value: 2 });
    expect(rooms[0].children).toBe(0);
    rooms = reduce(initialBookingRooms([{ adults: 2, children: 0 }]), {
      type: 'setChildren',
      index: 0,
      value: 9,
    });
    expect(rooms[0].children).toBe(2);
  });

  it('never goes below 1 adult or 0 children', () => {
    const rooms = reduce(one, { type: 'setAdults', index: 0, value: 0 });
    expect(rooms[0].adults).toBe(1);
    expect(reduce(one, { type: 'setChildren', index: 0, value: -3 })[0].children).toBe(0);
  });
});

describe('URL', () => {
  const criteria = {
    checkIn: '2026-10-21',
    checkOut: '2026-10-24',
    location: 'loc-a',
    rooms: [
      { adults: 2, children: 1 },
      { adults: 1, children: 0 },
    ],
  };

  it('puts the criteria in the query string', () => {
    expect(bookingSearchUrl(criteria)).toBe(
      `${BOOKING_RESULTS_PATH}?checkIn=2026-10-21&checkOut=2026-10-24&location=loc-a&rooms=2.1%2C1.0`,
    );
  });

  it('omits the location when it is "all"', () => {
    expect(bookingSearchUrl({ ...criteria, location: 'all' })).not.toContain('location');
  });

  it('round-trips', () => {
    const url = new URL(bookingSearchUrl(criteria), 'http://x');
    expect(bookingCriteriaFromParams(url.searchParams, today, limits)).toEqual(criteria);
  });

  it('falls back to the defaults on missing or invalid input and clamps counts', () => {
    expect(bookingCriteriaFromParams(new URLSearchParams(''), today, limits)).toEqual(
      defaultBookingCriteria(today),
    );
    const bad = new URLSearchParams('checkIn=2026-10-21&checkOut=2026-10-20&rooms=x');
    expect(bookingCriteriaFromParams(bad, today, limits)).toEqual(defaultBookingCriteria(today));
    const big = new URLSearchParams('checkIn=2026-10-21&checkOut=2026-10-22&rooms=9.9,1.0,1.0,1.0');
    const parsed = bookingCriteriaFromParams(big, today, limits);
    expect(parsed.rooms).toHaveLength(3);
    expect(parsed.rooms[0].adults + parsed.rooms[0].children).toBeLessThanOrEqual(4);
  });
});

describe('criteriaDiffer', () => {
  const a = defaultBookingCriteria(today);
  it('is false for equal criteria and true for any change', () => {
    expect(criteriaDiffer(a, { ...a, rooms: [{ ...a.rooms[0] }] })).toBe(false);
    expect(criteriaDiffer(a, { ...a, checkOut: '2026-10-23' })).toBe(true);
    expect(criteriaDiffer(a, { ...a, location: 'x' })).toBe(true);
    expect(criteriaDiffer(a, { ...a, rooms: [{ adults: 2, children: 0 }] })).toBe(true);
    expect(criteriaDiffer(a, { ...a, rooms: [...a.rooms, ...a.rooms] })).toBe(true);
  });
});

describe('criteriaSummary', () => {
  const c = {
    checkIn: '2026-10-25',
    checkOut: '2026-10-27',
    location: 'loc-a',
    rooms: [
      { adults: 1, children: 0 },
      { adults: 1, children: 0 },
    ],
  };
  it('matches the Figma line', () => {
    expect(criteriaSummary(c, () => 'Location A')).toBe(
      '2 Nights 10/25 - 10/27 | 2 Rooms | Location A',
    );
  });
  it('singular nouns, all locations and a single-location club', () => {
    const one = { ...c, checkOut: '2026-10-26', location: 'all', rooms: [c.rooms[0]] };
    expect(criteriaSummary(one, () => '')).toBe('1 Night 10/25 - 10/26 | 1 Room | All Locations');
    expect(criteriaSummary(one, () => '', false)).toBe('1 Night 10/25 - 10/26 | 1 Room');
  });
});
