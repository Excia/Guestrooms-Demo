import { createMockPermissions, isKnownPermission } from '../app/permissions';
import type { Permissions } from '../app/permissions';

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
    return createMockPermissions(permissions.filter(isKnownPermission));
  }
  return createMockPermissions([]);
}
