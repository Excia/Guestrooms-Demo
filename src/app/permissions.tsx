import { createContext, useContext } from 'react';

// Granular permissions. The real source arrives with ticket 0.8; until then the app runs against
// a mock behind this interface, so consumers only ever call `can(...)`.
export type Permission = `page.${string}`;

export interface Permissions {
  can: (permission: Permission) => boolean;
}

/** Mock: everything allowed, or only the listed permissions. */
export function createMockPermissions(granted?: readonly Permission[]): Permissions {
  const set = granted ? new Set<Permission>(granted) : null;
  return { can: (permission) => (set ? set.has(permission) : true) };
}

const PermissionsContext = createContext<Permissions>(createMockPermissions());

export const PermissionsProvider = PermissionsContext.Provider;

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
