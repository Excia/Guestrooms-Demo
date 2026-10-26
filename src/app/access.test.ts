import {
  adminPageLevel,
  adminPages,
  canAccessPage,
  guardDecision,
  summarizeAccess,
} from './access';
import {
  createMockPermissions,
  noPermissions,
  pagePermission,
  type Permission,
} from './permissions';

const ADMIN_IDS = [
  'primary-setup',
  'booking-rules',
  'keycard-integration',
  'rate-categories',
  'room-types',
  'rooms',
  'add-on-items',
  'room-options',
  'notifications',
  'locations',
  'permissions',
  'employees',
] as const;

const admin = createMockPermissions();
const nonAdmin = createMockPermissions([
  pagePermission('dashboard'),
  pagePermission('schedule'),
  pagePermission('reporting'),
]);
const partial = createMockPermissions([
  pagePermission('dashboard'),
  pagePermission('rooms'),
  pagePermission('room-types'),
]);

describe('canAccessPage', () => {
  it('opens every Admin Setup page and the landing for an administrator', () => {
    for (const id of [...ADMIN_IDS, 'admin']) expect(canAccessPage(admin.can, id)).toBe(true);
  });

  it('opens every Admin Setup page for the admin permission alone', () => {
    const only = createMockPermissions(['admin']);
    for (const id of [...ADMIN_IDS, 'admin']) expect(canAccessPage(only.can, id)).toBe(true);
    expect(canAccessPage(only.can, 'schedule')).toBe(false);
  });

  it('closes every Admin Setup page and the landing for a non-admin', () => {
    for (const id of [...ADMIN_IDS, 'admin']) expect(canAccessPage(nonAdmin.can, id)).toBe(false);
    expect(canAccessPage(nonAdmin.can, 'schedule')).toBe(true);
    expect(canAccessPage(nonAdmin.can, 'rooms')).toBe(false);
  });

  it('opens only the granted Admin Setup pages (and the landing) for partial access', () => {
    expect(canAccessPage(partial.can, 'rooms')).toBe(true);
    expect(canAccessPage(partial.can, 'room-types')).toBe(true);
    expect(canAccessPage(partial.can, 'notifications')).toBe(false);
    expect(canAccessPage(partial.can, 'admin')).toBe(true);
  });

  it('denies unknown pages and everything without permissions', () => {
    expect(canAccessPage(admin.can, 'bogus')).toBe(false);
    for (const id of ['dashboard', 'admin', 'rooms']) {
      expect(canAccessPage(noPermissions.can, id)).toBe(false);
    }
  });

  it('does not let an unknown permission id grant anything', () => {
    const odd = createMockPermissions(['page.bogus' as Permission]);
    expect(odd.can('page.bogus' as Permission)).toBe(false);
    expect(canAccessPage(odd.can, 'dashboard')).toBe(false);
  });
});

describe('summarizeAccess', () => {
  it('lists all admin pages for an administrator', () => {
    const s = summarizeAccess(admin.can);
    expect(s.canSeeAdminSetup).toBe(true);
    expect(s.adminPages.map((r) => r.id)).toEqual(ADMIN_IDS);
  });
  it('has no admin pages for a non-admin', () => {
    expect(summarizeAccess(nonAdmin.can)).toEqual({ canSeeAdminSetup: false, adminPages: [] });
  });
  it('lists only the granted pages for partial access, in table order', () => {
    expect(adminPages(partial.can).map((r) => r.id)).toEqual(['room-types', 'rooms']);
    expect(summarizeAccess(partial.can).canSeeAdminSetup).toBe(true);
  });
});

describe('guardDecision', () => {
  it('waits while loading, whatever the permission', () => {
    expect(guardDecision('loading', true)).toBe('wait');
    expect(guardDecision('loading', false)).toBe('wait');
  });
  it('allows only a ready grant that permits the page', () => {
    expect(guardDecision('ready', true)).toBe('allow');
    expect(guardDecision('ready', false)).toBe('deny');
  });
  it('fails closed on error', () => {
    expect(guardDecision('error', true)).toBe('deny');
  });
});

describe('adminPageLevel', () => {
  it('is edit for an administrator and for a user with the edit permission', () => {
    expect(adminPageLevel(admin.can, 'rooms')).toBe('edit');
    const editor = createMockPermissions([pagePermission('rooms'), 'rooms.edit']);
    expect(adminPageLevel(editor.can, 'rooms')).toBe('edit');
  });
  it('is view with the page permission alone, none without it', () => {
    const viewer = createMockPermissions([pagePermission('rooms')]);
    expect(adminPageLevel(viewer.can, 'rooms')).toBe('view');
    expect(adminPageLevel(viewer.can, 'locations')).toBe('none');
  });
  it('edit permission without the page permission does not open the page', () => {
    expect(adminPageLevel(createMockPermissions(['rooms.edit']).can, 'rooms')).toBe('none');
  });
  it('has no View-only mode for pages outside Admin Setup', () => {
    const schedule = createMockPermissions([pagePermission('schedule')]);
    expect(adminPageLevel(schedule.can, 'schedule')).toBe('edit');
    expect(adminPageLevel(admin.can, 'nope')).toBe('none');
  });
});
