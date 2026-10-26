// Business rules of Employees (Admin Setup, LP-A.4 / ticket 185). Pure functions; the page and the
// mock API only call them.
import type { EmployeeInput, EmployeeRole, EmployeeSetup, LookupRef } from '../api/types';

export const EMPLOYEE_ROLES: readonly { id: EmployeeRole; label: string }[] = [
  { id: 'administrator', label: 'Administrator' },
  { id: 'manager', label: 'Manager' },
  { id: 'staff', label: 'Staff' },
];

export const roleLabel = (role: EmployeeRole) =>
  EMPLOYEE_ROLES.find((r) => r.id === role)?.label ?? role;

export const isEmployeeRole = (value: unknown): value is EmployeeRole =>
  EMPLOYEE_ROLES.some((r) => r.id === value);

/** What the form edits. `person` is chosen from the directory for a new employee and fixed after. */
export interface EmployeeDraft {
  person: LookupRef | null;
  role: EmployeeRole;
  permissionSetId: string | null;
  active: boolean;
}

export type EmployeeField = 'person' | 'role' | 'permissionSetId';
export type EmployeeErrors = Partial<Record<EmployeeField, string>>;

export const blankEmployee = (): EmployeeDraft => ({
  person: null,
  role: 'staff',
  permissionSetId: null,
  active: true,
});

export const toEmployeeDraft = (e: EmployeeSetup): EmployeeDraft => ({
  person: { id: e.id, label: e.name },
  role: e.role,
  permissionSetId: e.permissionSetId,
  active: e.active,
});

/** An administrator has full access, so a permission set does not apply to the role. */
export const needsPermissionSet = (role: EmployeeRole) => role !== 'administrator';

/** The form after the role changed: an administrator's set is cleared. */
export function withRole(draft: EmployeeDraft, role: EmployeeRole): EmployeeDraft {
  return {
    ...draft,
    role,
    permissionSetId: needsPermissionSet(role) ? draft.permissionSetId : null,
  };
}

export function validateEmployee(
  draft: EmployeeDraft,
  { creating, permissionSets }: { creating: boolean; permissionSets: readonly LookupRef[] },
): EmployeeErrors {
  const errors: EmployeeErrors = {};
  if (creating && draft.person === null) errors.person = 'Select an employee.';
  if (!isEmployeeRole(draft.role)) errors.role = 'Select an employee type.';
  if (needsPermissionSet(draft.role)) {
    if (draft.permissionSetId === null) errors.permissionSetId = 'Select a permission set.';
    else if (!permissionSets.some((s) => s.id === draft.permissionSetId)) {
      errors.permissionSetId = 'This permission set no longer exists. Select another.';
    }
  }
  return errors;
}

export const EMPLOYEE_FIELD_ORDER: readonly EmployeeField[] = ['person', 'role', 'permissionSetId'];

/** The request body for a draft; null while the draft has no person. */
export function toEmployeeInput(draft: EmployeeDraft): EmployeeInput | null {
  if (draft.person === null) return null;
  return {
    id: draft.person.id,
    role: draft.role,
    permissionSetId: needsPermissionSet(draft.role) ? draft.permissionSetId : null,
    active: draft.active,
  };
}

/** Active employees first, then inactive ones, each by name (the list never moves on selection). */
export function sortEmployees(employees: readonly EmployeeSetup[]): EmployeeSetup[] {
  return [...employees].sort(
    (a, b) =>
      Number(!a.active) - Number(!b.active) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

const isActiveAdmin = (e: EmployeeSetup) => e.active && e.role === 'administrator';

/**
 * Legacy rule: the club always keeps one administrator. Returns the reason when applying `next`
 * to the employee `id` (or removing it, `next: null`) would leave no active administrator.
 */
export function lastAdministratorProblem(
  employees: readonly EmployeeSetup[],
  id: string,
  next: Pick<EmployeeInput, 'role' | 'active'> | null,
): string | null {
  const current = employees.find((e) => e.id === id);
  if (!current || !isActiveAdmin(current)) return null;
  const stays = next !== null && next.active && next.role === 'administrator';
  if (stays) return null;
  const others = employees.filter((e) => e.id !== id && isActiveAdmin(e));
  if (others.length > 0) return null;
  return next === null
    ? 'This is the only active administrator. Make another employee an administrator before removing this one.'
    : 'This is the only active administrator. Make another employee an administrator before changing this one.';
}

/** The summary line under the title, e.g. "Manager, Management". */
export function employeeSummary(e: EmployeeSetup, permissionSets: readonly LookupRef[]): string {
  const set = permissionSets.find((s) => s.id === e.permissionSetId)?.label;
  return set ? `${roleLabel(e.role)}, ${set}` : roleLabel(e.role);
}
