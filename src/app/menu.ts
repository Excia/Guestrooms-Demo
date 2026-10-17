import type { Permission, Permissions } from './permissions';
import { routes, type RouteMeta, type RouteSection } from './routes';

export interface MenuItem {
  id: string;
  label: string;
  path: string;
}

export interface MenuModel {
  reservation: MenuItem[];
  admin: MenuItem[];
  /** Follows access: one column when the user has no Admin Setup page. */
  columns: 1 | 2;
  /** Return to Site shows in the menu only in the one-column (non-admin) layout. */
  showReturnToSite: boolean;
}

export const pagePermission = (id: string): Permission => `page.${id}`;

function itemsFor(section: RouteSection, can: Permissions['can'], table: RouteMeta[]): MenuItem[] {
  return table
    .filter((r) => r.section === section && can(pagePermission(r.id)))
    .map((r) => ({ id: r.id, label: r.menuLabel ?? r.title, path: r.path }));
}

export function buildMenu(permissions: Permissions, table: RouteMeta[] = routes): MenuModel {
  const reservation = itemsFor('reservation', permissions.can, table);
  const admin = itemsFor('admin', permissions.can, table);
  const columns = admin.length > 0 ? 2 : 1;
  return { reservation, admin, columns, showReturnToSite: columns === 1 };
}
