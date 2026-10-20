import { useEffect, useState, type ReactNode } from 'react';
import { permissionsFromGrant, useApi } from '../api';
import { AccessStatusContext } from './accessContext';
import type { AccessStatus } from './access';
import { noPermissions, PermissionsProvider, type Permissions } from './permissions';

interface Loaded {
  status: AccessStatus;
  permissions: Permissions;
}

const LOADING: Loaded = { status: 'loading', permissions: noPermissions };

/**
 * Fetches the user's grant and feeds `can(...)`. Fails closed: while the grant loads, and if it
 * fails to load, `can` denies everything. Consumers read `useAccess()` / `usePermissions()`.
 */
export function AccessProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [loaded, setLoaded] = useState<Loaded>(LOADING);

  useEffect(() => {
    const controller = new AbortController();
    api.permissions
      .getGrant({ signal: controller.signal })
      .then((grant) => {
        if (!controller.signal.aborted) {
          setLoaded({ status: 'ready', permissions: permissionsFromGrant(grant) });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ status: 'error', permissions: noPermissions });
      });
    return () => controller.abort();
  }, [api]);

  return (
    <AccessStatusContext.Provider value={loaded.status}>
      <PermissionsProvider value={loaded.permissions}>{children}</PermissionsProvider>
    </AccessStatusContext.Provider>
  );
}
