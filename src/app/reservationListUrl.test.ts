import {
  applyReservationListView,
  clearFilters,
  hasActiveFilters,
  nextSort,
  parseReservationListView,
  toListQuery,
} from './reservationListUrl';

const T = '2026-10-16';
const parse = (search: string) => parseReservationListView(search, T);
const round = (search: string) =>
  applyReservationListView(new URLSearchParams(), parse(search), T).toString();

describe('parseReservationListView', () => {
  it('defaults to today through the next 7 days, sorted by check-in ascending', () => {
    const v = parse('');
    expect(v.checkInFrom).toBe('2026-10-16');
    expect(v.checkInTo).toBe('2026-10-23');
    expect(v.sort).toEqual({ field: 'arrival', direction: 'asc' });
    expect(v.page).toBe(1);
    expect(v.unassignedOnly).toBe(false);
    expect(v.locationIds).toEqual([]);
  });
  it('reads every filter', () => {
    const v = parse(
      'from=2026-11-01&to=2026-11-05&unassigned=1&locations=a,b&types=t&status=canceled,checked-in&guest=lee&resNumber=GR&q=x&sort=guestName:desc&page=3&rows=50',
    );
    expect(v).toMatchObject({
      checkInFrom: '2026-11-01',
      checkInTo: '2026-11-05',
      unassignedOnly: true,
      locationIds: ['a', 'b'],
      roomTypeIds: ['t'],
      statuses: ['canceled', 'checked-in'],
      search: 'x',
      sort: { field: 'guestName', direction: 'desc' },
      page: 3,
      rowsPerPage: 50,
    });
    expect(v.text.guest).toBe('lee');
    expect(v.text.resNumber).toBe('GR');
  });
  it('treats an empty date as no bound', () => {
    const v = parse('from=&to=');
    expect(v.checkInFrom).toBe('');
    expect(v.checkInTo).toBe('');
  });
  it('falls back to defaults on malformed values', () => {
    const v = parse(
      'from=nope&to=2026-02-31&status=bogus&sort=evil:up&page=-2&rows=7&unassigned=yes',
    );
    expect(v.checkInFrom).toBe('2026-10-16');
    expect(v.checkInTo).toBe('2026-10-23');
    expect(v.statuses).toEqual([]);
    expect(v.sort).toEqual({ field: 'arrival', direction: 'asc' });
    expect(v.page).toBe(1);
    expect(v.rowsPerPage).toBe(25);
    expect(v.unassignedOnly).toBe(false);
  });
});

describe('applyReservationListView', () => {
  it('omits defaults', () => {
    expect(round('')).toBe('');
  });
  it('round-trips filters', () => {
    const search =
      'unassigned=1&locations=a%2Cb&status=canceled&guest=lee&page=2&sort=departure%3Adesc';
    expect(parse(round(search))).toEqual(parse(search));
    expect(round('from=&to=2026-11-05')).toContain('from=');
  });
  it('keeps unrelated parameters', () => {
    const next = applyReservationListView(
      new URLSearchParams('mock=empty'),
      { ...parse(''), unassignedOnly: true },
      T,
    );
    expect(next.get('mock')).toBe('empty');
    expect(next.get('unassigned')).toBe('1');
  });
});

describe('toListQuery', () => {
  it('maps the view and leaves empty filters out', () => {
    const q = toListQuery({ ...parse(''), text: { ...parse('').text, guest: ' lee ' } });
    expect(q).toMatchObject({
      checkInFrom: '2026-10-16',
      checkInTo: '2026-10-23',
      guest: 'lee',
      sort: { field: 'arrival', direction: 'asc' },
      page: 1,
      limit: 25,
    });
    expect(q.unassignedOnly).toBeUndefined();
    expect(q.locationIds).toBeUndefined();
    expect(q.reserver).toBeUndefined();
  });
  it('sends no date bound when the dates were cleared', () => {
    const q = toListQuery(parse('from=&to='));
    expect(q.checkInFrom).toBeUndefined();
    expect(q.checkInTo).toBeUndefined();
  });
});

describe('hasActiveFilters and clearFilters', () => {
  it('detects any narrowing, and clears back to the defaults but keeps the sort', () => {
    expect(hasActiveFilters(parse(''), T)).toBe(false);
    const v = parse('unassigned=1&guest=lee&sort=guestName:asc&page=4');
    expect(hasActiveFilters(v, T)).toBe(true);
    const cleared = clearFilters(v, T);
    expect(hasActiveFilters(cleared, T)).toBe(false);
    expect(cleared.sort.field).toBe('guestName');
    expect(cleared.page).toBe(1);
  });
});

describe('nextSort', () => {
  it('flips direction on the same column and starts ascending on a new one', () => {
    const asc = { field: 'arrival', direction: 'asc' } as const;
    expect(nextSort(asc, 'arrival')).toEqual({ field: 'arrival', direction: 'desc' });
    expect(nextSort({ field: 'arrival', direction: 'desc' }, 'arrival').direction).toBe('asc');
    expect(nextSort(asc, 'guestName')).toEqual({ field: 'guestName', direction: 'asc' });
  });
});
