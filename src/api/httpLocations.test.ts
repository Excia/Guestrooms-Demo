import { createHttpClient } from './http';
import { mockLocations, MOCK_LOCATION_AREAS } from './locationsData';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

describe('http locations client', () => {
  it('lists locations from /locations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(mockLocations()));
    const list = await make(fetchMock).locations.list();
    expect(list).toHaveLength(3);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/locations');
  });

  it('lists areas from /locations/areas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(MOCK_LOCATION_AREAS));
    expect(await make(fetchMock).locations.listAreas()).toHaveLength(MOCK_LOCATION_AREAS.length);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/locations/areas');
  });

  it('saves with PUT and the whole list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(mockLocations()));
    const rows = mockLocations().map(({ id, name, area }) => ({ id, name, area }));
    await make(fetchMock).locations.save(rows);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.example.com/v1/locations');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual(rows);
  });

  it('rejects malformed responses', async () => {
    const [first] = mockLocations();
    const bad = [
      [{ ...first, usage: undefined }],
      [{ ...first, name: 5 }],
      [{ ...first, area: { id: 1 } }],
      [{ ...first, usage: { roomTypes: [1], roomCount: 0 } }],
      { locations: [] },
    ];
    for (const body of bad) {
      await expect(
        make(vi.fn().mockResolvedValue(json(body))).locations.list(),
      ).rejects.toMatchObject({
        status: 200,
        code: 'invalid-response',
      });
    }
    await expect(
      make(vi.fn().mockResolvedValue(json([{ id: 'a' }]))).locations.listAreas(),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
});
