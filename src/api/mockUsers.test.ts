import { permissionsFromGrant } from './grant';
import { DEMO_MOCK_USER, MOCK_USERS, resolveMockUser } from './mockUsers';
import { mockPermissionSets } from './permissionSetsData';
import { grantFromSet } from '../app/permissionSets';

// A user with a permission set holds what the (default) saved set grants.
const grantOf = (id: string) => {
  const user = resolveMockUser(id);
  const set = mockPermissionSets().find((s) => s.id === user.permissionSetId);
  return set ? { role: set.name, permissions: grantFromSet(set) } : user.grant;
};
const can = (
  id: string,
  permission: Parameters<ReturnType<typeof permissionsFromGrant>['can']>[0],
) => permissionsFromGrant(grantOf(id)).can(permission);

describe('mock users', () => {
  it('administrator may open every admin page', () => {
    expect(can('admin', 'page.rooms')).toBe(true);
    expect(can('admin', 'admin')).toBe(true);
  });
  it('non-admin has no admin pages but keeps the others', () => {
    expect(can('non-admin', 'page.schedule')).toBe(true);
    expect(can('non-admin', 'page.dashboard')).toBe(true);
    expect(can('non-admin', 'page.rooms')).toBe(false);
    expect(can('non-admin', 'admin')).toBe(false);
  });
  it('view-only (Management set) opens the setup pages but cannot edit them', () => {
    expect(can('view-only', 'page.rooms')).toBe(true);
    expect(can('view-only', 'rooms.edit')).toBe(false);
    expect(can('view-only', 'locations.edit')).toBe(false);
    expect(can('view-only', 'admin')).toBe(false);
    expect(can('view-only', 'page.permissions')).toBe(true);
  });
  it('partial has Rooms and Room Types only', () => {
    expect(can('partial', 'page.rooms')).toBe(true);
    expect(can('partial', 'page.room-types')).toBe(true);
    expect(can('partial', 'page.notifications')).toBe(false);
    expect(can('partial', 'admin')).toBe(false);
  });
  it('does not know a page.admin permission (the landing follows the admin pages)', () => {
    expect(can('admin', 'page.admin' as never)).toBe(false);
  });
  it('falls back to the least privileged user for unknown or missing ids', () => {
    expect(resolveMockUser('nope').id).toBe('non-admin');
    expect(resolveMockUser(null).id).toBe('non-admin');
    expect(resolveMockUser(undefined).id).toBe('non-admin');
    expect(DEMO_MOCK_USER.id).toBe('admin');
    expect(MOCK_USERS.map((u) => u.id)).toEqual(['admin', 'non-admin', 'partial', 'view-only']);
  });
});
