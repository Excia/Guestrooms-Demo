import { createHttpClient } from './http';
import { mockRoomOptions } from './roomOptionsData';
const MOCK_ROOM_OPTIONS = mockRoomOptions();
import { ApiError } from './types';

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { status: 200, ...init });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

describe('http room options API', () => {
  it('GETs /room-options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(MOCK_ROOM_OPTIONS));
    expect(await make(fetchMock).roomOptions.get()).toEqual(MOCK_ROOM_OPTIONS);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/room-options');
  });

  it('PUTs both lists with the idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(MOCK_ROOM_OPTIONS));
    await make(fetchMock).roomOptions.save({
      requestId: 'abc',
      version: 'ro-1',
      features: [{ label: 'Sauna' }],
      bedSizes: [],
    });
    const init = fetchMock.mock.calls[0][1];
    expect(init).toMatchObject({ method: 'PUT' });
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('abc');
    expect(new Headers(init.headers).get('If-Match')).toBe('ro-1');
    expect(JSON.parse(init.body)).toEqual({
      requestId: 'abc',
      version: 'ro-1',
      features: [{ label: 'Sauna' }],
      bedSizes: [],
    });
  });

  it('rejects a body that is not two lists of labelled items', async () => {
    for (const bad of [
      [],
      { features: [] },
      { features: [], bedSizes: [] },
      { version: 'v', features: [{ id: 'x' }], bedSizes: [] },
    ]) {
      const fetchMock = vi.fn().mockResolvedValue(json(bad));
      await expect(make(fetchMock).roomOptions.get()).rejects.toBeInstanceOf(ApiError);
    }
  });

  it('keeps the in-use details of a 409', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json(
          { code: 'in-use', message: 'in use', details: { features: ['feature-fridge'] } },
          { status: 409 },
        ),
      );
    await expect(
      make(fetchMock).roomOptions.save({
        requestId: 'r',
        version: 'ro-1',
        features: [],
        bedSizes: [],
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'in-use',
      details: { features: ['feature-fridge'] },
    });
  });
});
