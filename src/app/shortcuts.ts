import { canAccessPage } from './access';
import type { Permissions } from './permissions';
import { routes, type RouteMeta, type ReservationRouteId } from './routes';

export interface ShortcutItem {
  id: ReservationRouteId;
  label: string;
  path: string;
}

/**
 * Dashboard Reservation Management list (Figma 69:3790): the 'reservation' section of the route
 * table in table order, filtered with the same `canAccessPage` gate as the menu so the two lists
 * cannot drift. Admin Setup routes belong to another section and never appear.
 */
export function buildShortcuts(
  permissions: Permissions,
  table: readonly RouteMeta[] = routes,
): ShortcutItem[] {
  return table
    .filter((r) => r.section === 'reservation' && canAccessPage(permissions.can, r.id, table))
    .map((r) => ({ id: r.id as ReservationRouteId, label: r.menuLabel ?? r.title, path: r.path }));
}

// Count badge (Figma 14944:44825): 28 x 28 minimum, hugs the value with 8px left and right padding.
/** Badge height and minimum width, in theme.spacing units (3.5 x 8px = 28px). */
export const BADGE_MIN_SIZE_SPACING = 3.5;
/** Left and right padding, in theme.spacing units (1 x 8px = 8px). */
export const BADGE_PADDING_X_SPACING = 1;
const countFormat = new Intl.NumberFormat('en-US');

/** The count as shown in the badge, with thousands separators. */
export const formatCount = (count: number): string => countFormat.format(count);

/** Hidden at zero (and for anything that is not a positive whole number). */
export const shouldShowBadge = (count: number | undefined): count is number =>
  typeof count === 'number' && Number.isFinite(count) && count >= 1;

export const unassignedChargesLabel = (count: number): string =>
  `${formatCount(count)} unassigned ${count === 1 ? 'charge' : 'charges'}`;
