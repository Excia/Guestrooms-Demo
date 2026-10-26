import { createMockClient } from './mock';
import { ApiError, type EmployeeInput } from './types';

const input = (over: Partial<EmployeeInput> & { id: string }): EmployeeInput => ({
  role: 'staff',
  permissionSetId: 'staff',
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
      input({ id: 'emp-3', role: 'manager', permissionSetId: 'management', active: false }),
    );
    expect(saved).toMatchObject({
      role: 'manager',
      permissionSetId: 'management',
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

describe('mock employees API: legacy save (saveRoles)', () => {
  it('changes types and adds an employee in one call, answering with the whole list', async () => {
    const api = createMockClient().employees;
    const [candidate] = await api.listCandidates();
    const list = await api.saveRoles([
      { id: 'emp-3', role: 'manager' },
      { id: candidate.id, role: 'staff' },
    ]);
    expect(list.find((e) => e.id === 'emp-3')?.role).toBe('manager');
    expect(list.find((e) => e.id === candidate.id)).toMatchObject({
      name: candidate.label,
      role: 'staff',
    });
    expect((await api.listCandidates()).some((c) => c.id === candidate.id)).toBe(false);
    expect(await api.list()).toEqual(list);
  });

  it('is all or nothing: an invalid row changes nothing (422)', async () => {
    const api = createMockClient().employees;
    const before = await api.list();
    for (const body of [
      [],
      [
        { id: 'emp-3', role: 'manager' as const },
        { id: 'nobody', role: 'staff' as const },
      ],
      [{ id: 'emp-3', role: 'owner' as never }],
      [
        { id: 'emp-3', role: 'staff' as const },
        { id: 'emp-3', role: 'manager' as const },
      ],
    ]) {
      await expect(api.saveRoles(body)).rejects.toMatchObject({ status: 422 });
    }
    expect(await api.list()).toEqual(before);
  });

  it('keeps an active administrator (409), but allows swapping them in one save', async () => {
    const api = createMockClient().employees;
    await expect(api.saveRoles([{ id: 'emp-1', role: 'manager' }])).rejects.toMatchObject({
      status: 409,
      code: 'last-administrator',
    });
    const list = await api.saveRoles([
      { id: 'emp-1', role: 'manager' },
      { id: 'emp-2', role: 'administrator' },
    ]);
    expect(list.find((e) => e.id === 'emp-2')).toMatchObject({
      role: 'administrator',
      permissionSetId: null,
    });
  });

  it('refuses without employees.edit (403)', async () => {
    const api = createMockClient({
      grant: { role: 'Staff', permissions: ['page.employees'] },
    }).employees;
    await expect(api.saveRoles([{ id: 'emp-3', role: 'manager' }])).rejects.toMatchObject({
      status: 403,
    });
  });
});
