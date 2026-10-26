import type { EmployeeSetup } from '../api/types';
import {
  blankNewEmployee,
  canSave,
  hasUnsaved,
  isOnlyAdministrator,
  NEW_EMPLOYEE_ERROR,
  pruneEdits,
  removeControl,
  roleOf,
  saveInputs,
  setRole,
  validateNewEmployee,
} from './employeesLegacy';

const emp = (id: string, role: EmployeeSetup['role']): EmployeeSetup => ({ id, name: id, role });
const saved = [emp('a', 'administrator'), emp('m', 'manager'), emp('s', 'staff')];

describe('legacy employee rules', () => {
  it('records an edit and drops it when set back to the saved type', () => {
    const edits = setRole(saved, {}, 'm', 'staff');
    expect(edits).toEqual({ m: 'staff' });
    expect(roleOf(saved[1], edits)).toBe('staff');
    expect(setRole(saved, edits, 'm', 'manager')).toEqual({});
  });

  it('keeps the edits of employees that are still listed', () => {
    expect(pruneEdits(saved, { m: 'staff', gone: 'staff' })).toEqual({ m: 'staff' });
  });

  it('knows the only administrator, live with the edits', () => {
    expect(isOnlyAdministrator(saved, {}, 'a')).toBe(true);
    expect(isOnlyAdministrator(saved, {}, 'm')).toBe(false);
    // Promoting another employee in the draft frees the first one.
    expect(isOnlyAdministrator(saved, { m: 'administrator' }, 'a')).toBe(false);
    expect(isOnlyAdministrator(saved, { a: 'manager', m: 'administrator' }, 'm')).toBe(true);
  });

  it('hides Remove on the only administrator, disables it while adding or for the last row', () => {
    expect(removeControl(saved, {}, 'a', false)).toBe('hidden');
    expect(removeControl(saved, {}, 'm', false)).toBe('enabled');
    expect(removeControl(saved, {}, 'm', true)).toBe('disabled');
    expect(removeControl([emp('m', 'manager')], {}, 'm', false)).toBe('disabled');
  });

  it('needs both an employee and a type for the new row', () => {
    expect(validateNewEmployee(null)).toEqual([]);
    expect(validateNewEmployee(blankNewEmployee())).toEqual([NEW_EMPLOYEE_ERROR]);
    expect(validateNewEmployee({ person: { id: 'p', label: 'P' }, role: null })).toEqual([
      NEW_EMPLOYEE_ERROR,
    ]);
    expect(validateNewEmployee({ person: { id: 'p', label: 'P' }, role: 'staff' })).toEqual([]);
  });

  it('sends the changed rows, then the new employee', () => {
    expect(
      saveInputs(saved, { m: 'staff' }, { person: { id: 'p', label: 'P' }, role: 'manager' }),
    ).toEqual([
      { id: 'm', role: 'staff' },
      { id: 'p', role: 'manager' },
    ]);
    expect(saveInputs(saved, {}, blankNewEmployee())).toEqual([]);
  });

  it('offers Save for a changed type or a chosen employee; asks before leaving for any open add row', () => {
    expect(canSave({}, null)).toBe(false);
    expect(canSave({}, blankNewEmployee())).toBe(false);
    expect(canSave({ m: 'staff' }, null)).toBe(true);
    expect(canSave({}, { person: { id: 'p', label: 'P' }, role: null })).toBe(true);
    expect(hasUnsaved({}, null)).toBe(false);
    expect(hasUnsaved({}, blankNewEmployee())).toBe(true);
  });
});
