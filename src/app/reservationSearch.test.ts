import {
  ALL_LOCATIONS_VALUE,
  MAX_ADULTS,
  MAX_ADVANCE_DAYS,
  MAX_STAY_NIGHTS,
  dateHint,
  MAX_ROOMS,
  datesAreValid,
  formatCount,
  fromSearchParams,
  initialRooms,
  nightsBetween,
  roomsReducer,
  searchLabel,
  searchUrl,
  toSearchParams,
  validateDates,
} from './reservationSearch';

const today = '2026-10-20';

describe('nightsBetween', () => {
  it('counts whole days without timezone or DST drift', () => {
    expect(nightsBetween('2026-10-20', '2026-10-23')).toBe(3);
    expect(nightsBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(nightsBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(nightsBetween('2026-12-31', '2027-01-01')).toBe(1);
  });
  it('is NaN for invalid dates', () => {
    expect(nightsBetween('', '2026-10-23')).toBeNaN();
  });
});

describe('validateDates', () => {
  it('requires both dates', () => {
    expect(validateDates('', '', today)).toEqual({
      checkIn: 'Enter a check-in date.',
      checkOut: 'Enter a check-out date.',
    });
  });
  it('rejects check-out on or before check-in', () => {
    expect(validateDates('2026-10-22', '2026-10-22', today).checkOut).toMatch(/after check-in/);
    expect(validateDates('2026-10-22', '2026-10-21', today).checkOut).toMatch(/after check-in/);
    expect(datesAreValid('2026-10-22', '2026-10-23', today)).toBe(true);
  });
  it('allows check-in today but not in the past', () => {
    expect(datesAreValid(today, '2026-10-21', today)).toBe(true);
    expect(validateDates('2026-10-19', '2026-10-21', today).checkIn).toMatch(/past/);
  });
  it('limits the stay length and how far ahead check-in can be', () => {
    expect(datesAreValid('2026-10-22', '2027-10-22', today)).toBe(true); // 365 nights
    expect(validateDates('2026-10-22', '2027-10-23', today).checkOut).toMatch(/365 nights/);
    expect(validateDates('2026-10-22', '2099-01-01', today).checkOut).toMatch(/longer than/);
    const last = '2028-10-19'; // today + 730 days
    expect(MAX_ADVANCE_DAYS).toBe(730);
    expect(MAX_STAY_NIGHTS).toBe(365);
    expect(datesAreValid(last, '2028-10-20', today)).toBe(true);
    expect(validateDates('2028-10-20', '2028-10-21', today).checkIn).toMatch(/730 days/);
  });
  it('rejects impossible dates', () => {
    expect(validateDates('2026-02-30', '2026-03-02', today).checkIn).toMatch(/valid/);
  });
});

describe('dateHint', () => {
  it('explains what is missing or wrong, and is empty when valid', () => {
    expect(dateHint('', '', today)).toBe('Enter check-in and check-out dates.');
    expect(dateHint('2026-10-22', '', today)).toBe('Enter a check-out date.');
    expect(dateHint('2026-10-22', '2026-10-21', today)).toMatch(/after check-in/);
    expect(dateHint('2026-10-22', '2026-10-24', today)).toBe('');
  });
});

describe('searchLabel', () => {
  it('is singular for one night and plural otherwise', () => {
    expect(searchLabel(1)).toBe('SEARCH 1 NIGHT STAY');
    expect(searchLabel(3)).toBe('SEARCH 3 NIGHT STAY');
  });
  it('has no count without valid nights', () => {
    expect(searchLabel(NaN)).toBe('SEARCH STAY');
    expect(searchLabel(0)).toBe('SEARCH STAY');
    expect(searchLabel(-2)).toBe('SEARCH STAY');
  });
});

describe('roomsReducer', () => {
  it('starts with one room of 2 adults and 2 children', () => {
    expect(initialRooms()).toEqual([{ id: 1, adults: 2, children: 2 }]);
  });
  it('adds rooms up to the maximum', () => {
    let rooms = initialRooms();
    for (let i = 0; i < 10; i++) rooms = roomsReducer(rooms, { type: 'addRoom' });
    expect(rooms).toHaveLength(MAX_ROOMS);
  });
  it('gives rooms stable ids that survive a removal', () => {
    let rooms = initialRooms();
    rooms = roomsReducer(roomsReducer(rooms, { type: 'addRoom' }), { type: 'addRoom' });
    rooms = roomsReducer(rooms, { type: 'removeRoom', index: 1 });
    expect(rooms.map((r) => r.id)).toEqual([1, 3]);
    expect(roomsReducer(rooms, { type: 'addRoom' }).map((r) => r.id)).toEqual([1, 3, 4]);
  });
  it('removes rooms but never Room 1', () => {
    let rooms = roomsReducer(initialRooms(), { type: 'addRoom' });
    expect(roomsReducer(rooms, { type: 'removeRoom', index: 0 })).toBe(rooms);
    rooms = roomsReducer(rooms, { type: 'removeRoom', index: 1 });
    expect(rooms).toHaveLength(1);
  });
  it('keeps each room its own counts and clamps them', () => {
    let rooms = roomsReducer(initialRooms(), { type: 'addRoom' });
    rooms = roomsReducer(rooms, { type: 'setAdults', index: 1, value: 4 });
    rooms = roomsReducer(rooms, { type: 'setChildren', index: 0, value: 0 });
    expect(rooms).toEqual([
      { id: 1, adults: 2, children: 0 },
      { id: 2, adults: 4, children: 2 },
    ]);
    rooms = roomsReducer(rooms, { type: 'setAdults', index: 0, value: 0 });
    expect(rooms[0].adults).toBe(1);
    rooms = roomsReducer(rooms, { type: 'setAdults', index: 0, value: 99 });
    expect(rooms[0].adults).toBe(MAX_ADULTS);
    rooms = roomsReducer(rooms, { type: 'setChildren', index: 0, value: -3 });
    expect(rooms[0].children).toBe(0);
  });
});

it('formats counts with two digits', () => {
  expect(formatCount(2)).toBe('02');
  expect(formatCount(10)).toBe('10');
});

describe('URL round trip', () => {
  const criteria = {
    checkIn: '2026-10-22',
    checkOut: '2026-10-25',
    location: 'pool',
    rooms: [
      { adults: 2, children: 0 },
      { adults: 1, children: 3 },
    ],
  };
  it('round-trips', () => {
    expect(fromSearchParams(toSearchParams(criteria))).toEqual(criteria);
    expect(searchUrl(criteria)).toBe(
      '/reservations/new/results?checkIn=2026-10-22&checkOut=2026-10-25&location=pool&rooms=2.0%2C1.3',
    );
  });
  it('omits the all-locations value', () => {
    const p = toSearchParams({ ...criteria, location: ALL_LOCATIONS_VALUE });
    expect(p.has('location')).toBe(false);
    expect(fromSearchParams(p).location).toBe(ALL_LOCATIONS_VALUE);
  });
  it('parses bad URLs tolerantly', () => {
    const c = fromSearchParams(new URLSearchParams('checkIn=nope&checkOut=2026-02-30&rooms=9.99'));
    expect(c.checkIn).toBe('');
    expect(c.checkOut).toBe('');
    expect(c.rooms).toEqual([{ adults: 8, children: 8 }]);
    expect(fromSearchParams(new URLSearchParams('')).rooms).toEqual([{ adults: 2, children: 2 }]);
  });
  it('drops the whole rooms param when any entry is malformed or there are too many', () => {
    const one = [{ adults: 2, children: 2 }];
    expect(fromSearchParams(new URLSearchParams('rooms=1.1,x,3.0')).rooms).toEqual(one);
    expect(fromSearchParams(new URLSearchParams('rooms=1.1.1')).rooms).toEqual(one);
    expect(fromSearchParams(new URLSearchParams('rooms=1.0,1.0,1.0,1.0,1.0,1.0')).rooms).toEqual(
      one,
    );
  });
});
