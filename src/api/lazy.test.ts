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
    expect(load).toHaveBeenCalledOnce();
  });
  it('forwards arguments, including the abort signal', async () => {
    const client = createLazyClient(async () => createMockClient({ latencyMs: 1000 }));
    const controller = new AbortController();
    const promise = client.dashboard.getStats({ signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('surfaces a load failure as a rejection', async () => {
    const client = createLazyClient(() => Promise.reject(new Error('chunk failed')));
    await expect(client.dashboard.getStats()).rejects.toThrow('chunk failed');
  });
});
