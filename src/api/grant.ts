import { createMockPermissions } from '../app/permissions';
import type { Permissions } from '../app/permissions';
import type { PermissionGrant } from './types';

/**
 * Feeds the app's `Permissions` interface (src/app/permissions.ts) from an API grant, so
 * consumers keep calling `can(...)`. An empty list denies everything; 'all' allows everything.
 */
export function permissionsFromGrant(grant: PermissionGrant): Permissions {
  return createMockPermissions(grant.permissions === 'all' ? undefined : grant.permissions);
}
