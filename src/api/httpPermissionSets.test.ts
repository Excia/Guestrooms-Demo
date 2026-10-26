import { createHttpClient } from './http';
import { mockPermissionSets } from './permissionSetsData';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

describe('http permission sets client', () => {
  it('reads the sets, repairing unknown levels instead of refusing them', async () => {
    const odd = { ...mockPermissionSets()[0], checkIn: 'sometimes', pinOverride: 'yes' };
    const fetchMock = vi.fn().mockResolvedValue(json([odd]));
    const [set] = await make(fetchMock).permissions.getPermissionSets();
    expect(set?.checkIn).toBe('never');
    expect(set?.pinOverride).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/permission-sets');
  });

  it('refuses a structurally wrong body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([{ id: 'x' }]));
    await expect(make(fetchMock).permissions.getPermissionSets()).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('lists the summaries with ?fields=summary', async () => {
    const summaries = [{ id: 'staff', name: 'Staff', editable: true }];
    const fetchMock = vi.fn().mockResolvedValue(json(summaries));
    expect(await make(fetchMock).permissions.listPermissionSets()).toEqual(summaries);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.example.com/v1/permission-sets?fields=summary',
    );
  });

  it('saves with PUT and the whole list', async () => {
    const sets = mockPermissionSets();
    const fetchMock = vi.fn().mockResolvedValue(json(sets));
    await make(fetchMock).permissions.savePermissionSets(sets);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toHaveLength(2);
  });
});
