import { createApiClient, createApiClientFromEnvironment } from './index';
import { resolveApiConfig } from './config';

const quietLog = () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
const env = (over: Record<string, unknown> = {}) =>
  ({
    DEV: true,
    VITE_API_URL: undefined,
    VITE_API_MODE: undefined,
    VITE_MOCK_SCENARIO: undefined,
    ...over,
  }) as never;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createApiClient', () => {
  it('uses the fetch client when a base URL is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const { client, demo } = createApiClient(
      resolveApiConfig({ apiUrl: 'https://api.test/v1', dev: false }),
      quietLog(),
    );
    await client.dashboard.getStats().catch(() => {});
    expect((fetchMock.mock.calls[0][0] as URL).href).toBe('https://api.test/v1/dashboard/stats');
    expect(demo).toBe(false);
  });
  it('uses the mock in dev without a URL, with no demo chip', async () => {
    const { client, demo } = createApiClient(resolveApiConfig({ dev: true }), quietLog());
    expect((await client.reservations.list()).items.length).toBeGreaterThan(0);
    expect(demo).toBe(false);
  });
  it('falls back to the mock with a warning for an invalid URL in dev', async () => {
    const log = quietLog();
    const { client } = createApiClient(resolveApiConfig({ apiUrl: 'nope', dev: true }), log);
    expect(log.warn).toHaveBeenCalled();
    expect((await client.dashboard.getStats()).rateCategories.length).toBeGreaterThan(0);
  });
  it('production + mock flag -> mock client and demo indicator', async () => {
    const { client, demo } = createApiClient(
      resolveApiConfig({ dev: false, apiMode: 'mock' }),
      quietLog(),
    );
    expect(demo).toBe(true);
    expect((await client.dashboard.getStats()).rateCategories.length).toBeGreaterThan(0);
  });
  it('production + flag + URL -> the URL wins and a warning explains', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const log = quietLog();
    const { client, demo } = createApiClient(
      resolveApiConfig({ dev: false, apiMode: 'mock', apiUrl: 'https://api.test' }),
      log,
    );
    await client.dashboard.getStats().catch(() => {});
    expect(fetchMock).toHaveBeenCalled();
    expect(demo).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('VITE_API_MODE=mock is ignored'));
  });
  it.each([undefined, 'nope'])(
    'production without the flag and VITE_API_URL=%s fails loudly',
    async (apiUrl) => {
      const log = quietLog();
      const { client, demo } = createApiClient(resolveApiConfig({ apiUrl, dev: false }), log);
      expect(demo).toBe(false);
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
    const { client } = createApiClientFromEnvironment({
      env: env(),
      search: '?mock=empty',
      log: quietLog(),
    });
    expect((await client.dashboard.getStats()).rateCategories).toEqual([]);
  });
  it('reads the scenario from storage in dev', async () => {
    const { client } = createApiClientFromEnvironment({
      env: env(),
      search: '',
      storage: { getItem: () => 'error' },
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
    const { client } = createApiClientFromEnvironment({
      env: env(),
      search: '',
      storage,
      log: quietLog(),
    });
    expect((await client.dashboard.getStats()).rateCategories.length).toBeGreaterThan(0);
  });
  it('honours VITE_MOCK_SCENARIO in dev', async () => {
    const { client } = createApiClientFromEnvironment({
      env: env({ VITE_MOCK_SCENARIO: 'error' }),
      search: '',
      storage: { getItem: () => null },
      log: quietLog(),
    });
    await expect(client.dashboard.getStats()).rejects.toMatchObject({ status: 500 });
  });
  it('in production ignores ?mock= and storage, and VITE_MOCK_SCENARIO without the flag', async () => {
    const { client } = createApiClientFromEnvironment({
      env: env({ DEV: false, VITE_MOCK_SCENARIO: 'error' }),
      search: '?mock=error',
      log: quietLog(),
    });
    await expect(client.dashboard.getStats()).rejects.toMatchObject({ code: 'misconfigured' });
  });
  it('in production with the flag honours VITE_MOCK_SCENARIO but not ?mock=', async () => {
    const { client, demo } = createApiClientFromEnvironment({
      env: env({ DEV: false, VITE_API_MODE: 'mock', VITE_MOCK_SCENARIO: 'empty' }),
      search: '?mock=error',
      log: quietLog(),
    });
    expect(demo).toBe(true);
    expect((await client.dashboard.getStats()).rateCategories).toEqual([]);
  });
});
