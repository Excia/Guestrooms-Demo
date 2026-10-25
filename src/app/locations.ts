// Business rules of Locations (Admin Setup, tickets 182 and 123). Pure functions; the page, the
// mock API and every location selector only call them.
import type { LocationInput, LocationSetup, LocationUsage } from '../api/types';

export const LOCATION_NAME_MAX = 50;

/**
 * The single-location rule: a club with one location (or none) hides every location selector,
 * dropdown, field and column on every screen. Every place that offers a location asks this, so the
 * rule changes in one spot. Takes the list the screen already has, or a count.
 */
export function showLocations(locations: readonly unknown[] | number): boolean {
  const count = typeof locations === 'number' ? locations : locations.length;
  return count >= 2;
}

export type LocationField = 'name' | 'area';
/** Messages by row id, then field. A row without problems has no entry. */
export type LocationErrors = Record<string, Partial<Record<LocationField, string>>>;

export const blankLocation = (id: string): LocationInput => ({ id, name: '', area: null });

export const toLocationInput = ({ id, name, area }: LocationSetup): LocationInput => ({
  id,
  name,
  area,
});

const nameKey = (name: string) => name.trim().toLocaleLowerCase();

export function validateLocations(rows: readonly LocationInput[]): LocationErrors {
  const errors: LocationErrors = {};
  const seen = new Map<string, string>();
  for (const row of rows) {
    const found: Partial<Record<LocationField, string>> = {};
    const name = row.name.trim();
    if (name === '') found.name = 'Enter a location name.';
    else if (name.length > LOCATION_NAME_MAX) {
      found.name = `Use at most ${LOCATION_NAME_MAX} characters.`;
    } else if (seen.has(nameKey(name))) found.name = 'Another location already has this name.';
    else seen.set(nameKey(name), row.id);
    if (row.area === null) found.area = 'Select an area.';
    if (found.name || found.area) errors[row.id] = found;
  }
  return errors;
}

/** The first problem in row order (name before area), for focus after a failed save. */
export function firstLocationError(
  rows: readonly LocationInput[],
  errors: LocationErrors,
): { id: string; field: LocationField } | null {
  for (const row of rows) {
    const found = errors[row.id];
    if (found?.name) return { id: row.id, field: 'name' };
    if (found?.area) return { id: row.id, field: 'area' };
  }
  return null;
}

/** What is stored: names without surrounding spaces. */
export const normalizeLocations = (rows: readonly LocationInput[]): LocationInput[] =>
  rows.map((r) => ({ ...r, name: r.name.trim() }));

const sameRow = (a: LocationInput, b: LocationInput) =>
  a.id === b.id && a.name.trim() === b.name.trim() && (a.area?.id ?? null) === (b.area?.id ?? null);

/**
 * Whether the draft differs from what is saved. The untouched blank row a new club starts with
 * does not count, and neither does reordering nothing: order is the saved order.
 */
export function locationsDirty(
  saved: readonly LocationInput[],
  draft: readonly LocationInput[],
): boolean {
  const savedIds = new Set(saved.map((s) => s.id));
  const meaningful = draft.filter((d) => savedIds.has(d.id) || d.name.trim() !== '' || d.area);
  return meaningful.length !== saved.length || meaningful.some((d, i) => !sameRow(d, saved[i]));
}

export interface RemovalCheck {
  /** False while room types or rooms still use the location. */
  allowed: boolean;
  /** The reason, in the words the dialog shows; empty when allowed. */
  reason: string;
  roomTypes: readonly string[];
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** A location in use by a room type or a room cannot be removed (legacy blocks it the same way). */
export function checkRemoveLocation(usage: LocationUsage): RemovalCheck {
  if (usage.roomTypes.length === 0 && usage.roomCount === 0) {
    return { allowed: true, reason: '', roomTypes: [] };
  }
  const parts = [
    usage.roomTypes.length > 0 ? plural(usage.roomTypes.length, 'room type') : null,
    usage.roomCount > 0 ? plural(usage.roomCount, 'room') : null,
  ].filter(Boolean);
  return {
    allowed: false,
    reason: `This location is used by ${parts.join(' and ')}. Move or remove them before removing the location.`,
    roomTypes: usage.roomTypes,
  };
}

/** A club must keep one location, so the only row cannot be removed. */
export const canRemoveRow = (rowCount: number): boolean => rowCount > 1;
