import type { EmployeeSetup, LookupRef } from './types';

// PLACEHOLDER sample data until the backend exists (see entries/185-employees.md). The permission set
// ids are the real ones from the Permissions page (ticket 186): `management` and `staff`.

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
      permissionSetId: 'management',
      active: true,
    },
    {
      id: 'emp-3',
      name: 'Dana Whitfield',
      role: 'staff',
      permissionSetId: 'staff',
      active: true,
    },
    {
      id: 'emp-4',
      name: 'Priya Nair',
      role: 'staff',
      permissionSetId: 'staff',
      active: true,
    },
    {
      id: 'emp-5',
      name: 'Tom Hale',
      role: 'staff',
      permissionSetId: 'staff',
      active: false,
    },
    {
      id: 'emp-6',
      name: 'Grace Okafor',
      role: 'manager',
      permissionSetId: 'management',
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
