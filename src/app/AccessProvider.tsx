import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, permissionsFromGrant, useApi } from '../api';
import type { ApiClient } from '../api';
import { AccessStatusContext } from './accessContext';
import type { AccessStatus } from './access';
import { noPermissions, PermissionsProvider, type Permissions } from './permissions';

interface Loaded {
  /** The client this result belongs to; a result for another client is never served. */
  api: ApiClient;
  status: Exclude<AccessStatus, 'loading'>;
  permissions: Permissions;
}

const isUnconfigured = (error: unknown) =>
  error instanceof ApiError && error.code === 'misconfigured';

/**
 * Fetches the user's grant and feeds `can(...)`. Fails closed: while the grant loads, and if it
 * fails to load, `can` denies everything. Consumers read `useAccess()` / `usePermissions()`.
 *
 * The grant is fetched once per API client; a revoked role takes effect on reload. If the client
 * changes, the previous result is dropped at once (it is keyed to its client), so one user's
 * permissions are never live for the next. Hiding UI is not authorization: the backend must
 * enforce access on every request.
 */
export function AccessProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.permissions
      .getGrant({ signal: controller.signal })
      .then((grant) => {
        if (!controller.signal.aborted) {
          setLoaded({ api, status: 'ready', permissions: permissionsFromGrant(grant) });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          const status = isUnconfigured(error) ? 'unconfigured' : 'error';
          setLoaded({ api, status, permissions: noPermissions });
        }
      });
    return () => controller.abort();
  }, [api]);

  const current = loaded?.api === api ? loaded : null;
  const status: AccessStatus = current?.status ?? 'loading';
  return (
    <AccessStatusContext.Provider value={status}>
      <PermissionsProvider value={current?.permissions ?? noPermissions}>
        {children}
      </PermissionsProvider>
    </AccessStatusContext.Provider>
  );
}
