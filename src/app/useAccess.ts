import { useContext, useMemo } from 'react';
import { canAccessPage, summarizeAccess, type AccessStatus, type AccessSummary } from './access';
import { AccessStatusContext } from './accessContext';
import { usePermissions, type Permissions } from './permissions';
import type { PageId } from './routes';

export interface Access extends AccessSummary {
  /** 'loading' until the grant arrives; 'error' if it failed (access is denied in both cases). */
  status: AccessStatus;
  /** The single permission check. */
  can: Permissions['can'];
  /** Whether the user may open this page (menu and route guard use the same rule). */
  canAccessPage: (id: PageId) => boolean;
}

/** Per-area access for the menu, dashboard and route guard. */
export function useAccess(): Access {
  const status = useContext(AccessStatusContext);
  const { can } = usePermissions();
  return useMemo(
    () => ({
      status,
      can,
      ...summarizeAccess(can),
      canAccessPage: (id) => canAccessPage(can, id),
    }),
    [status, can],
  );
}
