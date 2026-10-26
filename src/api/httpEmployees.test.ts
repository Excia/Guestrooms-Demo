import { createHttpClient } from './http';
import { mockEmployees, MOCK_PERMISSION_SETS } from './employeesData';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

describe('http employees client', () => {
  it('lists employees from /employees', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(mockEmployees()));
    expect(await make(fetchMock).employees.list()).toHaveLength(mockEmployees().length);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/employees');
  });

  it('lists candidates and permission sets', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json(MOCK_PERMISSION_SETS));
    const client = make(fetchMock);
    expect(await client.employees.listCandidates()).toHaveLength(MOCK_PERMISSION_SETS.length);
    expect(await client.employees.listPermissionSets()).toHaveLength(MOCK_PERMISSION_SETS.length);
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual([
      'https://api.example.com/v1/employees/candidates',
      'https://api.example.com/v1/employees/permission-sets',
    ]);
  });

  it('saves with PUT to the employee id and removes with DELETE', async () => {
    const [first] = mockEmployees();
    const fetchMock = vi.fn().mockResolvedValue(json(first));
    const client = make(fetchMock);
    const body = { id: 'a/b', role: 'staff' as const, permissionSetId: 's', active: true };
    await client.employees.save(body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.example.com/v1/employees/a%2Fb');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual(body);

    const del = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await make(del).employees.remove('emp-1');
    expect(String(del.mock.calls[0][0])).toBe('https://api.example.com/v1/employees/emp-1');
    expect(del.mock.calls[0][1].method).toBe('DELETE');
  });

  it('rejects malformed responses', async () => {
    const [first] = mockEmployees();
    const bad = [
      [{ ...first, role: 'owner' }],
      [{ ...first, name: 5 }],
      [{ ...first, active: 'yes' }],
      [{ ...first, permissionSetId: 3 }],
      { employees: [] },
    ];
    for (const body of bad) {
      await expect(
        make(vi.fn().mockResolvedValue(json(body))).employees.list(),
      ).rejects.toMatchObject({ status: 200, code: 'invalid-response' });
    }
    await expect(
      make(vi.fn().mockResolvedValue(json({ id: 1 }))).employees.save({
        id: 'x',
        role: 'staff',
        permissionSetId: 's',
        active: true,
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(
      make(vi.fn().mockResolvedValue(json([{ id: 'a' }]))).employees.listCandidates(),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
});
