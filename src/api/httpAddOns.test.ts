import { createHttpClient } from './http';
import { mockAddOns } from './addOnData';
import { ApiError } from './types';

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { status: 200, ...init });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

describe('http add-on API', () => {
  it('lists add-ons from /add-ons', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(mockAddOns()));
    const list = await make(fetchMock).addOns.list();
    expect(list).toHaveLength(mockAddOns().length);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/add-ons');
  });

  it('POSTs a new add-on and PUTs an existing one', async () => {
    const [saved] = mockAddOns();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(saved)));
    const api = make(fetchMock).addOns;
    const { id, ...fresh } = saved;
    await api.save(fresh);
    await api.save({ ...fresh, id });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(String(fetchMock.mock.calls[1][0])).toBe(`https://api.example.com/v1/add-ons/${id}`);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PUT' });
  });

  it('DELETEs an add-on', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await make(fetchMock).addOns.delete('addon-crib');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });

  it('rejects a body that is not a list of add-ons', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([{ id: 'x' }]));
    await expect(make(fetchMock).addOns.list()).rejects.toBeInstanceOf(ApiError);
  });
});
