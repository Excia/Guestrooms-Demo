import { canAccessPage } from './access';
import type { Permissions } from './permissions';
import { routes, type MenuRouteId, type RouteMeta, type RouteSection } from './routes';

export interface MenuItem {
  id: MenuRouteId;
  label: string;
  path: string;
}

export interface MenuModel {
  /** The Dashboard button; null when the user cannot open the dashboard. */
  dashboard: MenuItem | null;
  reservation: MenuItem[];
  admin: MenuItem[];
  /** Follows access: one column when the user has no Admin Setup page. */
  columns: 1 | 2;
  /** Return to Site shows in the menu only in the one-column (non-admin) layout. */
  showReturnToSite: boolean;
}

function itemsFor(
  section: RouteSection,
  can: Permissions['can'],
  table: readonly RouteMeta[],
): MenuItem[] {
  return table
    .filter(
      (r) => r.section === section && r.showInMenu !== false && canAccessPage(can, r.id, table),
    )
    .map((r) => ({ id: r.id as MenuRouteId, label: r.menuLabel ?? r.title, path: r.path }));
}

export function buildMenu(
  permissions: Permissions,
  table: readonly RouteMeta[] = routes,
): MenuModel {
  const dashboard = itemsFor('dashboard', permissions.can, table)[0] ?? null;
  const reservation = itemsFor('reservation', permissions.can, table);
  const admin = itemsFor('admin', permissions.can, table);
  const columns = admin.length > 0 ? 2 : 1;
  return { dashboard, reservation, admin, columns, showReturnToSite: columns === 1 };
}
