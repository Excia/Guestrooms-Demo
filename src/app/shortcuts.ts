import { pagePermission, type Permissions } from './permissions';
import { routes, type PageId, type RouteMeta, type ReservationRouteId } from './routes';

export interface ShortcutItem {
  id: ReservationRouteId;
  label: string;
  path: string;
}

/**
 * Dashboard Reservation Management list (Figma 69:3790): the 'reservation' section of the route
 * table in table order, filtered with the same `can(page.<id>)` check the menu uses. Admin Setup
 * routes belong to another section and never appear.
 */
export function buildShortcuts(
  permissions: Permissions,
  table: readonly RouteMeta[] = routes,
): ShortcutItem[] {
  return table
    .filter((r) => r.section === 'reservation' && permissions.can(pagePermission(r.id as PageId)))
    .map((r) => ({ id: r.id as ReservationRouteId, label: r.menuLabel ?? r.title, path: r.path }));
}

// Count badge (Figma 14944:44825): 28 x 28 minimum, hugs the value with 8px left and right padding.
/** Badge height and minimum width, in theme.spacing units (3.5 x 8px = 28px). */
export const BADGE_MIN_SIZE_SPACING = 3.5;
/** Left and right padding, in theme.spacing units (1 x 8px = 8px). */
export const BADGE_PADDING_X_SPACING = 1;
const SPACING_PX = 8;
/** Approximate advance of one 12px Roboto digit or separator, used only to estimate the width. */
const GLYPH_PX = 7;

const countFormat = new Intl.NumberFormat('en-US');

/** The count as shown in the badge, with thousands separators. */
export const formatCount = (count: number): string => countFormat.format(count);

/** Hidden at zero (and for anything that is not a positive whole number). */
export const shouldShowBadge = (count: number | undefined): count is number =>
  typeof count === 'number' && Number.isFinite(count) && count >= 1;

/** Estimated badge width in px: the 28px minimum, or the text plus 8px padding on each side. */
export function badgeWidthPx(count: number): number {
  const text = formatCount(count).length * GLYPH_PX + 2 * BADGE_PADDING_X_SPACING * SPACING_PX;
  return Math.max(BADGE_MIN_SIZE_SPACING * SPACING_PX, text);
}

export const unassignedChargesLabel = (count: number): string =>
  `${formatCount(count)} unassigned ${count === 1 ? 'charge' : 'charges'}`;
