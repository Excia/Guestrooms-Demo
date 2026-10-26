import type { EmployeeSetup } from '../api/types';
import {
  blankEmployee,
  employeeSummary,
  isEmployeeRole,
  lastAdministratorProblem,
  needsPermissionSet,
  sortEmployees,
  toEmployeeDraft,
  toEmployeeInput,
  validateEmployee,
  withRole,
} from './employees';

const sets = [
  { id: 's1', label: 'Front Desk' },
  { id: 's2', label: 'Accounting' },
];
const emp = (over: Partial<EmployeeSetup> & { id: string }): EmployeeSetup => ({
  name: over.id,
  role: 'staff',
  permissionSetId: 's1',
  active: true,
  ...over,
});

describe('employee form rules', () => {
  it('starts as an active staff member with nobody chosen', () => {
    expect(blankEmployee()).toEqual({
      person: null,
      role: 'staff',
      permissionSetId: null,
      active: true,
    });
  });

  it('requires a person (new only) and a permission set for non-administrators', () => {
    const draft = blankEmployee();
    expect(validateEmployee(draft, { creating: true, permissionSets: sets })).toEqual({
      person: 'Select an employee.',
      permissionSetId: 'Select a permission set.',
    });
    expect(validateEmployee(draft, { creating: false, permissionSets: sets })).toEqual({
      permissionSetId: 'Select a permission set.',
    });
  });

  it('accepts a complete draft and a set-less administrator', () => {
    const ok = { ...blankEmployee(), person: { id: 'p', label: 'P' }, permissionSetId: 's2' };
    expect(validateEmployee(ok, { creating: true, permissionSets: sets })).toEqual({});
    expect(
      validateEmployee(withRole(ok, 'administrator'), { creating: true, permissionSets: sets }),
    ).toEqual({});
  });

  it('refuses a permission set that no longer exists', () => {
    const draft = { ...blankEmployee(), permissionSetId: 'gone' };
    expect(
      validateEmployee(draft, { creating: false, permissionSets: sets }).permissionSetId,
    ).toMatch(/no longer exists/);
  });

  it('clears the set when the role becomes administrator and keeps it otherwise', () => {
    const draft = { ...blankEmployee(), permissionSetId: 's1' };
    expect(withRole(draft, 'administrator').permissionSetId).toBeNull();
    expect(withRole(draft, 'manager').permissionSetId).toBe('s1');
    expect(needsPermissionSet('administrator')).toBe(false);
    expect(needsPermissionSet('manager')).toBe(true);
  });

  it('builds the request, dropping the set of an administrator', () => {
    expect(toEmployeeInput(blankEmployee())).toBeNull();
    const draft = { ...blankEmployee(), person: { id: 'p', label: 'P' }, permissionSetId: 's1' };
    expect(toEmployeeInput(draft)).toEqual({
      id: 'p',
      role: 'staff',
      permissionSetId: 's1',
      active: true,
    });
    expect(toEmployeeInput({ ...draft, role: 'administrator' })?.permissionSetId).toBeNull();
  });

  it('round-trips a saved employee through the draft', () => {
    const saved = emp({ id: 'a', name: 'Ada', role: 'manager', active: false });
    expect(toEmployeeInput(toEmployeeDraft(saved))).toEqual({
      id: 'a',
      role: 'manager',
      permissionSetId: 's1',
      active: false,
    });
  });

  it('knows the roles', () => {
    expect(isEmployeeRole('manager')).toBe(true);
    expect(isEmployeeRole('owner')).toBe(false);
  });
});

describe('sortEmployees', () => {
  it('lists active employees by name, inactive ones last', () => {
    const list = [
      emp({ id: 'z', name: 'Zed' }),
      emp({ id: 'i', name: 'Abe', active: false }),
      emp({ id: 'b', name: 'beth' }),
      emp({ id: 'a', name: 'Al' }),
    ];
    expect(sortEmployees(list).map((e) => e.id)).toEqual(['a', 'b', 'z', 'i']);
    expect(list[0].id).toBe('z'); // the input is not changed
  });
});

describe('lastAdministratorProblem', () => {
  const admin = emp({ id: 'a1', role: 'administrator', permissionSetId: null });
  it('blocks demoting, deactivating or removing the only active administrator', () => {
    const list = [admin, emp({ id: 's' })];
    expect(lastAdministratorProblem(list, 'a1', { role: 'staff', active: true })).toMatch(/only/);
    expect(lastAdministratorProblem(list, 'a1', { role: 'administrator', active: false })).toMatch(
      /only/,
    );
    expect(lastAdministratorProblem(list, 'a1', null)).toMatch(/removing/);
  });
  it('allows keeping the administrator, and any change while another one is active', () => {
    expect(
      lastAdministratorProblem([admin], 'a1', { role: 'administrator', active: true }),
    ).toBeNull();
    const two = [admin, emp({ id: 'a2', role: 'administrator', permissionSetId: null })];
    expect(lastAdministratorProblem(two, 'a1', null)).toBeNull();
  });
  it('does not count an inactive administrator, and ignores non-administrators', () => {
    const list = [admin, emp({ id: 'a2', role: 'administrator', active: false })];
    expect(lastAdministratorProblem(list, 'a1', null)).not.toBeNull();
    expect(lastAdministratorProblem(list, 's-none', null)).toBeNull();
    expect(lastAdministratorProblem([admin, emp({ id: 's' })], 's', null)).toBeNull();
  });
});

describe('employeeSummary', () => {
  it('names the role and the set', () => {
    expect(employeeSummary(emp({ id: 'a', role: 'manager', permissionSetId: 's2' }), sets)).toBe(
      'Manager, Accounting',
    );
    expect(
      employeeSummary(emp({ id: 'a', role: 'administrator', permissionSetId: null }), sets),
    ).toBe('Administrator');
  });
});
