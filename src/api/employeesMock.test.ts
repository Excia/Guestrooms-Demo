import { createMockClient } from './mock';
import { ApiError, type EmployeeInput } from './types';

const input = (over: Partial<EmployeeInput> & { id: string }): EmployeeInput => ({
  role: 'staff',
  permissionSetId: 'set-front-desk',
  active: true,
  ...over,
});

describe('mock employees API', () => {
  it('lists the seeded employees, the people who can be added and the permission sets', async () => {
    const api = createMockClient().employees;
    const list = await api.list();
    expect(list.map((e) => e.name)).toContain('Alex Moreno');
    expect(list.some((e) => !e.active)).toBe(true);
    const candidates = await api.listCandidates();
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((c) => list.some((e) => e.id === c.id))).toBe(false);
    expect((await api.listPermissionSets()).length).toBeGreaterThan(1);
  });

  it('adds a candidate and takes them off the candidate list', async () => {
    const api = createMockClient().employees;
    const [first] = await api.listCandidates();
    const stored = await api.save(input({ id: first.id }));
    expect(stored).toMatchObject({ id: first.id, name: first.label, role: 'staff', active: true });
    expect((await api.list()).some((e) => e.id === first.id)).toBe(true);
    expect((await api.listCandidates()).some((c) => c.id === first.id)).toBe(false);
  });

  it('is idempotent: saving the same body twice stores one employee', async () => {
    const api = createMockClient().employees;
    const [first] = await api.listCandidates();
    const before = (await api.list()).length;
    await api.save(input({ id: first.id }));
    await api.save(input({ id: first.id }));
    expect(await api.list()).toHaveLength(before + 1);
  });

  it('edits and deactivates an employee', async () => {
    const api = createMockClient().employees;
    const saved = await api.save(
      input({ id: 'emp-3', role: 'manager', permissionSetId: 'set-accounting', active: false }),
    );
    expect(saved).toMatchObject({
      role: 'manager',
      permissionSetId: 'set-accounting',
      active: false,
    });
    expect((await api.list()).find((e) => e.id === 'emp-3')).toEqual(saved);
  });

  it('rejects invalid input with 422', async () => {
    const api = createMockClient().employees;
    const bad: EmployeeInput[] = [
      input({ id: 'nobody' }),
      input({ id: 'emp-3', permissionSetId: null }),
      input({ id: 'emp-3', permissionSetId: 'missing' }),
      input({ id: 'emp-3', role: 'administrator' }),
      input({ id: 'emp-3', role: 'owner' as never }),
    ];
    for (const body of bad) {
      await expect(api.save(body)).rejects.toMatchObject({ status: 422, code: 'validation' });
    }
  });

  it('keeps one active administrator (409) on save and on remove', async () => {
    const api = createMockClient().employees;
    await expect(api.save(input({ id: 'emp-1', role: 'manager' }))).rejects.toMatchObject({
      status: 409,
      code: 'last-administrator',
    });
    await expect(
      api.save({ id: 'emp-1', role: 'administrator', permissionSetId: null, active: false }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(api.remove('emp-1')).rejects.toMatchObject({ status: 409 });
    // A second administrator frees the first.
    await api.save({ id: 'emp-2', role: 'administrator', permissionSetId: null, active: true });
    await api.remove('emp-1');
    expect((await api.list()).some((e) => e.id === 'emp-1')).toBe(false);
  });

  it('removes an employee, who can then be added again; unknown id is 404', async () => {
    const api = createMockClient().employees;
    await api.remove('emp-4');
    expect((await api.list()).some((e) => e.id === 'emp-4')).toBe(false);
    expect((await api.listCandidates()).some((c) => c.id === 'emp-4')).toBe(true);
    await expect(api.remove('emp-4')).rejects.toMatchObject({ status: 404 });
  });

  it('refuses changes without employees.edit (403)', async () => {
    const api = createMockClient({
      grant: { role: 'Staff', permissions: ['page.employees'] },
    }).employees;
    const err = await api.save(input({ id: 'emp-3' })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'forbidden' });
    await expect(api.remove('emp-3')).rejects.toMatchObject({ status: 403 });
  });
});
