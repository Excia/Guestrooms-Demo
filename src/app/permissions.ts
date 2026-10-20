import { createContext, useContext } from 'react';
import { routes, type PageId } from './routes';

// Granular permissions, checked only through `can(...)`.
//
// This is the one registry. To add a permission: extend `Permission` (a new union member) and add
// it to `ALL_PERMISSIONS`; nothing else needs to know the list. Ids not in the registry are denied
// everywhere, so a typo or a permission from a newer backend fails closed.
//
// - `page.<routeId>` opens one page (menu link and route).
// - `admin` opens every Admin Setup page at once (Primary Setup, Rate Categories, Room Types,
//   Rooms, Add-On Items, Notifications). A user can also hold single `page.<admin page>` grants
//   (partial access) without `admin`.
export type PagePermission = `page.${PageId}`;
export type AdminPermission = 'admin';
// Room for non-page permissions (e.g. 'reservation.create') once the Permissions page is designed.
export type Permission = PagePermission | AdminPermission;

export const ADMIN_PERMISSION: AdminPermission = 'admin';

export const pagePermission = (id: PageId): PagePermission => `page.${id}`;

export const ALL_PERMISSIONS: readonly Permission[] = [
  ADMIN_PERMISSION,
  ...routes.map((r) => pagePermission(r.id)),
];

const KNOWN = new Set<string>(ALL_PERMISSIONS);

export const isKnownPermission = (value: unknown): value is Permission =>
  typeof value === 'string' && KNOWN.has(value);

export interface Permissions {
  can: (permission: Permission) => boolean;
}

/** Denies everything; the default until a grant has loaded, and after a failed load. */
export const noPermissions: Permissions = { can: () => false };

/** Mock: every known permission allowed, or only the listed ones. Unknown ids are always denied. */
export function createMockPermissions(granted?: readonly Permission[]): Permissions {
  const set = granted ? new Set<Permission>(granted) : null;
  return {
    can: (permission) => isKnownPermission(permission) && (set ? set.has(permission) : true),
  };
}

// Fail closed: without a provider (or while the grant is loading) nobody may see anything.
const PermissionsContext = createContext<Permissions>(noPermissions);

export const PermissionsProvider = PermissionsContext.Provider;

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
