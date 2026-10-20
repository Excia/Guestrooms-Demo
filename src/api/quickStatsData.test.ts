import { createMockClient } from './mock';
import { MOCK_SELLABLE_ROOMS, buildQuickStats } from './quickStatsData';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('mock quick stats', () => {
  it('is deterministic for a query and varies between queries', () => {
    const a = buildQuickStats({ view: 'day', date: '2026-10-16' });
    expect(buildQuickStats({ view: 'day', date: '2026-10-16' })).toEqual(a);
    expect(buildQuickStats({ view: 'day', date: '2026-10-17' })).not.toEqual(a);
  });

  it('keeps day occupancy within the sellable rooms and revenue consistent', () => {
    const s = buildQuickStats({ view: 'day', date: '2026-03-05' });
    expect(s.occupancy.booked + s.occupancy.available).toBe(MOCK_SELLABLE_ROOMS);
    expect(s.revenue.totalRevenue).toBe(sum(s.revenue.rows.map((r) => r.revenue)));
    expect(s.revenue.totalNights).toBe(sum(s.revenue.rows.map((r) => r.nights)));
    expect(s.revenue.averageRate).toBe(Math.round(s.revenue.totalRevenue / s.revenue.totalNights));
    expect(s.view === 'day' && s.roomBlocks.length).toBeGreaterThan(0);
  });

  it('covers seven consecutive days in the week view, across a year end', () => {
    const s = buildQuickStats({ view: 'week', startDate: '2026-12-28' });
    expect(s.view).toBe('week');
    if (s.view !== 'week') return;
    expect(s.days.map((d) => d.date)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(s.daysTotal.booked).toBe(sum(s.days.map((d) => d.counts.booked)));
    // Nights follow the booked rooms of the week.
    expect(s.revenue.totalNights).toBeGreaterThan(0);
  });

  it('covers a whole month, leap February included', () => {
    const s = buildQuickStats({ view: 'month', month: '2028-02' });
    expect(s.view).toBe('month');
    expect(s.revenue.totalNights).toBeGreaterThan(0);
  });
});

describe('mock client getQuickStats', () => {
  it('returns the view that was asked for', async () => {
    const api = createMockClient().dashboard;
    expect((await api.getQuickStats({ view: 'day', date: '2026-10-16' })).view).toBe('day');
    expect((await api.getQuickStats({ view: 'week', startDate: '2026-10-11' })).view).toBe('week');
    expect((await api.getQuickStats({ view: 'month', month: '2026-10' })).view).toBe('month');
  });

  it('rejects a malformed query with a 400', async () => {
    const api = createMockClient().dashboard;
    await expect(api.getQuickStats({ view: 'day', date: '2026-02-30' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(api.getQuickStats({ view: 'month', month: '2026-13' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('answers empty, error and loading scenarios', async () => {
    const empty = await createMockClient({ scenario: 'empty' }).dashboard.getQuickStats({
      view: 'day',
      date: '2026-10-16',
    });
    expect(empty.revenue.rows).toEqual([]);
    expect(empty.revenue.averageRate).toBeNull();
    await expect(
      createMockClient({ scenario: 'error' }).dashboard.getQuickStats({
        view: 'day',
        date: '2026-10-16',
      }),
    ).rejects.toMatchObject({ status: 500 });
    const settled = vi.fn();
    createMockClient({ scenario: 'loading' })
      .dashboard.getQuickStats({ view: 'day', date: '2026-10-16' })
      .then(settled, settled);
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).not.toHaveBeenCalled();
  });

  it('honours an abort signal', async () => {
    const controller = new AbortController();
    const pending = createMockClient({ latencyMs: 50 }).dashboard.getQuickStats(
      { view: 'day', date: '2026-10-16' },
      { signal: controller.signal },
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
