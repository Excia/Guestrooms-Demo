import { nightsOverlap } from '../lib/dates';
import { queryScheduleData } from '../api/scheduleQuery';
import { createScheduleState } from '../api/scheduleData';
import {
  applyScheduleFilters,
  blockLayout,
  dayHeader,
  groupByRoom,
  parseScheduleDays,
  roomRowLabel,
  scheduleDates,
  scheduleRangeEnd,
  shiftScheduleStart,
  visibleRowRange,
} from './schedule';

describe('view range', () => {
  it('lists consecutive dates for 7, 14 and 30 days', () => {
    expect(scheduleDates('2026-11-09', 7)).toHaveLength(7);
    expect(scheduleDates('2026-11-09', 14).at(-1)).toBe('2026-11-22');
    expect(scheduleDates('2026-11-09', 30).at(-1)).toBe('2026-12-08');
    expect(scheduleRangeEnd('2026-11-09', 7)).toBe('2026-11-16');
  });
  it('crosses month, year and leap-day boundaries', () => {
    expect(scheduleDates('2026-12-29', 7).slice(-2)).toEqual(['2027-01-03', '2027-01-04']);
    expect(scheduleDates('2028-02-26', 7)).toContain('2028-02-29');
    expect(scheduleDates('2027-02-26', 7)).not.toContain('2027-02-29');
  });
  it('is not shifted by daylight saving changes', () => {
    expect(scheduleDates('2026-03-07', 7).slice(0, 3)).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
    ]);
    expect(scheduleDates('2026-10-31', 7).slice(0, 3)).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
  it('moves by one day (single chevron) or a page (double chevron)', () => {
    expect(shiftScheduleStart('2026-11-09', 7, 1, 'day')).toBe('2026-11-10');
    expect(shiftScheduleStart('2026-11-09', 7, -1, 'day')).toBe('2026-11-08');
    expect(shiftScheduleStart('2026-11-09', 7, 1, 'page')).toBe('2026-11-16');
    expect(shiftScheduleStart('2026-11-09', 30, -1, 'page')).toBe('2026-10-10');
    expect(shiftScheduleStart('2026-12-28', 14, 1, 'page')).toBe('2027-01-11');
  });
  it('falls back to 7 days for an unknown view', () => {
    expect(parseScheduleDays('14')).toBe(14);
    expect(parseScheduleDays(30)).toBe(30);
    expect(parseScheduleDays('9')).toBe(7);
    expect(parseScheduleDays(undefined)).toBe(7);
  });
});

describe('headers', () => {
  it('formats the weekday header like the design', () => {
    expect(dayHeader('2026-11-10')).toBe('Tuesday 11/10');
    expect(dayHeader('2026-11-09')).toBe('Monday 11/9');
    expect(dayHeader('2028-02-29')).toBe('Tuesday 2/29');
    expect(dayHeader('nope')).toBe('nope');
  });
  it('builds the "location | room type" row header', () => {
    const s = createScheduleState('2026-10-16');
    expect(roomRowLabel(s.rooms[0], s.locations, s.roomTypes)).toEqual({
      location: 'Main Clubhouse',
      roomType: 'King Deluxe',
      number: '201',
      label: 'Main Clubhouse | King Deluxe',
    });
  });
});

describe('blockLayout', () => {
  const start = '2026-11-09';
  it('places a stay by column and span (one column per night)', () => {
    expect(blockLayout({ startDate: '2026-11-10', endDate: '2026-11-12' }, start, 7)).toEqual({
      column: 1,
      span: 2,
      continuesBefore: false,
      continuesAfter: false,
    });
    expect(blockLayout({ startDate: start, endDate: '2026-11-10' }, start, 7)?.span).toBe(1);
  });
  it('clips at the left edge', () => {
    expect(blockLayout({ startDate: '2026-11-06', endDate: '2026-11-11' }, start, 7)).toEqual({
      column: 0,
      span: 2,
      continuesBefore: true,
      continuesAfter: false,
    });
  });
  it('clips at the right edge', () => {
    expect(blockLayout({ startDate: '2026-11-14', endDate: '2026-11-20' }, start, 7)).toEqual({
      column: 5,
      span: 2,
      continuesBefore: false,
      continuesAfter: true,
    });
  });
  it('clips both edges for a stay longer than the range', () => {
    expect(blockLayout({ startDate: '2026-11-01', endDate: '2026-12-01' }, start, 14)).toEqual({
      column: 0,
      span: 14,
      continuesBefore: true,
      continuesAfter: true,
    });
  });
  it('has no layout outside the range, and a departure at the range start is outside', () => {
    expect(blockLayout({ startDate: '2026-11-05', endDate: '2026-11-09' }, start, 7)).toBeNull();
    expect(blockLayout({ startDate: '2026-11-16', endDate: '2026-11-18' }, start, 7)).toBeNull();
    expect(blockLayout({ startDate: '2026-11-10', endDate: '2026-11-10' }, start, 7)).toBeNull();
  });
  it('puts same-day turnover in adjacent columns that never overlap', () => {
    const a = blockLayout({ startDate: '2026-11-09', endDate: '2026-11-11' }, start, 7)!;
    const b = blockLayout({ startDate: '2026-11-11', endDate: '2026-11-13' }, start, 7)!;
    expect(a.column + a.span).toBe(b.column);
    expect(nightsOverlap('2026-11-09', '2026-11-11', '2026-11-11', '2026-11-13')).toBe(false);
  });
  it('works across a month and year end', () => {
    expect(
      blockLayout({ startDate: '2026-12-31', endDate: '2027-01-02' }, '2026-12-29', 7),
    ).toMatchObject({
      column: 2,
      span: 2,
    });
  });
  it('never exceeds the columns, for every stay in the 200-room data', () => {
    const s = createScheduleState('2026-10-16', 'large');
    for (const days of [7, 14, 30] as const) {
      for (const b of s.blocks) {
        const l = blockLayout(b, '2026-10-16', days);
        if (l) {
          expect(l.column).toBeGreaterThanOrEqual(0);
          expect(l.span).toBeGreaterThanOrEqual(1);
          expect(l.column + l.span).toBeLessThanOrEqual(days);
        }
      }
    }
  });
});

describe('applyScheduleFilters', () => {
  const T = '2026-10-16';
  const all = () => queryScheduleData(createScheduleState(T), { startDate: T, days: 7 });
  const ids = (d: { rooms: { id: string }[] }) => d.rooms.map((r) => r.id);

  it('keeps everything without filters', () => {
    expect(applyScheduleFilters(all(), {}).rooms).toHaveLength(all().rooms.length);
  });
  it('filters by location and by room type, and by both together', () => {
    const lodge = applyScheduleFilters(all(), { locationIds: ['north-lodge'] });
    expect(lodge.rooms.every((r) => r.locationId === 'north-lodge')).toBe(true);
    expect(lodge.rooms).toHaveLength(10);
    const suites = applyScheduleFilters(all(), { roomTypeIds: ['suite'] });
    expect(suites.rooms.every((r) => r.roomTypeId === 'suite')).toBe(true);
    const both = applyScheduleFilters(all(), {
      locationIds: ['north-lodge'],
      roomTypeIds: ['suite'],
    });
    expect(ids(both)).toEqual(['rm-109', 'rm-110']);
  });
  it('treats an empty selection ("Select None") as no rooms', () => {
    expect(applyScheduleFilters(all(), { locationIds: [] }).rooms).toEqual([]);
    expect(applyScheduleFilters(all(), { roomTypeIds: [] }).blocks).toEqual([]);
  });
  it('drops blocks and closures of filtered-out rooms, keeps option lists', () => {
    const d = applyScheduleFilters(all(), { locationIds: ['lakeside'] });
    const keep = new Set(ids(d));
    expect(d.blocks.every((b) => keep.has(b.roomId))).toBe(true);
    expect(d.closures.every((c) => keep.has(c.roomId))).toBe(true);
    expect(d.locations).toHaveLength(3);
  });
  it('booked only: rooms with a reservation in range', () => {
    const d = applyScheduleFilters(all(), { availability: 'booked' });
    expect(d.rooms.length).toBeGreaterThan(0);
    const booked = new Set(all().blocks.map((b) => b.roomId));
    expect(d.rooms.every((r) => booked.has(r.id))).toBe(true);
  });
  it('available only: no reservation and no closure in range', () => {
    const base = all();
    const d = applyScheduleFilters(base, { availability: 'available' });
    const busy = new Set([...base.blocks, ...base.closures].map((x) => x.roomId));
    expect(d.rooms.length).toBeGreaterThan(0);
    expect(d.rooms.every((r) => !busy.has(r.id))).toBe(true);
    expect(d.blocks).toEqual([]);
    // A closure-only room is neither available nor booked.
    expect(ids(d)).not.toContain('rm-208');
    expect(ids(applyScheduleFilters(base, { availability: 'booked' }))).not.toContain('rm-208');
  });
  it('decides by the selected range: a longer view books more rooms', () => {
    const week = queryScheduleData(createScheduleState(T), {
      startDate: T,
      days: 7,
      availability: 'booked',
    });
    const month = queryScheduleData(createScheduleState(T), {
      startDate: T,
      days: 30,
      availability: 'booked',
    });
    expect(month.rooms.length).toBeGreaterThanOrEqual(week.rooms.length);
    const later = queryScheduleData(createScheduleState(T), {
      startDate: '2026-12-20',
      days: 7,
      availability: 'booked',
    });
    expect(later.rooms).toEqual([]);
  });
  it('does not count a departure on the first day of the range as booked', () => {
    const d = queryScheduleData(createScheduleState(T), { startDate: '2026-10-18', days: 7 });
    // rm-210 / rm-206 (GR-50290) depart on day +1; rm-201 GR-50240 departs on day +2 = range start.
    expect(d.blocks.find((b) => b.confirmationNumber === 'GR-50240')).toBeUndefined();
  });
});

describe('groupByRoom and visibleRowRange', () => {
  it('groups by room sorted by start date', () => {
    const g = groupByRoom([
      { roomId: 'a', startDate: '2026-10-20' },
      { roomId: 'b', startDate: '2026-10-18' },
      { roomId: 'a', startDate: '2026-10-18' },
    ]);
    expect(g.get('a')?.map((x) => x.startDate)).toEqual(['2026-10-18', '2026-10-20']);
    expect(g.get('b')).toHaveLength(1);
  });
  it('windows rows with overscan and clamps at both ends', () => {
    expect(visibleRowRange(0, 400, 40, 200, 5)).toEqual({ start: 0, end: 15 });
    expect(visibleRowRange(2000, 400, 40, 200, 5)).toEqual({ start: 45, end: 65 });
    expect(visibleRowRange(99999, 400, 40, 200, 5)).toEqual({ start: 200, end: 200 });
    expect(visibleRowRange(0, 400, 40, 0)).toEqual({ start: 0, end: 0 });
    expect(visibleRowRange(-50, 400, 40, 3, 0)).toEqual({ start: 0, end: 3 });
  });
});
