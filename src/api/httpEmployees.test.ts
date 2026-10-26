import { createHttpClient } from './http';
import { mockEmployeeCandidates, mockEmployees } from './employeesData';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

describe('http employees client', () => {
  it('lists employees from /employees', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(mockEmployees()));
    expect(await make(fetchMock).employees.list()).toHaveLength(mockEmployees().length);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/employees');
  });

  it('lists candidates', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json(mockEmployeeCandidates()));
    const client = make(fetchMock);
    expect(await client.employees.listCandidates()).toHaveLength(mockEmployeeCandidates().length);
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual([
      'https://api.example.com/v1/employees/candidates',
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

  it('saves the legacy way: PUT /employees with the changed rows, answering the list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(mockEmployees()));
    const rows = [{ id: 'emp-3', role: 'manager' as const }];
    expect(await make(fetchMock).employees.saveRoles(rows)).toHaveLength(mockEmployees().length);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.example.com/v1/employees');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ employees: rows });
  });

  it('accepts employees without the extended fields', async () => {
    const plain = [{ id: 'a', name: 'A', role: 'staff' }];
    const fetchMock = vi.fn().mockResolvedValue(json(plain));
    expect(await make(fetchMock).employees.list()).toEqual(plain);
  });
});
