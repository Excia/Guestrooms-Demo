import { routes, type PageId } from './routes';

export interface AdminNavItem {
  label: string;
  /** Route of the page; items without one have no page yet and show as unavailable. */
  path?: string;
  /** Matches `routes[].id`, for the access check. */
  id?: PageId;
  /** Starts the second group (legacy: the Admin Setup menu's own pages, apart from the Primary Setup tabs). */
  groupStart?: boolean;
}

const path = (id: string) => routes.find((r) => r.id === id)?.path;

// Left navigation of the Admin Setup shell (Figma 11964:11791 and ticket 7.1). "System Settings" is
// the menu's Primary Setup page. The other entries gain a path as their tickets land.
// Order and grouping follow the legacy app: first the Primary Setup tabs (Locations ... API Keys),
// then the setup lists the legacy Admin Setup menu lists beside Primary Setup. Legacy has no
// Migration Tool. Notifications (legacy, last) has no page yet and is not listed.
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: 'Locations', path: path('locations'), id: 'locations' },
  { label: 'Room Options', path: path('room-options'), id: 'room-options' },
  { label: 'Booking Rules', path: path('booking-rules'), id: 'booking-rules' },
  { label: 'System Settings', path: path('primary-setup'), id: 'primary-setup' },
  { label: 'Employees', path: path('employees'), id: 'employees' },
  { label: 'Permissions', path: path('permissions'), id: 'permissions' },
  { label: 'Keycard Integration', path: path('keycard-integration'), id: 'keycard-integration' },
  { label: 'API Integrations' },
  { label: 'API Keys' },
  {
    label: 'Rate Categories',
    path: path('rate-categories'),
    id: 'rate-categories',
    groupStart: true,
  },
  { label: 'Room Types', path: path('room-types'), id: 'room-types' },
  { label: 'Rooms', path: path('rooms'), id: 'rooms' },
  { label: 'Add-On Items', path: path('add-on-items'), id: 'add-on-items' },
];
