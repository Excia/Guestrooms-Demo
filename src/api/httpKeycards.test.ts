import { createHttpClient } from './http';
import { ApiError } from './types';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

describe('http keycard API', () => {
  it('lists, saves (PUT) and retrieves (POST) encoder keys', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(['48001937465201'])));
    const api = make(fetchMock).keycards;
    expect(await api.listEncoders()).toEqual(['48001937465201']);
    await api.saveEncoders(['48001937465201']);
    await api.retrieveEncoders();
    const calls = fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method]);
    expect(calls).toEqual([
      ['https://api.example.com/v1/keycards/encoders', undefined],
      ['https://api.example.com/v1/keycards/encoders', 'PUT'],
      ['https://api.example.com/v1/keycards/encoders/retrieve', 'POST'],
    ]);
  });

  it('rejects a body that is not a list of stored-form keys', async () => {
    for (const body of [[5], ['12'], ['4800-1937-465201']]) {
      const fetchMock = vi.fn().mockResolvedValue(json(body));
      await expect(make(fetchMock).keycards.listEncoders()).rejects.toBeInstanceOf(ApiError);
    }
  });
});
