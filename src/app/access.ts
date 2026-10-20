import { ADMIN_PERMISSION, pagePermission, type Permissions } from './permissions';
import { routes, type PageId, type RouteMeta } from './routes';

/** The Admin Setup landing page ('/admin'): it opens for anyone who can open an Admin Setup page. */
export const ADMIN_LANDING_ID = 'admin';

type Can = Permissions['can'];

const pageKey = (route: RouteMeta) => pagePermission(route.id as PageId);

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

export type AccessStatus = 'loading' | 'ready' | 'error';
export type GuardDecision = 'wait' | 'allow' | 'deny';

/**
 * Route guard rule. While the grant loads the guard waits (no redirect, so a deep link survives a
 * reload); a failed load denies, like any missing permission.
 */
export function guardDecision(status: AccessStatus, allowed: boolean): GuardDecision {
  if (status === 'loading') return 'wait';
  return status === 'ready' && allowed ? 'allow' : 'deny';
}
