import { createMockClient, filterReservations } from './mock';
import { mockReservations, mockStats } from './mockData';

describe('mock client', () => {
  it('returns Figma placeholder shapes in the normal scenario', async () => {
    const stats = await createMockClient().dashboard.getStats();
    expect(stats.rateCategories.length).toBeGreaterThan(0);
    expect(stats.roomBlocks.length).toBeGreaterThan(0);
    expect(stats.unassignedChargesCount).toBeGreaterThan(0);
    expect(stats.totalNights).toBe(mockStats.rateCategories.reduce((n, c) => n + c.nights, 0));
  });
  it('keeps the weighted average consistent with totals', async () => {
    const s = await createMockClient().dashboard.getStats();
    expect(s.averageRate).toBe(Math.round(s.totalRevenue / s.totalNights));
  });
  it('returns empty data in the empty scenario', async () => {
    const c = createMockClient({ scenario: 'empty' });
    const s = await c.dashboard.getStats();
    expect(s.rateCategories).toEqual([]);
    expect(s.unassignedChargesCount).toBe(0);
    expect(s.averageRate).toBe(0);
    expect(await c.reservations.list()).toEqual([]);
    expect((await c.permissions.getGrant()).permissions).toEqual([]);
  });
  it('rejects with a 500 ApiError in the error scenario', async () => {
    const c = createMockClient({ scenario: 'error' });
    await expect(c.dashboard.getStats()).rejects.toMatchObject({ status: 500 });
    await expect(c.reservations.list()).rejects.toMatchObject({ status: 500 });
  });
  it('never settles in the loading scenario', async () => {
    const settled = vi.fn();
    createMockClient({ scenario: 'loading' }).dashboard.getStats().then(settled, settled);
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).not.toHaveBeenCalled();
  });
  it('simulates latency', async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    createMockClient({ latencyMs: 100 }).dashboard.getStats().then(done);
    await vi.advanceTimersByTimeAsync(99);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
    vi.useRealTimers();
  });
  it('gets a reservation by id and 404s for an unknown id', async () => {
    const c = createMockClient();
    expect((await c.reservations.get('res-1001')).guestName).toBe('Margaret Ellison');
    await expect(c.reservations.get('nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('filterReservations', () => {
  it('filters by status', () => {
    expect(filterReservations(mockReservations, { status: 'checked-in' })).toHaveLength(2);
  });
  it('searches name and confirmation number case-insensitively', () => {
    expect(filterReservations(mockReservations, { search: 'ELLISON' })).toHaveLength(1);
    expect(filterReservations(mockReservations, { search: 'gr-48214' })).toHaveLength(1);
  });
  it('combines filters and returns empty on no match', () => {
    expect(
      filterReservations(mockReservations, { status: 'cancelled', search: 'ellison' }),
    ).toEqual([]);
  });
});
