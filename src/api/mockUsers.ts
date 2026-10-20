import { pagePermission } from '../app/permissions';
import { routes } from '../app/routes';
import type { PermissionGrant } from './types';

/** Dev-only: which mock user is signed in. Persisted under this localStorage key. */
export const MOCK_USER_STORAGE_KEY = 'gr.mockUser';

export type MockUserId = 'admin' | 'non-admin' | 'partial';

export interface MockUser {
  id: MockUserId;
  label: string;
  grant: PermissionGrant;
}

const nonAdminPages = routes.filter((r) => r.id !== 'admin' && r.section !== 'admin');

export const MOCK_USERS: readonly MockUser[] = [
  { id: 'admin', label: 'Administrator', grant: { role: 'Administrator', permissions: 'all' } },
  {
    id: 'non-admin',
    label: 'Non-admin (no admin pages)',
    grant: { role: 'Staff', permissions: nonAdminPages.map((r) => pagePermission(r.id)) },
  },
  {
    id: 'partial',
    label: 'Partial (Rooms, Room Types)',
    grant: {
      role: 'Staff with some setup',
      permissions: [
        ...nonAdminPages,
        ...routes.filter((r) => r.id === 'rooms' || r.id === 'room-types'),
      ].map((r) => pagePermission(r.id)),
    },
  },
];

/** Unknown or missing values fall back to the administrator, the pre-switcher default. */
export function resolveMockUser(stored: string | null | undefined): MockUser {
  return MOCK_USERS.find((u) => u.id === stored) ?? MOCK_USERS[0];
}
