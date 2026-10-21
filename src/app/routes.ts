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
  /** Set to false for routes that appear on the dashboard shortcut list but not in the menu. */
  showInMenu?: false;
}

export const SCHEDULE_PATH = '/schedule';
export const DASHBOARD_PATH = '/dashboard';
export const ROOM_BLOCKS_PATH = '/room-blocks';
/** Reservation List (ticket 3.1): the list side of the schedule's list/calendar toggle. */
export const RESERVATIONS_PATH = '/reservations';
/** Night Audit History; the schedule's Night Audit button opens it until the run screen exists. */
export const NIGHT_AUDIT_HISTORY_PATH = '/night-audit-history';
/** Open Folios (stub): where "Jump to Folio" and the panel's Folio button go until the folio screens exist. */
export const OPEN_FOLIOS_PATH = '/open-folios';
/** Stub results for the New Reservation search (ticket 1.4); not a menu link. */
export const NEW_RESERVATION_RESULTS_PATH = '/reservations/new/results';

// Note: '/admin' (Admin Setup landing) is not a menu link; it opens for anyone who can open an
// Admin Setup page (see src/app/access.ts).
export const routes = [
  { id: 'dashboard', path: DASHBOARD_PATH, title: 'Dashboard', section: 'dashboard' },
  {
    id: 'schedule',
    path: SCHEDULE_PATH,
    title: 'Schedule',
    menuLabel: 'Schedule | Home',
    section: 'reservation',
  },
  { id: 'reservations', path: RESERVATIONS_PATH, title: 'Reservations', section: 'reservation' },
  // FLAG: no permission mapping yet. When role-based access (ticket 9) gives every route its own
  // `page.<id>` permission, the owner must decide; recommended: gate on the reservations permission.
  {
    id: 'new-reservation-results',
    path: NEW_RESERVATION_RESULTS_PATH,
    title: 'Search Results',
  },
  { id: 'open-folios', path: OPEN_FOLIOS_PATH, title: 'Open Folios', section: 'reservation' },
  {
    id: 'unassigned-charges',
    path: '/unassigned-charges',
    title: 'Unassigned Charges',
    section: 'reservation',
    showInMenu: false, // Figma's menu (12047:5743) omits it; the dashboard list (69:3790) has it.
  },
  { id: 'waitlist', path: '/waitlist', title: 'Waitlist', section: 'reservation' },
  {
    id: 'night-audit-history',
    path: NIGHT_AUDIT_HISTORY_PATH,
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
export type MenuRouteId = Exclude<
  Extract<(typeof routes)[number], { section: RouteSection }>,
  { showInMenu: false }
>['id'];
/** Ids of the reservation section: the dashboard shortcut list (the menu's minus none, plus Unassigned Charges). */
export type ReservationRouteId = Extract<(typeof routes)[number], { section: 'reservation' }>['id'];
