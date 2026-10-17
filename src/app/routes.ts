// Route table with breadcrumb metadata. Pages arrive in later tickets; paths follow the menu (Figma 12047:5743).
export interface RouteMeta {
  path: string;
  title: string;
  /** Path of the parent route, used for breadcrumbs. */
  parent?: string;
}

export const SCHEDULE_PATH = '/schedule';

export const routes: RouteMeta[] = [
  { path: SCHEDULE_PATH, title: 'Schedule' },
  { path: '/reservations', title: 'Reservations', parent: SCHEDULE_PATH },
  { path: '/open-folios', title: 'Open Folios', parent: SCHEDULE_PATH },
  { path: '/waitlist', title: 'Waitlist', parent: SCHEDULE_PATH },
  { path: '/night-audit-history', title: 'Night Audit History', parent: SCHEDULE_PATH },
  { path: '/add-on-countdown', title: 'Add-On Countdown', parent: SCHEDULE_PATH },
  { path: '/room-blocks', title: 'Room Blocks', parent: SCHEDULE_PATH },
  { path: '/member-directory', title: 'Member Directory', parent: SCHEDULE_PATH },
  { path: '/reporting', title: 'Reporting', parent: SCHEDULE_PATH },
  { path: '/admin', title: 'Admin Setup', parent: SCHEDULE_PATH },
  { path: '/admin/primary-setup', title: 'Primary Setup', parent: '/admin' },
  { path: '/admin/rate-categories', title: 'Rate Categories', parent: '/admin' },
  { path: '/admin/room-types', title: 'Room Types', parent: '/admin' },
  { path: '/admin/rooms', title: 'Rooms', parent: '/admin' },
  { path: '/admin/add-on-items', title: 'Add-On Items', parent: '/admin' },
  { path: '/admin/notifications', title: 'Notifications', parent: '/admin' },
];
