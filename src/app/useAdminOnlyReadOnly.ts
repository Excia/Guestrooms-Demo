import { ADMIN_PERMISSION } from './permissions';
import { useReadOnly } from './readOnlyContext';
import { useAccess } from './useAccess';

/**
 * Pages that hold secrets (API Integrations, ticket 188) are changed by administrators only, like
 * the legacy "root admin" rule: anyone else sees them View-only even when granted edit. The backend
 * refuses the write (403) on its own; this only keeps the screen from offering it.
 */
export function useAdminOnlyReadOnly(): boolean {
  const viewOnly = useReadOnly();
  const { can } = useAccess();
  return viewOnly || !can(ADMIN_PERMISSION);
}
