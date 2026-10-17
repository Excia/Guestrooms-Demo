// Pure selection rules for <LocationFilter>. An empty selection means "All Locations".

export const ALL_LOCATIONS_LABEL = 'All Locations';

/** Toggles one location; picking "all" (null) clears the selection. */
export function toggleLocation(selected: readonly string[], id: string | null): string[] {
  if (id === null) return [];
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

/** Keeps only ids that still exist, in the order of `all`. */
export function normalizeSelection(selected: readonly string[], all: readonly string[]): string[] {
  return all.filter((id) => selected.includes(id));
}

/** Selecting every location is the same filter as selecting none. */
export function isAllLocations(selected: readonly string[], all: readonly string[]): boolean {
  return selected.length === 0 || normalizeSelection(selected, all).length === all.length;
}

/** One representation for the consumer: every location selected is reported as [] (All). */
export function toReported(selected: readonly string[], all: readonly string[]): string[] {
  return isAllLocations(selected, all) ? [] : normalizeSelection(selected, all);
}
