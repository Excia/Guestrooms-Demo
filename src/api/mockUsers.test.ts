import { permissionsFromGrant } from './grant';
import { MOCK_USERS, resolveMockUser } from './mockUsers';

const can = (
  id: string,
  permission: Parameters<ReturnType<typeof permissionsFromGrant>['can']>[0],
) => permissionsFromGrant(resolveMockUser(id).grant).can(permission);

describe('mock users', () => {
  it('administrator may open every admin page', () => {
    expect(can('admin', 'page.rooms')).toBe(true);
    expect(can('admin', 'admin')).toBe(true);
  });
  it('non-admin has no admin pages but keeps the others', () => {
    expect(can('non-admin', 'page.schedule')).toBe(true);
    expect(can('non-admin', 'page.dashboard')).toBe(true);
    expect(can('non-admin', 'page.rooms')).toBe(false);
    expect(can('non-admin', 'page.admin')).toBe(false);
    expect(can('non-admin', 'admin')).toBe(false);
  });
  it('partial has Rooms and Room Types only', () => {
    expect(can('partial', 'page.rooms')).toBe(true);
    expect(can('partial', 'page.room-types')).toBe(true);
    expect(can('partial', 'page.notifications')).toBe(false);
    expect(can('partial', 'admin')).toBe(false);
  });
  it('falls back to the administrator for unknown or missing ids', () => {
    expect(resolveMockUser('nope').id).toBe('admin');
    expect(resolveMockUser(null).id).toBe('admin');
    expect(MOCK_USERS.map((u) => u.id)).toEqual(['admin', 'non-admin', 'partial']);
  });
});
