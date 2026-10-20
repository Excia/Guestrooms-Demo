import { createMockPermissions, pagePermission } from './permissions';
import { routes } from './routes';
import { buildMenu } from './menu';
import { buildShortcuts, formatCount, shouldShowBadge, unassignedChargesLabel } from './shortcuts';

describe('buildShortcuts', () => {
  it('lists the ten links in ticket order with their paths', () => {
    const items = buildShortcuts(createMockPermissions());
    expect(items.map((i) => i.label)).toEqual([
      'Schedule | Home',
      'Reservations',
      'Open Folios',
      'Unassigned Charges',
      'Waitlist',
      'Night Audit History',
      'Add-On Countdown',
      'Room Blocks',
      'Member Directory',
      'Reporting',
    ]);
    expect(items.map((i) => i.path)).toEqual([
      '/schedule',
      '/reservations',
      '/open-folios',
      '/unassigned-charges',
      '/waitlist',
      '/night-audit-history',
      '/add-on-countdown',
      '/room-blocks',
      '/member-directory',
      '/reporting',
    ]);
  });

  it('never lists Admin Setup or Dashboard routes', () => {
    const ids = buildShortcuts(createMockPermissions()).map((i) => i.id);
    for (const r of routes.filter(
      (r) => r.id === 'dashboard' || r.id === 'admin' || r.path.startsWith('/admin'),
    )) {
      expect(ids).not.toContain(r.id);
    }
  });

  it('shares paths with the route table and the menu', () => {
    const menu = buildMenu(createMockPermissions()).reservation;
    const shortcuts = buildShortcuts(createMockPermissions());
    for (const m of menu) expect(shortcuts.find((s) => s.id === m.id)?.path).toBe(m.path);
  });

  it('filters rows the user cannot open', () => {
    const items = buildShortcuts(
      createMockPermissions([pagePermission('schedule'), pagePermission('unassigned-charges')]),
    );
    expect(items.map((i) => i.label)).toEqual(['Schedule | Home', 'Unassigned Charges']);
  });
});

describe('menu', () => {
  it('does not list Unassigned Charges (Figma menu omits it)', () => {
    const labels = buildMenu(createMockPermissions()).reservation.map((i) => i.label);
    expect(labels).not.toContain('Unassigned Charges');
  });
});

describe('badge', () => {
  it('formats and labels counts', () => {
    expect(formatCount(1000)).toBe('1,000');
    expect(unassignedChargesLabel(1)).toBe('1 unassigned charge');
    expect(unassignedChargesLabel(10)).toBe('10 unassigned charges');
  });

  it('hides at zero and for missing or invalid counts', () => {
    expect(shouldShowBadge(0)).toBe(false);
    expect(shouldShowBadge(undefined)).toBe(false);
    expect(shouldShowBadge(NaN)).toBe(false);
    expect(shouldShowBadge(1)).toBe(true);
  });
});
