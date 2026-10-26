import type { EmployeeSetup, LookupRef } from './types';

// PLACEHOLDER sample data until the backend exists (see entries/185-employees.md). The permission
// sets are illustrative: the Permissions page (ticket 186) owns the real ones.
export const MOCK_PERMISSION_SETS: LookupRef[] = [
  { id: 'set-front-desk', label: 'Front Desk' },
  { id: 'set-reservations', label: 'Reservations Manager' },
  { id: 'set-housekeeping', label: 'Housekeeping' },
  { id: 'set-accounting', label: 'Accounting' },
];

export function mockEmployees(): EmployeeSetup[] {
  return [
    {
      id: 'emp-1',
      name: 'Alex Moreno',
      role: 'administrator',
      permissionSetId: null,
      active: true,
    },
    {
      id: 'emp-2',
      name: 'Marcus Bell',
      role: 'manager',
      permissionSetId: 'set-reservations',
      active: true,
    },
    {
      id: 'emp-3',
      name: 'Dana Whitfield',
      role: 'staff',
      permissionSetId: 'set-front-desk',
      active: true,
    },
    {
      id: 'emp-4',
      name: 'Priya Nair',
      role: 'staff',
      permissionSetId: 'set-housekeeping',
      active: true,
    },
    {
      id: 'emp-5',
      name: 'Tom Hale',
      role: 'staff',
      permissionSetId: 'set-front-desk',
      active: false,
    },
    {
      id: 'emp-6',
      name: 'Grace Okafor',
      role: 'manager',
      permissionSetId: 'set-accounting',
      active: true,
    },
  ];
}

/** People of the club directory who are not employees of Guest Rooms yet. */
export function mockEmployeeCandidates(): LookupRef[] {
  return [
    { id: 'dir-1', label: 'Sam Rivera' },
    { id: 'dir-2', label: 'Lena Park' },
    { id: 'dir-3', label: 'Owen Gallagher' },
    { id: 'dir-4', label: 'Hannah Cole' },
    { id: 'dir-5', label: 'Victor Ng' },
  ];
}
