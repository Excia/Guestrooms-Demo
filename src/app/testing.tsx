import type { ReactNode } from 'react';
import type { AccessStatus } from './access';
import { AccessStatusContext } from './accessContext';
import { createMockPermissions, PermissionsProvider, type Permission } from './permissions';

/** Test helper: a loaded grant (all permissions, or only `granted`) without an API client. */
export function GrantedAccess({
  granted,
  status = 'ready',
  children,
}: {
  granted?: readonly Permission[];
  status?: AccessStatus;
  children: ReactNode;
}) {
  return (
    <AccessStatusContext.Provider value={status}>
      <PermissionsProvider value={createMockPermissions(granted)}>{children}</PermissionsProvider>
    </AccessStatusContext.Provider>
  );
}
