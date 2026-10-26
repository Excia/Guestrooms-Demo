import { ADMIN_PERMISSION } from './permissions';
import { useReadOnly } from './readOnlyContext';
import { useAccess } from './useAccess';

/**
 * Employee types are changed by administrators only: nobody changes their own permissions, so a
 * non-administrator sees Employees View-only even when granted edit. The backend refuses the write
 * (403) on its own; this only keeps the screen from offering it.
 */
export function useEmployeesReadOnly(): boolean {
  const viewOnly = useReadOnly();
  const { can } = useAccess();
  return viewOnly || !can(ADMIN_PERMISSION);
}
