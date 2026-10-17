import { createContext, useContext } from 'react';
import type { PageId } from './routes';

// Granular permissions. The real source arrives with ticket 0.8; until then the app runs against
// a mock behind this interface, so consumers only ever call `can(...)`.
export type PagePermission = `page.${PageId}`;
// Room for non-page permissions (e.g. 'reservation.create') once the Permissions page is designed.
export type ActionPermission = never;
export type Permission = PagePermission | ActionPermission;

export const pagePermission = (id: PageId): PagePermission => `page.${id}`;

export interface Permissions {
  can: (permission: Permission) => boolean;
}

/** Mock: everything allowed, or only the listed permissions. */
export function createMockPermissions(granted?: readonly Permission[]): Permissions {
  const set = granted ? new Set<Permission>(granted) : null;
  return { can: (permission) => (set ? set.has(permission) : true) };
}

// TODO(0.8): the real provider must deny by default (allow-all is only for the mock era).
const PermissionsContext = createContext<Permissions>(createMockPermissions());

export const PermissionsProvider = PermissionsContext.Provider;

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
