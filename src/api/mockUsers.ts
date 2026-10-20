import {
  pagePermission,
  RESERVATION_EDIT_PERMISSION,
  type Permission,
  type PermissionPageId,
} from '../app/permissions';
import { routes, type RouteMeta } from '../app/routes';
import type { PermissionGrant } from './types';

/** Dev-only: which mock user is signed in. Persisted under this localStorage key. */
export const MOCK_USER_STORAGE_KEY = 'gr.mockUser';

export type MockUserId = 'admin' | 'non-admin' | 'partial';

export interface MockUser {
  id: MockUserId;
  label: string;
  grant: PermissionGrant;
}

// Widened to RouteMeta: routes without a section (e.g. the search results page) have no `section` key in the
// narrowed table type.
const nonAdminPages = (routes as readonly RouteMeta[]).filter(
  (r) => r.id !== 'admin' && r.section !== 'admin',
);

export const MOCK_USERS: readonly MockUser[] = [
  { id: 'admin', label: 'Administrator', grant: { role: 'Administrator', permissions: 'all' } },
  {
    id: 'non-admin',
    label: 'Non-admin (no admin pages)',
    grant: {
      role: 'Staff',
      permissions: [
        ...nonAdminPages.map((r) => pagePermission(r.id as PermissionPageId)),
        RESERVATION_EDIT_PERMISSION,
      ] satisfies Permission[],
    },
  },
  {
    id: 'partial',
    label: 'Partial (Rooms, Room Types)',
    grant: {
      role: 'Staff with some setup',
      permissions: [
        ...nonAdminPages,
        ...routes.filter((r) => r.id === 'rooms' || r.id === 'room-types'),
      ]
        .flatMap((r): Permission[] => [pagePermission(r.id as PermissionPageId)])
        .concat(RESERVATION_EDIT_PERMISSION),
    },
  },
];

const byId = (id: MockUserId) => MOCK_USERS.find((u) => u.id === id)!;

/**
 * Demo builds (the mock in a production build) always run as the administrator. A demo visitor
 * therefore never sees the non-admin experience; that is a product decision, revisit if wanted.
 */
export const DEMO_MOCK_USER = byId('admin');

/** Dev: a missing or corrupt stored id falls back to the LEAST privileged user, never the admin. */
export function resolveMockUser(stored: string | null | undefined): MockUser {
  return MOCK_USERS.find((u) => u.id === stored) ?? byId('non-admin');
}
