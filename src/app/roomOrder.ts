// Room display order (Rooms setup "Reorder"): pure rules shared by the Rooms page, the mock API and
// the Schedule. The saved order is the order of `listRooms`; the Schedule lists rooms in it too.

/** Moves the item at `from` to position `to`; out-of-range or equal positions change nothing. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Id lists equal element by element. */
export const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * The rooms the reorder panel lists: the active ones, in their saved order. Inactive rooms always sit
 * at the bottom of the setup list (9.4.2.4), so ordering them would have no visible effect (D-MM-5).
 */
export function reorderableRooms<T extends { id: string }>(
  rooms: readonly T[],
  isActive: (room: T) => boolean,
): T[] {
  return rooms.filter(isActive);
}

/**
 * The full order after saving the panel: the panel's ids first, in the given order, then every room
 * not in it (the inactive ones) in its current relative order.
 */
export function applyRoomOrder<T extends { id: string }>(
  rooms: readonly T[],
  orderedIds: readonly string[],
): T[] {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const listed = orderedIds.flatMap((id) => (byId.has(id) ? [byId.get(id) as T] : []));
  const seen = new Set(listed.map((r) => r.id));
  return [...listed, ...rooms.filter((r) => !seen.has(r.id))];
}

/**
 * Orders Schedule rows by the setup order. A Schedule room matches a setup room by room number =
 * room name; the matched rooms keep the row positions they had and fill them in setup order, so rooms
 * without a setup record stay where they are (the mock's two room lists are separate placeholders).
 */
export function orderScheduleRooms<T extends { number: string }>(
  scheduleRooms: readonly T[],
  setupRoomNames: readonly string[],
): T[] {
  const rank = new Map<string, number>();
  setupRoomNames.forEach((name, i) => {
    if (!rank.has(name)) rank.set(name, i);
  });
  const slots: number[] = [];
  const matched: T[] = [];
  scheduleRooms.forEach((room, i) => {
    if (rank.has(room.number)) {
      slots.push(i);
      matched.push(room);
    }
  });
  matched.sort((a, b) => (rank.get(a.number) as number) - (rank.get(b.number) as number));
  const result = [...scheduleRooms];
  slots.forEach((slot, i) => {
    result[slot] = matched[i];
  });
  return result;
}

/**
 * The order the reorder view shows: the user's moves (`local`) kept for the rooms that still exist, then
 * any room that appeared since, in `currentIds` order. A deleted or retired room drops out, so the
 * view never renders a blank row or sends a stale id.
 */
export function reconcileOrder(local: readonly string[], currentIds: readonly string[]): string[] {
  const current = new Set(currentIds);
  const kept = local.filter((id, i) => current.has(id) && local.indexOf(id) === i);
  const seen = new Set(kept);
  return [...kept, ...currentIds.filter((id) => !seen.has(id))];
}
