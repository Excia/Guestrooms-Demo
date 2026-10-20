import { createMockPermissions, pagePermission } from '../app/permissions';
import type { Permission, Permissions } from '../app/permissions';
import { routes } from '../app/routes';

// Every permission the app knows how to check. Extend when action permissions arrive (ticket 0.8).
const KNOWN = new Set<string>(routes.map((r) => pagePermission(r.id)));

/**
 * Feeds the app's `Permissions` interface (src/app/permissions.ts) from an API grant, so
 * consumers keep calling `can(...)`. Fails safe: only `permissions === 'all'` allows everything,
 * an array allows exactly its known entries (unknown strings are dropped), and anything else
 * (null, missing, wrong type) denies all.
 */
export function permissionsFromGrant(grant: unknown): Permissions {
  const permissions = (grant as { permissions?: unknown } | null | undefined)?.permissions;
  if (permissions === 'all') return createMockPermissions();
  if (Array.isArray(permissions)) {
    return createMockPermissions(
      permissions.filter((p): p is Permission => typeof p === 'string' && KNOWN.has(p)),
    );
  }
  return createMockPermissions([]);
}
