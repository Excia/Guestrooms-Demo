import { withAccessLevel, withSetupLevel, type PermissionSet } from '../app/permissionSets';
import { permissionsFromGrant } from './grant';
import { createMockClient } from './mock';

const memoryStore = () => {
  const persisted: { value: PermissionSet[] | null } = { value: null };
  return {
    load: () => persisted.value,
    save: (sets: PermissionSet[]) => {
      persisted.value = sets;
    },
  };
};

describe('mock permission sets', () => {
  it('lists the Administrator and the editable sets, small and stable', async () => {
    const list = await createMockClient().permissions.listPermissionSets();
    expect(list).toEqual([
      { id: 'admin', name: 'Administrator', editable: false },
      { id: 'management', name: 'Management', editable: true },
      { id: 'staff', name: 'Staff', editable: true },
    ]);
  });

  it('saves for an administrator and returns the stored sets', async () => {
    const client = createMockClient();
    const [management, staff] = (await client.permissions.getPermissionSets()) as [
      PermissionSet,
      PermissionSet,
    ];
    const stored = await client.permissions.savePermissionSets([
      withSetupLevel(management, 'rooms', 'edit'),
      staff,
    ]);
    expect(stored[0]?.setup.rooms).toBe('edit');
    expect((await client.permissions.getPermissionSets())[0]?.setup.rooms).toBe('edit');
  });

  it('refuses a user without admin (403) and unknown or Administrator sets (422)', async () => {
    const viewer = createMockClient({ permissionSetId: 'management' });
    const sets = await createMockClient().permissions.getPermissionSets();
    await expect(viewer.permissions.savePermissionSets(sets)).rejects.toMatchObject({
      status: 403,
    });
    const admin = createMockClient();
    const [management, staff] = sets as [PermissionSet, PermissionSet];
    await expect(
      admin.permissions.savePermissionSets([management, { ...staff, id: 'nobody' }]),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      admin.permissions.savePermissionSets([management, staff, { ...staff, id: 'admin' }]),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('derives the signed-in grant from the saved set, so editing it changes can()', async () => {
    const store = memoryStore();
    const admin = createMockClient({ permissionSetsStore: store });
    const sets = await admin.permissions.getPermissionSets();
    const staff = sets.find((s) => s.id === 'staff') as PermissionSet;
    const management = sets.find((s) => s.id === 'management') as PermissionSet;
    const before = createMockClient({ permissionSetId: 'staff', permissionSetsStore: store });
    expect(permissionsFromGrant(await before.permissions.getGrant()).can('page.rooms')).toBe(false);
    await admin.permissions.savePermissionSets([
      management,
      withAccessLevel(withSetupLevel(staff, 'rooms', 'view'), 'folio', 'none'),
    ]);
    const after = createMockClient({ permissionSetId: 'staff', permissionSetsStore: store });
    const can = permissionsFromGrant(await after.permissions.getGrant()).can;
    expect(can('page.rooms')).toBe(true);
    expect(can('rooms.edit')).toBe(false);
    expect(can('page.folio')).toBe(false);
  });

  it('a save replaces the list: it must send every editable set', async () => {
    const admin = createMockClient();
    const [management] = await admin.permissions.getPermissionSets();
    await expect(
      admin.permissions.savePermissionSets([management as PermissionSet]),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('only an administrator saves, even a user holding the Permissions page with edit', async () => {
    const sets = await createMockClient().permissions.getPermissionSets();
    const editor = createMockClient({
      grant: { role: 'x', permissions: ['page.permissions', 'permissions.edit'] },
    });
    await expect(editor.permissions.savePermissionSets(sets)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('reads: the list for Employees or Permissions users, the full sets for Permissions users', async () => {
    const employees = createMockClient({ grant: { role: 'x', permissions: ['page.employees'] } });
    expect(await employees.permissions.listPermissionSets()).toHaveLength(3);
    await expect(employees.permissions.getPermissionSets()).rejects.toMatchObject({ status: 403 });
    const nobody = createMockClient({ grant: { role: 'x', permissions: ['page.schedule'] } });
    await expect(nobody.permissions.listPermissionSets()).rejects.toMatchObject({ status: 403 });
  });

  it('refuses Admin Setup writes without <page>.edit and allows them with it', async () => {
    const viewer = createMockClient({ permissionSetId: 'management' });
    const rules = await viewer.bookingRules.get();
    await expect(viewer.bookingRules.save(rules)).rejects.toMatchObject({ status: 403 });
    await expect(viewer.roomSetup.deleteRoom('room-100')).rejects.toMatchObject({ status: 403 });
    await expect(viewer.keycards.saveEncoders([])).rejects.toMatchObject({ status: 403 });
    const editor = createMockClient({
      grant: { role: 'x', permissions: ['page.booking-rules', 'booking-rules.edit'] },
    });
    await expect(editor.bookingRules.save(rules)).resolves.toBeDefined();
  });

  it('a PIN holder counts only while the saved set allows PIN override', async () => {
    const store = memoryStore();
    const admin = createMockClient({ permissionSetsStore: store });
    const sets = (await admin.permissions.getPermissionSets()).map((s) =>
      s.id === 'management' ? { ...s, checkIn: 'any-time' as const } : s,
    );
    await admin.permissions.savePermissionSets(sets);
    const verify = (pin: string) =>
      createMockClient({
        permissionSetId: 'management',
        permissionSetsStore: store,
      }).overrides.verifyPin({ permission: 'reservation.check-in.any-time', pin });
    // Jordan Lee (Management set, PIN 1357) overrides while the Management set allows any-time check in
    // and PIN override (legacy has no PIN row; the flag stays on by default).
    expect((await verify('1357')).valid).toBe(true);
    await admin.permissions.savePermissionSets(
      sets.map((s) => (s.id === 'management' ? { ...s, pinOverride: false } : s)),
    );
    expect((await verify('1357')).valid).toBe(false);
    // The Administrator's PIN keeps working.
    expect((await verify('4821')).valid).toBe(true);
  });
});
