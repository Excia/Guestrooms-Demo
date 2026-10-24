import { isWithinRetention } from '../app/changeLog';
import { mockChangeLog, queryChangeLog } from './changeLogData';
import { assertChangeLogQuery } from './changeLogValidation';
import { createMockClient } from './mock';
import { MOCK_TODAY } from './mockData';

const all = mockChangeLog(MOCK_TODAY)['system-settings'];

describe('queryChangeLog', () => {
  it('sorts newest first by default and drops entries older than one year', () => {
    expect(all.some((e) => !isWithinRetention(e.date, MOCK_TODAY))).toBe(true);
    const page = queryChangeLog(all, { page: 'system-settings', limit: 200 }, MOCK_TODAY);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((e) => isWithinRetention(e.date, MOCK_TODAY))).toBe(true);
    const keys = page.items.map((e) => e.date + e.time);
    expect(keys).toEqual([...keys].sort().reverse());
    expect(page.total).toBe(page.items.length);
  });
  it('pages the result', () => {
    const q = { page: 'system-settings', limit: 10 } as const;
    const first = queryChangeLog(all, q, MOCK_TODAY);
    const second = queryChangeLog(all, { ...q, pageNumber: 2 }, MOCK_TODAY);
    expect(first.items).toHaveLength(10);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    expect(second.total).toBe(first.total);
  });
  it('filters by date range, time of day, change type, employee and description', () => {
    const base = { page: 'system-settings', limit: 200 } as const;
    const day = queryChangeLog(
      all,
      { ...base, sort: { field: 'date', direction: 'asc' } },
      MOCK_TODAY,
    );
    const target = day.items[5];
    const byDate = queryChangeLog(
      all,
      { ...base, dateFrom: target.date, dateTo: target.date },
      MOCK_TODAY,
    );
    expect(byDate.items.length).toBeGreaterThan(0);
    expect(byDate.items.every((e) => e.date === target.date)).toBe(true);
    const from = target.time;
    const to = day.items[20].time > from ? day.items[20].time : '23:59';
    const byTime = queryChangeLog(all, { ...base, timeFrom: from, timeTo: to }, MOCK_TODAY);
    expect(byTime.items.length).toBeGreaterThan(0);
    expect(byTime.items.every((e) => e.time >= from && e.time <= to)).toBe(true);
    const byType = queryChangeLog(all, { ...base, changeTypes: ['updated'] }, MOCK_TODAY);
    expect(byType.items.length).toBeGreaterThan(0);
    expect(byType.items.every((e) => e.changeType === 'updated')).toBe(true);
    const byWho = queryChangeLog(all, { ...base, actionBy: 'sam' }, MOCK_TODAY);
    expect(byWho.items.length).toBeGreaterThan(0);
    expect(byWho.items.every((e) => e.actionBy === 'Sam Ortega')).toBe(true);
    const byText = queryChangeLog(all, { ...base, search: 'night audit' }, MOCK_TODAY);
    expect(byText.items.length).toBeGreaterThan(0);
  });
  it('reverses the whole list, ties included, when the direction flips', () => {
    const base = { page: 'system-settings', limit: 200 } as const;
    const asc = queryChangeLog(
      all,
      { ...base, sort: { field: 'actionBy', direction: 'asc' } },
      MOCK_TODAY,
    );
    const desc = queryChangeLog(
      all,
      { ...base, sort: { field: 'actionBy', direction: 'desc' } },
      MOCK_TODAY,
    );
    expect(desc.items.map((e) => e.id)).toEqual(asc.items.map((e) => e.id).reverse());
  });
  it('sorts by time of day and by change type label', () => {
    const base = { page: 'system-settings', limit: 200 } as const;
    const byTime = queryChangeLog(
      all,
      { ...base, sort: { field: 'time', direction: 'asc' } },
      MOCK_TODAY,
    );
    const times = byTime.items.map((e) => e.time);
    expect(times).toEqual([...times].sort());
    const byType = queryChangeLog(
      all,
      { ...base, sort: { field: 'changeType', direction: 'asc' } },
      MOCK_TODAY,
    );
    expect(byType.items[0].changeType).toBe('setting-changed');
    expect(byType.items.at(-1)?.changeType).toBe('updated');
  });
});

describe('assertChangeLogQuery', () => {
  it('accepts a normal query and refuses bad input', () => {
    expect(() => assertChangeLogQuery({ page: 'rooms', timeFrom: '08:00' })).not.toThrow();
    expect(() => assertChangeLogQuery({ page: 'nope' as never })).toThrow();
    expect(() => assertChangeLogQuery({ page: 'rooms', timeFrom: '8am' })).toThrow();
    expect(() => assertChangeLogQuery({ page: 'rooms', pageNumber: 0 })).toThrow();
    expect(() => assertChangeLogQuery({ page: 'rooms', dateFrom: 'x' })).toThrow();
    expect(() => assertChangeLogQuery({ page: 'rooms', dateFrom: '2026-13-45' })).toThrow();
    expect(() =>
      assertChangeLogQuery({ page: 'rooms', dateFrom: '2026-05-02', dateTo: '2026-05-01' }),
    ).toThrow();
    expect(() => assertChangeLogQuery({ page: 'rooms', changeTypes: ['a,b'] })).toThrow();
  });
});

describe('mock change log client', () => {
  it('lists only the page asked for and the event types', async () => {
    const client = createMockClient();
    const rooms = await client.changeLog.list({ page: 'rooms' });
    expect(rooms.items.every((e) => e.id.startsWith('rooms-'))).toBe(true);
    expect((await client.changeLog.listEventTypes()).map((t) => t.label)).toContain('Created');
  });
  it('answers empty in the empty scenario and fails in the error scenario', async () => {
    expect(await createMockClient({ scenario: 'empty' }).changeLog.list({ page: 'rooms' })).toEqual(
      {
        items: [],
        total: 0,
      },
    );
    await expect(
      createMockClient({ scenario: 'error' }).changeLog.list({ page: 'rooms' }),
    ).rejects.toMatchObject({ status: 500 });
  });
  it('rejects a malformed query with 400', async () => {
    await expect(
      createMockClient().changeLog.list({ page: 'rooms', limit: 0 }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
