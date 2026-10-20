import { createLazyClient } from './lazy';
import { createMockClient } from './mock';

describe('createLazyClient', () => {
  it('does not load until first use, then loads once', async () => {
    const load = vi.fn().mockResolvedValue(createMockClient());
    const client = createLazyClient(load);
    expect(load).not.toHaveBeenCalled();
    await client.dashboard.getStats();
    await client.reservations.get('res-1001');
    await client.permissions.getGrant();
    await client.reservations.list();
    await client.schedule.get({ startDate: '2026-10-16', days: 7 });
    expect(load).toHaveBeenCalledOnce();
  });
  it('forwards arguments, including the abort signal', async () => {
    const client = createLazyClient(async () => createMockClient({ latencyMs: 1000 }));
    const controller = new AbortController();
    const promise = client.dashboard.getStats({ signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('forwards schedule moves to the loaded client', async () => {
    const client = createLazyClient(async () => createMockClient({ today: '2026-10-16' }));
    const current = (await client.schedule.get({ startDate: '2026-10-16', days: 7 })).blocks.find(
      (b) => b.id === 'rr-3',
    )!;
    const room = await client.schedule.moveRoom({
      reservationRoomId: 'rr-3',
      toRoomId: 'rm-203',
      fromRoomId: current.roomId,
      version: current.version,
      requestId: 'req-lazy-0001',
    });
    expect(room.blocks[0].roomId).toBe('rm-203');
    const dates = await client.schedule.moveDates({
      reservationRoomId: 'rr-3',
      toStartDate: '2026-10-30',
      scope: 'all-rooms',
      fromRoomId: 'rm-203',
      fromStartDate: current.startDate,
      version: room.blocks[0].version,
      requestId: 'req-lazy-0002',
    });
    expect(dates.blocks[0].startDate).toBe('2026-10-30');
  });
  it('surfaces a load failure as a rejection', async () => {
    const client = createLazyClient(() => Promise.reject(new Error('chunk failed')));
    await expect(client.dashboard.getStats()).rejects.toThrow('chunk failed');
  });
  it('retries after a failed load', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce(createMockClient());
    const client = createLazyClient(load);
    await expect(client.dashboard.getStats()).rejects.toThrow('chunk failed');
    expect((await client.dashboard.getStats()).totalNights).toBeGreaterThan(0);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('aborts while the loader is still pending', async () => {
    let release!: (c: ReturnType<typeof createMockClient>) => void;
    const client = createLazyClient(() => new Promise((resolve) => (release = resolve)));
    const controller = new AbortController();
    const promise = client.dashboard.getStats({ signal: controller.signal });
    controller.abort();
    release(createMockClient());
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
