// Route table. Pages arrive in later tickets; paths follow the menu (Figma 12047:5743).
// App.tsx generates its <Route>s from this table, so a page registers here only.
// The menu overlay and the dashboard derive their links from `section`, in table order.
export type RouteSection = 'dashboard' | 'reservation' | 'admin';

export interface RouteMeta {
  /** Stable id; the menu checks the `page.<id>` permission for routes that have a section. */
  id: string;
  path: string;
  title: string;
  /** Menu section the route is listed in. Routes without one are not menu links. */
  section?: RouteSection;
  /** Menu label when it differs from the page title. */
  menuLabel?: string;
}

export const SCHEDULE_PATH = '/schedule';
export const DASHBOARD_PATH = '/dashboard';
export const ROOM_BLOCKS_PATH = '/room-blocks';

// Note: '/admin' (Admin Setup landing) is not a menu link, so it has no menu permission yet;
// gate it on "any admin page" when the real permissions (0.8) arrive.
export const routes = [
  { id: 'dashboard', path: DASHBOARD_PATH, title: 'Dashboard', section: 'dashboard' },
  {
    id: 'schedule',
    path: SCHEDULE_PATH,
    title: 'Schedule',
    menuLabel: 'Schedule | Home',
    section: 'reservation',
  },
  { id: 'reservations', path: '/reservations', title: 'Reservations', section: 'reservation' },
  { id: 'open-folios', path: '/open-folios', title: 'Open Folios', section: 'reservation' },
  { id: 'waitlist', path: '/waitlist', title: 'Waitlist', section: 'reservation' },
  {
    id: 'night-audit-history',
    path: '/night-audit-history',
    title: 'Night Audit History',
    section: 'reservation',
  },
  {
    id: 'add-on-countdown',
    path: '/add-on-countdown',
    title: 'Add-On Countdown',
    section: 'reservation',
  },
  { id: 'room-blocks', path: ROOM_BLOCKS_PATH, title: 'Room Blocks', section: 'reservation' },
  {
    id: 'member-directory',
    path: '/member-directory',
    title: 'Member Directory',
    section: 'reservation',
  },
  { id: 'reporting', path: '/reporting', title: 'Reporting', section: 'reservation' },
  { id: 'admin', path: '/admin', title: 'Admin Setup' },
  { id: 'primary-setup', path: '/admin/primary-setup', title: 'Primary Setup', section: 'admin' },
  {
    id: 'rate-categories',
    path: '/admin/rate-categories',
    title: 'Rate Categories',
    section: 'admin',
  },
  { id: 'room-types', path: '/admin/room-types', title: 'Room Types', section: 'admin' },
  { id: 'rooms', path: '/admin/rooms', title: 'Rooms', section: 'admin' },
  { id: 'add-on-items', path: '/admin/add-on-items', title: 'Add-On Items', section: 'admin' },
  {
    id: 'notifications',
    path: '/admin/notifications',
    title: 'Notifications',
    section: 'admin',
  },
] as const satisfies readonly RouteMeta[];

export type PageId = (typeof routes)[number]['id'];
/** Ids of routes listed in the menu; the overlay keys its icons to these. */
export type MenuRouteId = Extract<(typeof routes)[number], { section: RouteSection }>['id'];
