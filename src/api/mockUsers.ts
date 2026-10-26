import {
  adminEditPermission,
  CHECK_IN_ANY_TIME_PERMISSION,
  pagePermission,
  RESERVATION_EDIT_PERMISSION,
  type Permission,
  type PermissionPageId,
} from '../app/permissions';
import { routes, type RouteMeta } from '../app/routes';
import type { PermissionGrant } from './types';

/** Dev-only: which mock user is signed in. Persisted under this localStorage key. */
export const MOCK_USER_STORAGE_KEY = 'gr.mockUser';

export type MockUserId = 'admin' | 'non-admin' | 'partial' | 'view-only';

export interface MockUser {
  id: MockUserId;
  label: string;
  /** The fixed grant; ignored when `permissionSetId` is set (the grant then comes from the saved set). */
  grant: PermissionGrant;
  /** The permission set the user belongs to (Permissions page, ticket 186). */
  permissionSetId?: string;
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
    label: 'Non-admin (Staff set)',
    // The grant comes from the saved Staff set (no setup pages by default).
    grant: { role: 'Staff', permissions: [] },
    permissionSetId: 'staff',
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
        .concat(RESERVATION_EDIT_PERMISSION, CHECK_IN_ANY_TIME_PERMISSION)
        // Edit on the two pages it can open; the other setup pages it has none.
        .concat(adminEditPermission('rooms'), adminEditPermission('room-types')),
    },
  },
  {
    id: 'view-only',
    label: 'View-only admin (Management set)',
    // The grant comes from the saved Management set: every setup page read-only by default.
    grant: { role: 'Management', permissions: [] },
    permissionSetId: 'management',
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
