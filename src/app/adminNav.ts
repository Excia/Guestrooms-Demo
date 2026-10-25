import { routes, type PageId } from './routes';

export interface AdminNavItem {
  label: string;
  /** Route of the page; items without one have no page yet and show as unavailable. */
  path?: string;
  /** Matches `routes[].id`, for the access check. */
  id?: PageId;
}

const path = (id: string) => routes.find((r) => r.id === id)?.path;

// Left navigation of the Admin Setup shell (Figma 11964:11791 and ticket 7.1). "System Settings" is
// the menu's Primary Setup page. The other entries gain a path as their tickets land.
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: 'Locations', path: path('locations'), id: 'locations' },
  { label: 'Room Options' },
  { label: 'Booking Rules', path: path('booking-rules'), id: 'booking-rules' },
  { label: 'System Settings', path: path('primary-setup'), id: 'primary-setup' },
  { label: 'Employees' },
  { label: 'Permissions' },
  { label: 'Keycard Integration', path: path('keycard-integration'), id: 'keycard-integration' },
  { label: 'API Integrations' },
  { label: 'Migration Tool' },
];
