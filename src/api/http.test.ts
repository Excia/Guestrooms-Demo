import { createHttpClient } from './http';
import { ApiError } from './types';

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

describe('createHttpClient', () => {
  it('requests paths under the configured base URL with query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([]));
    const client = createHttpClient('https://api.example.com/v1', fetchMock);
    await client.reservations.list({ status: 'confirmed', search: 'ada' });
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.origin + url.pathname).toBe('https://api.example.com/v1/reservations');
    expect(url.searchParams.get('status')).toBe('confirmed');
    expect(url.searchParams.get('search')).toBe('ada');
  });
  it('encodes ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    await createHttpClient('https://x.test', fetchMock).reservations.get('a/b');
    expect((fetchMock.mock.calls[0][0] as URL).pathname).toBe('/reservations/a%2Fb');
  });
  it('maps non-2xx to ApiError with the status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 404, statusText: 'Not Found' }));
    await expect(
      createHttpClient('https://x.test', fetchMock).dashboard.getStats(),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
    });
  });
  it('maps network failures to ApiError status 0', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('failed'));
    const err = await createHttpClient('https://x.test', fetchMock)
      .permissions.getGrant()
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
  });
});
