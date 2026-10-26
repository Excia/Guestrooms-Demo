import { createContext, useContext } from 'react';
import { FUNCTION_KEYS, type FunctionKey } from './permissionKeys';
import { routes, type PageId, type RouteSection } from './routes';

// Granular permissions, checked only through `can(...)`.
//
// This is the one registry. To add a permission: extend `Permission` (a new union member) and add
// it to `ALL_PERMISSIONS`; nothing else needs to know the list. Ids not in the registry are denied
// everywhere, so a typo or a permission from a newer backend fails closed.
//
// - `page.<routeId>` opens one page (menu link and route).
// - `admin` opens every Admin Setup page at once (Primary Setup, Rate Categories, Room Types,
//   Rooms, Add-On Items, Notifications). A user can also hold single `page.<admin page>` grants
//   (partial access) without `admin`.
// The '/admin' landing has no permission of its own: it opens for anyone with an Admin Setup page.
export type PermissionPageId = Exclude<PageId, 'admin'>;
export type PagePermission = `page.${PermissionPageId}`;
export type AdminPermission = 'admin';
// `reservation.edit` lets a user change a reservation in the details panel (Early/Late saves) and
// create one; without it the panel is read-only. More action permissions follow once the
// Permissions page is designed.
export type ReservationPermission = 'reservation.edit';
// Check in has three levels (ticket 163, owner decision): any time, on the arrival date only (a past
// date then needs an override code), never. Two grants express them; holding neither is "never".
export type CheckInPermission =
  'reservation.check-in.any-time' | 'reservation.check-in.arrival-date';
// `locations.edit` lets a user add, change and remove locations (ticket 182); without it the
// Locations page is read-only (at some clubs only Clubessential changes locations).
export type LocationsPermission = 'locations.edit';
// Admin Setup pages (the routes in the `admin` section, except the landing). A user who may open one
// has View access to it; `<id>.edit` adds Edit (ticket 186). `locations.edit` is the first of these.
export type AdminPageId = Extract<
  (typeof routes)[number],
  { section: Extract<RouteSection, 'admin'> }
>['id'];
export type AdminEditPermission = `${AdminPageId}.edit`;
// Night Audit 'Edit' is history plus running the audit; `page.night-audit-history` alone is History.
export type NightAuditPermission = 'night-audit.run';
// One yes/no function of a permission set (Permissions page). Stored and granted; the screens pick
// them up as their tickets land.
export type FunctionPermission = `function.${FunctionKey}`;
// `employees.edit` lets a user add, change, deactivate and remove employees (ticket 185); without it
// the Employees page is read-only.
export type EmployeesPermission = 'employees.edit';
export type Permission =
  | PagePermission
  | AdminEditPermission
  | NightAuditPermission
  | FunctionPermission
  | AdminPermission
  | ReservationPermission
  | CheckInPermission
  | LocationsPermission
  | EmployeesPermission;

export const ADMIN_PERMISSION: AdminPermission = 'admin';

export const pagePermission = (id: PermissionPageId): PagePermission => `page.${id}`;

export const RESERVATION_EDIT_PERMISSION: ReservationPermission = 'reservation.edit';

export const CHECK_IN_ANY_TIME_PERMISSION: CheckInPermission = 'reservation.check-in.any-time';
export const CHECK_IN_ARRIVAL_DATE_PERMISSION: CheckInPermission =
  'reservation.check-in.arrival-date';

export const LOCATIONS_EDIT_PERMISSION: LocationsPermission = 'locations.edit';
export const EMPLOYEES_EDIT_PERMISSION: EmployeesPermission = 'employees.edit';

export const NIGHT_AUDIT_RUN_PERMISSION: NightAuditPermission = 'night-audit.run';

export const adminEditPermission = (id: AdminPageId): AdminEditPermission => `${id}.edit`;
export const functionPermission = (key: FunctionKey): FunctionPermission => `function.${key}`;

/** Ids of the Admin Setup pages, in route-table order. */
export const ADMIN_PAGE_IDS: readonly AdminPageId[] = routes
  .filter((r) => 'section' in r && r.section === 'admin')
  .map((r) => r.id as AdminPageId);

export const ALL_PERMISSIONS: readonly Permission[] = [
  NIGHT_AUDIT_RUN_PERMISSION,
  ...FUNCTION_KEYS.map(functionPermission),
  ...ADMIN_PAGE_IDS.map(adminEditPermission),
  ADMIN_PERMISSION,
  RESERVATION_EDIT_PERMISSION,
  CHECK_IN_ANY_TIME_PERMISSION,
  CHECK_IN_ARRIVAL_DATE_PERMISSION,
  ...routes.filter((r) => r.id !== 'admin').map((r) => pagePermission(r.id as PermissionPageId)),
];

const KNOWN = new Set<string>(ALL_PERMISSIONS);

export const isKnownPermission = (value: unknown): value is Permission =>
  typeof value === 'string' && KNOWN.has(value);

export interface Permissions {
  can: (permission: Permission) => boolean;
}

/** Denies everything; the default until a grant has loaded, and after a failed load. */
export const noPermissions: Permissions = { can: () => false };

/** Every known permission allowed, or only the listed ones. Unknown ids are always denied. */
export function createPermissions(granted?: readonly Permission[]): Permissions {
  const set = granted ? new Set<Permission>(granted) : null;
  return {
    can: (permission) => isKnownPermission(permission) && (set ? set.has(permission) : true),
  };
}

export type CheckInLevel = 'any-time' | 'arrival-date-only' | 'never';

/** The strongest check-in level the user holds. Pure; the UI and the mock backend use the same rule. */
export function checkInLevel(can: Permissions['can']): CheckInLevel {
  if (can(CHECK_IN_ANY_TIME_PERMISSION)) return 'any-time';
  if (can(CHECK_IN_ARRIVAL_DATE_PERMISSION)) return 'arrival-date-only';
  return 'never';
}

/** Alias kept for tests and mock setups written against the earlier name. */
export const createMockPermissions = createPermissions;

// Fail closed: without a provider (or while the grant is loading) nobody may see anything.
const PermissionsContext = createContext<Permissions>(noPermissions);

export const PermissionsProvider = PermissionsContext.Provider;

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
