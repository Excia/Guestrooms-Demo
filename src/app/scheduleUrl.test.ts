import {
  activeFilterCount,
  applyScheduleView,
  DEFAULT_SCHEDULE_VIEW,
  parseScheduleView,
  toggleFilterId,
} from './scheduleUrl';

describe('parseScheduleView', () => {
  it('defaults an empty query to the default view', () => {
    expect(parseScheduleView('')).toEqual(DEFAULT_SCHEDULE_VIEW);
  });
  it('reads every field', () => {
    expect(
      parseScheduleView('?start=2026-11-10&view=14&locations=a,b&types=king&rooms=booked'),
    ).toEqual({
      start: '2026-11-10',
      days: 14,
      locationIds: ['a', 'b'],
      roomTypeIds: ['king'],
      availability: 'booked',
    });
  });
  it('treats an empty list as "none" and an absent one as "all"', () => {
    expect(parseScheduleView('?locations=').locationIds).toEqual([]);
    expect(parseScheduleView('?types=').roomTypeIds).toEqual([]);
    expect(parseScheduleView('').locationIds).toBeNull();
  });
  it('treats only separators as unset, not as none', () => {
    expect(parseScheduleView('?types=,,&locations=,').roomTypeIds).toBeNull();
    expect(parseScheduleView('?types=,,&locations=,').locationIds).toBeNull();
    expect(parseScheduleView('?types= , ').roomTypeIds).toBeNull();
  });
  it('is tolerant of bad input', () => {
    const v = parseScheduleView('?start=2026-02-30&view=9&rooms=everything&locations=a,,a, b ');
    expect(v.start).toBeNull();
    expect(v.days).toBe(7);
    expect(v.availability).toBe('all');
    expect(v.locationIds).toEqual(['a', 'b']);
    expect(parseScheduleView('?start=tomorrow&view=abc').start).toBeNull();
  });
  it('accepts URLSearchParams too', () => {
    expect(parseScheduleView(new URLSearchParams('view=30')).days).toBe(30);
  });
});

describe('applyScheduleView', () => {
  it('omits defaults and keeps unrelated parameters', () => {
    const next = applyScheduleView(new URLSearchParams('mock=empty&view=30&rooms=booked'), {
      ...DEFAULT_SCHEDULE_VIEW,
    });
    expect(next.toString()).toBe('mock=empty');
  });
  it('writes non-default fields, including "none" as an empty list', () => {
    const next = applyScheduleView(new URLSearchParams(), {
      start: '2026-11-10',
      days: 14,
      locationIds: [],
      roomTypeIds: ['king', 'suite'],
      availability: 'available',
    });
    expect(next.get('start')).toBe('2026-11-10');
    expect(next.get('view')).toBe('14');
    expect(next.get('locations')).toBe('');
    expect(next.has('locations')).toBe(true);
    expect(next.get('types')).toBe('king,suite');
    expect(next.get('rooms')).toBe('available');
  });
  it('round-trips through parse', () => {
    const state = {
      start: '2027-01-02',
      days: 30 as const,
      locationIds: ['x'],
      roomTypeIds: [],
      availability: 'booked' as const,
    };
    expect(parseScheduleView(applyScheduleView(new URLSearchParams(), state))).toEqual(state);
  });
});

describe('filters', () => {
  const all = ['a', 'b', 'c'];
  it('unchecking one of "all" leaves the others', () => {
    expect(toggleFilterId(null, all, 'b')).toEqual(['a', 'c']);
  });
  it('checking the last missing id goes back to "all"', () => {
    expect(toggleFilterId(['a', 'c'], all, 'b')).toBeNull();
  });
  it('can reach none', () => {
    expect(toggleFilterId(['a'], all, 'a')).toEqual([]);
    expect(toggleFilterId([], all, 'a')).toEqual(['a']);
  });
  it('counts narrowed filters', () => {
    expect(activeFilterCount(DEFAULT_SCHEDULE_VIEW)).toBe(0);
    expect(
      activeFilterCount({ ...DEFAULT_SCHEDULE_VIEW, locationIds: [], availability: 'booked' }),
    ).toBe(2);
  });
});
