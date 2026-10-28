import { createHttpClient } from './http';
import { ApiError } from './types';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });
type Client = ReturnType<typeof make>;

const KEY = { id: 'k', name: 'n', maskedKey: '•••1234', createdAt: '2026-10-28' };

describe('http integrations API', () => {
  it('uses the integration endpoints and methods', async () => {
    const body = (url: string) =>
      url.endsWith('/rotate') || url.endsWith('/api-keys')
        ? { key: KEY, secret: 's' }
        : url.endsWith('/test')
          ? { provider: 'tiger-tms', success: true }
          : url.endsWith('/authentications')
            ? { authentications: [], tests: [] }
            : [];
    const fetchMock = vi
      .fn()
      .mockImplementation((input: unknown) => Promise.resolve(json(body(String(input)))));
    const api = make(fetchMock).integrations;
    await api.createApiKey({ name: 'n', requestId: 'r1' });
    await api.rotateApiKey({ id: 'k 1', requestId: 'r2' });
    await api.listPayCloudTokens();
    await api.savePayCloudTokens([]);
    await api.saveAuthentications([]);
    await api.testConnection({
      provider: 'tiger-tms',
      enabled: true,
      baseUrl: 'https://a.example.com',
      userName: '',
    });
    const calls = fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method]);
    expect(calls).toEqual([
      ['https://api.example.com/v1/integrations/api-keys', 'POST'],
      ['https://api.example.com/v1/integrations/api-keys/k%201/rotate', 'POST'],
      ['https://api.example.com/v1/integrations/paycloud-tokens', undefined],
      ['https://api.example.com/v1/integrations/paycloud-tokens', 'PUT'],
      ['https://api.example.com/v1/integrations/authentications', 'PUT'],
      ['https://api.example.com/v1/integrations/authentications/test', 'POST'],
    ]);
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('r1');
  });

  it('never puts a secret in a URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ key: KEY, secret: 'topsecret' }));
    await make(fetchMock).integrations.createApiKey({ name: 'n', requestId: 'r' });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('topsecret');
  });

  it('revokes with DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await make(fetchMock).integrations.revokeApiKey('k');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('rejects malformed bodies without echoing them', async () => {
    const cases: [(a: Client) => Promise<unknown>, unknown][] = [
      [(a) => a.integrations.listApiKeys(), [{ id: 1 }]],
      [
        (a) => a.integrations.listPayCloudTokens(),
        [{ id: 'a', maskedKey: 'x', environment: 'moon' }],
      ],
      [(a) => a.integrations.listAuthentications(), [{ provider: 'nope' }]],
      [(a) => a.integrations.createApiKey({ name: 'n', requestId: 'r' }), { key: KEY }],
    ];
    for (const [call, body] of cases) {
      const fetchMock = vi.fn().mockResolvedValue(json(body));
      const error = await call(make(fetchMock)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).not.toContain('moon');
    }
  });
});
