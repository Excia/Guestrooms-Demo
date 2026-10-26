import {
  adminEditPermission,
  ADMIN_PERMISSION,
  pagePermission,
  type AdminPageId,
  type PermissionPageId,
  type Permissions,
} from './permissions';
import { routes, type RouteMeta } from './routes';

/** The Admin Setup landing page ('/admin'): it opens for anyone who can open an Admin Setup page. */
export const ADMIN_LANDING_ID = 'admin';

type Can = Permissions['can'];

const pageKey = (route: RouteMeta) => pagePermission(route.id as PermissionPageId);

/** Whether the user may open the route with this id. Unknown ids are denied. */
export function canAccessPage(can: Can, id: string, table: readonly RouteMeta[] = routes): boolean {
  const route = table.find((r) => r.id === id);
  if (!route) return false;
  if (id === ADMIN_LANDING_ID) return adminPages(can, table).length > 0;
  if (route.section === 'admin' && can(ADMIN_PERMISSION)) return true;
  return can(pageKey(route));
}

/** The Admin Setup pages this user may open, in table order. */
export function adminPages(can: Can, table: readonly RouteMeta[] = routes): RouteMeta[] {
  return table.filter((r) => r.section === 'admin' && (can(ADMIN_PERMISSION) || can(pageKey(r))));
}

export interface AccessSummary {
  /** True when at least one Admin Setup page is open to the user (two-column menu). */
  canSeeAdminSetup: boolean;
  adminPages: RouteMeta[];
}

export function summarizeAccess(can: Can, table: readonly RouteMeta[] = routes): AccessSummary {
  const pages = adminPages(can, table);
  return { canSeeAdminSetup: pages.length > 0, adminPages: pages };
}

/** 'unconfigured': the deployment has no API (a misconfiguration, not a denial by the server). */
export type AccessStatus = 'loading' | 'ready' | 'error' | 'unconfigured';
export type GuardDecision = 'wait' | 'allow' | 'deny';

/**
 * Route guard rule. While the grant loads the guard waits (no redirect, so a deep link survives a
 * reload); a failed or unconfigured load denies, like any missing permission.
 */
export function guardDecision(status: AccessStatus, allowed: boolean): GuardDecision {
  if (status === 'loading') return 'wait';
  return status === 'ready' && allowed ? 'allow' : 'deny';
}

/** How far a user may go on a page: not at all, look only (View-only mode), or change it. */
export type PageLevel = 'none' | 'view' | 'edit';

/**
 * The level on an Admin Setup page. `admin` and `<id>.edit` give Edit, `page.<id>` alone gives View.
 * Any other page id (or an unknown one) has no View-only mode: it is Edit when it opens, else none.
 */
export function adminPageLevel(
  can: Can,
  id: string,
  table: readonly RouteMeta[] = routes,
): PageLevel {
  if (!canAccessPage(can, id, table)) return 'none';
  const route = table.find((r) => r.id === id);
  if (route?.section !== 'admin' || id === ADMIN_LANDING_ID) return 'edit';
  if (can(ADMIN_PERMISSION) || can(adminEditPermission(id as AdminPageId))) return 'edit';
  return 'view';
}
