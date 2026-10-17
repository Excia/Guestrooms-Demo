import { buildMenu, pagePermission } from './menu';
import { createMockPermissions } from './permissions';
import { routes } from './routes';

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe('buildMenu', () => {
  it('lists every item in Figma order for a full-access user', () => {
    const menu = buildMenu(createMockPermissions());
    expect(labels(menu.reservation)).toEqual([
      'Schedule | Home',
      'Reservations',
      'Open Folios',
      'Waitlist',
      'Night Audit History',
      'Add-On Countdown',
      'Room Blocks',
      'Member Directory',
      'Reporting',
    ]);
    expect(labels(menu.admin)).toEqual([
      'Primary Setup',
      'Rate Categories',
      'Room Types',
      'Rooms',
      'Add-On Items',
      'Notifications',
    ]);
    expect(menu.columns).toBe(2);
    expect(menu.showReturnToSite).toBe(false);
  });

  it('keeps two columns for partial admin access and only the allowed items', () => {
    const menu = buildMenu(
      createMockPermissions([pagePermission('schedule'), pagePermission('rooms')]),
    );
    expect(labels(menu.reservation)).toEqual(['Schedule | Home']);
    expect(labels(menu.admin)).toEqual(['Rooms']);
    expect(menu.columns).toBe(2);
  });

  it('condenses to one column with Return to Site when no admin page is allowed', () => {
    const menu = buildMenu(createMockPermissions([pagePermission('schedule')]));
    expect(menu.admin).toEqual([]);
    expect(menu.columns).toBe(1);
    expect(menu.showReturnToSite).toBe(true);
  });

  it('has a Dashboard entry driven by page.dashboard', () => {
    expect(buildMenu(createMockPermissions()).dashboard).toEqual({
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
    });
    const denied = buildMenu(createMockPermissions([pagePermission('schedule')]));
    expect(denied.dashboard).toBeNull();
  });

  it('an all-denied user gets no items, one column and Return to Site', () => {
    const menu = buildMenu(createMockPermissions([]));
    expect(menu).toEqual({
      dashboard: null,
      reservation: [],
      admin: [],
      columns: 1,
      showReturnToSite: true,
    });
  });

  it('every menu item routes to a path in the route table', () => {
    const paths = new Set<string>(routes.map((r) => r.path));
    const menu = buildMenu(createMockPermissions());
    for (const item of [...menu.reservation, ...menu.admin])
      expect(paths.has(item.path)).toBe(true);
  });
});
