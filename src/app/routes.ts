// Route table. Pages arrive in later tickets; paths follow the menu (Figma 12047:5743).
// App.tsx generates its <Route>s from this table, so a page registers here only.
export interface RouteMeta {
  path: string;
  title: string;
}

export const SCHEDULE_PATH = '/schedule';

export const routes: RouteMeta[] = [
  { path: SCHEDULE_PATH, title: 'Schedule' },
  { path: '/reservations', title: 'Reservations' },
  { path: '/open-folios', title: 'Open Folios' },
  { path: '/waitlist', title: 'Waitlist' },
  { path: '/night-audit-history', title: 'Night Audit History' },
  { path: '/add-on-countdown', title: 'Add-On Countdown' },
  { path: '/room-blocks', title: 'Room Blocks' },
  { path: '/member-directory', title: 'Member Directory' },
  { path: '/reporting', title: 'Reporting' },
  { path: '/admin', title: 'Admin Setup' },
  { path: '/admin/primary-setup', title: 'Primary Setup' },
  { path: '/admin/rate-categories', title: 'Rate Categories' },
  { path: '/admin/room-types', title: 'Room Types' },
  { path: '/admin/rooms', title: 'Rooms' },
  { path: '/admin/add-on-items', title: 'Add-On Items' },
  { path: '/admin/notifications', title: 'Notifications' },
];
