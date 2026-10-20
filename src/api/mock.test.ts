import { createMockClient } from './mock';
import { mockReservations, mockStats } from './mockData';

afterEach(() => {
  vi.useRealTimers();
});

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
    expect(await c.reservations.list()).toEqual({ items: [], total: 0 });
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
  });
  it('rejects unusable ids with a 400', async () => {
    await expect(createMockClient().reservations.get('..')).rejects.toMatchObject({ status: 400 });
    await expect(createMockClient().reservations.get('')).rejects.toMatchObject({ status: 400 });
  });
  it('gets a reservation by id and 404s for an unknown id', async () => {
    const c = createMockClient();
    expect((await c.reservations.get('res-1001')).guestName).toBe('Margaret Ellison');
    await expect(c.reservations.get('nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('mock paging', () => {
  it('uses a small default page so paging is exercisable', async () => {
    const c = createMockClient();
    const first = await c.reservations.list();
    expect(first.items).toHaveLength(4);
    expect(first.total).toBe(6);
    const second = await c.reservations.list({ cursor: first.nextCursor });
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeUndefined();
  });
  it('filters and sorts through the query', async () => {
    const page = await createMockClient().reservations.list({
      status: 'checked-in',
      sort: { field: 'arrival', direction: 'desc' },
    });
    expect(page.items.map((r) => r.id)).toEqual(['res-1003', 'res-1004']);
  });
});

describe('mock hygiene', () => {
  it('returns copies that cannot corrupt module data', async () => {
    const c = createMockClient();
    (await c.dashboard.getStats()).rateCategories.pop();
    (await c.reservations.list()).items[0].guestName = 'X';
    (await c.reservations.get('res-1001')).guestName = 'X';
    const again = await c.dashboard.getStats();
    expect(again.rateCategories).toHaveLength(mockStats.rateCategories.length);
    expect(mockReservations.some((r) => r.guestName === 'X')).toBe(false);
  });
});

describe('mock cancellation', () => {
  it.each(['normal', 'loading', 'empty', 'error'] as const)(
    'rejects with AbortError when aborted in the %s scenario',
    async (scenario) => {
      const controller = new AbortController();
      const promise = createMockClient({ scenario, latencyMs: 1000 }).dashboard.getStats({
        signal: controller.signal,
      });
      controller.abort();
      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    },
  );
  it('rejects immediately for an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      createMockClient().reservations.list({}, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('clears its timer on abort', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const p = createMockClient({ latencyMs: 500 })
      .dashboard.getStats({ signal: controller.signal })
      .catch(() => {});
    controller.abort();
    await p;
    expect(vi.getTimerCount()).toBe(0);
  });
});
