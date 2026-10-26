// Rules of the Employees screen as the legacy app has it (EmployeesEdit.vue): every employee is a
// row of Name and Employee Type, a new one is added from the club directory, Remove sets the type
// to Unassigned. Pure functions; the page and the mock API only call them. The richer archived
// variant (`EmployeesExtended`) uses `employees.ts` instead.
import type { EmployeeRole, EmployeeRoleInput, EmployeeSetup, LookupRef } from '../api/types';

/** The row being added: both are empty until chosen (the legacy select shows no default). */
export interface NewEmployeeRow {
  person: LookupRef | null;
  role: EmployeeRole | null;
}

export const blankNewEmployee = (): NewEmployeeRow => ({ person: null, role: null });

/** Edited types by employee id; an entry is dropped when it is set back to the saved type. */
export type RoleEdits = Readonly<Record<string, EmployeeRole>>;

export const roleOf = (e: EmployeeSetup, edits: RoleEdits): EmployeeRole => edits[e.id] ?? e.role;

export function setRole(
  saved: readonly EmployeeSetup[],
  edits: RoleEdits,
  id: string,
  role: EmployeeRole,
): RoleEdits {
  const next = { ...edits };
  if (saved.find((e) => e.id === id)?.role === role) delete next[id];
  else next[id] = role;
  return next;
}

/** Edits of employees that are still listed (a removed or reloaded employee loses its edit). */
export function pruneEdits(saved: readonly EmployeeSetup[], edits: RoleEdits): RoleEdits {
  return Object.fromEntries(Object.entries(edits).filter(([id]) => saved.some((e) => e.id === id)));
}

const isAdministrator = (e: EmployeeSetup, edits: RoleEdits) =>
  roleOf(e, edits) === 'administrator';

/** Legacy `isMultipleAdmins`, inverted: the one administrator cannot be changed or removed. */
export function isOnlyAdministrator(
  saved: readonly EmployeeSetup[],
  edits: RoleEdits,
  id: string,
): boolean {
  const admins = saved.filter((e) => isAdministrator(e, edits));
  return admins.length === 1 && admins[0].id === id;
}

export type RemoveControl = 'hidden' | 'disabled' | 'enabled';

/** Remove: not offered on the only administrator; disabled while adding or for the last row. */
export function removeControl(
  saved: readonly EmployeeSetup[],
  edits: RoleEdits,
  id: string,
  adding: boolean,
): RemoveControl {
  if (isOnlyAdministrator(saved, edits, id)) return 'hidden';
  return adding || saved.length === 1 ? 'disabled' : 'enabled';
}

export const NEW_EMPLOYEE_ERROR = 'Please select an employee and an employee type.';
export const VALIDATION_MESSAGE = 'Please correct the following errors:';

/** Legacy `save()`: a row being added needs both an employee and a type. */
export function validateNewEmployee(row: NewEmployeeRow | null): string[] {
  if (row === null) return [];
  return row.person === null || row.role === null ? [NEW_EMPLOYEE_ERROR] : [];
}

/** The rows a save sends: every changed employee, then the new one. */
export function saveInputs(
  saved: readonly EmployeeSetup[],
  edits: RoleEdits,
  row: NewEmployeeRow | null,
): EmployeeRoleInput[] {
  const changed = saved
    .filter((e) => edits[e.id] !== undefined && edits[e.id] !== e.role)
    .map((e) => ({ id: e.id, role: edits[e.id] }));
  return row?.person && row.role ? [...changed, { id: row.person.id, role: row.role }] : changed;
}

/** Save is offered when a type changed or an employee was chosen to add (legacy `employeesToBeUpdated`). */
export const canSave = (edits: RoleEdits, row: NewEmployeeRow | null): boolean =>
  Object.keys(edits).length > 0 || row?.person != null;

/** Leaving asks first while anything is unsaved, including an empty add row (legacy onBeforeRouteLeave). */
export const hasUnsaved = (edits: RoleEdits, row: NewEmployeeRow | null): boolean =>
  Object.keys(edits).length > 0 || row !== null;
