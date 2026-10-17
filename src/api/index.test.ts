import { createApiClient, createApiClientFromEnvironment } from './index';
import { resolveApiConfig } from './config';

const quietLog = () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
const env = (over: Record<string, unknown> = {}) =>
  ({ DEV: true, VITE_API_URL: undefined, VITE_MOCK_SCENARIO: undefined, ...over }) as never;

describe('createApiClient', () => {
  it('uses the fetch client when a base URL is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const client = createApiClient(
      resolveApiConfig({ apiUrl: 'https://api.test/v1', dev: false }),
      {
        dev: false,
        log: quietLog(),
      },
    );
    await client.dashboard.getStats();
    expect((fetchMock.mock.calls[0][0] as URL).href).toBe('https://api.test/v1/dashboard/stats');
    vi.unstubAllGlobals();
  });
  it('uses the mock in dev without a URL', async () => {
    const client = createApiClient(resolveApiConfig({ dev: true }), { dev: true, log: quietLog() });
    expect((await client.reservations.list()).items.length).toBeGreaterThan(0);
  });
  it('falls back to the mock with a warning for an invalid URL in dev', async () => {
    const log = quietLog();
    const client = createApiClient(resolveApiConfig({ apiUrl: 'nope', dev: true }), {
      dev: true,
      log,
    });
    expect(log.warn).toHaveBeenCalled();
    expect((await client.dashboard.getStats()).rateCategories.length).toBeGreaterThan(0);
  });
  it.each([undefined, 'nope'])(
    'fails loudly in production when VITE_API_URL is %s',
    async (apiUrl) => {
      const log = quietLog();
      const client = createApiClient(resolveApiConfig({ apiUrl, dev: false }), { dev: false, log });
      expect(log.error).toHaveBeenCalled();
      await expect(client.dashboard.getStats()).rejects.toMatchObject({
        name: 'ApiError',
        code: 'misconfigured',
      });
      await expect(client.permissions.getGrant()).rejects.toMatchObject({ code: 'misconfigured' });
    },
  );
});

describe('createApiClientFromEnvironment', () => {
  it('reads the scenario from the query string in dev', async () => {
    const client = createApiClientFromEnvironment({
      env: env(),
      search: '?mock=empty',
      log: quietLog(),
    });
    expect((await client.dashboard.getStats()).rateCategories).toEqual([]);
  });
  it('reads the scenario from storage in dev', async () => {
    const storage = { getItem: () => 'error' };
    const client = createApiClientFromEnvironment({
      env: env(),
      search: '',
      storage,
      log: quietLog(),
    });
    await expect(client.dashboard.getStats()).rejects.toMatchObject({ status: 500 });
  });
  it('survives storage that throws', async () => {
    const storage = {
      getItem: () => {
        throw new Error('denied');
      },
    };
    const client = createApiClientFromEnvironment({
      env: env(),
      search: '',
      storage,
      log: quietLog(),
    });
    expect((await client.dashboard.getStats()).rateCategories.length).toBeGreaterThan(0);
  });
  it('honours VITE_MOCK_SCENARIO in dev only', async () => {
    const dev = createApiClientFromEnvironment({
      env: env({ VITE_MOCK_SCENARIO: 'error' }),
      search: '',
      storage: { getItem: () => null },
      log: quietLog(),
    });
    await expect(dev.dashboard.getStats()).rejects.toMatchObject({ status: 500 });
    const prod = createApiClientFromEnvironment({
      env: env({ DEV: false, VITE_MOCK_SCENARIO: 'error', VITE_API_URL: 'https://api.test' }),
      search: '?mock=error',
      log: quietLog(),
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await prod.dashboard.getStats();
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
