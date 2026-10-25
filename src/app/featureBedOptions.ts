// Business rules of Room Options: Features and Bed Sizes (LP-A.2 / 7.12). Pure functions; the
// page and the mock API only call them.
import type {
  LookupRef,
  RoomOptionInput,
  RoomOptions,
  RoomSetup,
  RoomTypeSetup,
  SaveRoomOptionsRequest,
} from '../api/types';

/** Legacy limits an item name to 50 characters. */
export const ROOM_OPTION_MAX = 50;

export type RoomOptionKind = 'features' | 'bedSizes';

/** Singular and lower-case names for messages and labels, per list. */
export const ROOM_OPTION_COPY = {
  features: { title: 'Features', singular: 'Feature', add: 'Add Feature' },
  bedSizes: { title: 'Bed Sizes', singular: 'Bed Size', add: 'Add Bed Size' },
} as const satisfies Record<RoomOptionKind, { title: string; singular: string; add: string }>;

/** An item being edited. `key` is stable for the life of the draft; `id` is absent until saved. */
export interface RoomOptionDraft {
  key: string;
  id?: string;
  label: string;
}

export interface RoomOptionsDraft {
  features: RoomOptionDraft[];
  bedSizes: RoomOptionDraft[];
}

export const draftFromOptions = (options: RoomOptions): RoomOptionsDraft => ({
  features: options.features.map((o) => ({ key: o.id, id: o.id, label: o.label })),
  bedSizes: options.bedSizes.map((o) => ({ key: o.id, id: o.id, label: o.label })),
});

export const toInputs = (items: readonly RoomOptionDraft[]): RoomOptionInput[] =>
  items.map((i) => (i.id ? { id: i.id, label: i.label } : { label: i.label }));

export const toRequest = (
  draft: RoomOptionsDraft,
  requestId: string,
  version: string,
): SaveRoomOptionsRequest => ({
  requestId,
  version,
  features: toInputs(draft.features),
  bedSizes: toInputs(draft.bedSizes),
});

const norm = (label: string) => label.trim().toLowerCase();

/**
 * One message per refused item, aligned with `labels`; an accepted item has none. A name is
 * required, at most 50 characters, and not the same as another item of the list (case-insensitive).
 */
export function validateOptionLabels(
  labels: readonly string[],
  kind: RoomOptionKind,
): (string | undefined)[] {
  const name = ROOM_OPTION_COPY[kind].singular;
  const counts = new Map<string, number>();
  labels.forEach((l) => counts.set(norm(l), (counts.get(norm(l)) ?? 0) + 1));
  return labels.map((label) => {
    if (norm(label) === '') return `${name} must have a name.`;
    if (label.trim().length > ROOM_OPTION_MAX) {
      return `Use at most ${ROOM_OPTION_MAX} characters.`;
    }
    if ((counts.get(norm(label)) ?? 0) > 1)
      return `${name} "${label.trim()}" is already in the list.`;
    return undefined;
  });
}

export type RoomOptionErrors = Record<RoomOptionKind, (string | undefined)[]>;

export function validateRoomOptions(input: {
  features: readonly { id?: string; label: string }[];
  bedSizes: readonly { id?: string; label: string }[];
}): RoomOptionErrors {
  const check = (items: readonly { id?: string; label: string }[], kind: RoomOptionKind) => {
    const errors = validateOptionLabels(
      items.map((i) => i.label),
      kind,
    );
    // The same saved item twice in one request is a malformed request.
    return errors.map(
      (e, index) =>
        e ??
        (items[index].id !== undefined &&
        items.some((o, n) => n !== index && o.id === items[index].id)
          ? `${ROOM_OPTION_COPY[kind].singular} "${items[index].label.trim()}" is listed twice.`
          : undefined),
    );
  };
  return {
    features: check(input.features, 'features'),
    bedSizes: check(input.bedSizes, 'bedSizes'),
  };
}

export const hasOptionErrors = (errors: RoomOptionErrors): boolean =>
  [...errors.features, ...errors.bedSizes].some((e) => e !== undefined);

/** Trims the names; the stored name is what the lists show. */
export const normalizeLabel = (label: string): string => label.trim();

/** Whether the draft differs from the saved lists (order, names, additions, removals). */
export function isOptionsDirty(saved: RoomOptions, draft: RoomOptionsDraft): boolean {
  const same = (a: readonly LookupRef[], b: readonly RoomOptionDraft[]) =>
    a.length === b.length && a.every((x, i) => x.id === b[i].id && x.label === b[i].label.trim());
  return !same(saved.features, draft.features) || !same(saved.bedSizes, draft.bedSizes);
}

export interface OptionUsage {
  roomTypes: string[];
  rooms: string[];
}

/**
 * The Room Types and Rooms that use a Feature (it is ticked) or a Bed Size (a quantity above 0).
 * Inactive and ended ones count too: they still carry the item.
 */
export function optionUsage(
  kind: RoomOptionKind,
  id: string,
  roomTypes: readonly RoomTypeSetup[],
  rooms: readonly RoomSetup[],
): OptionUsage {
  const uses = (d: RoomTypeSetup['details']) =>
    kind === 'features' ? d.featureIds.includes(id) : (d.bedTypes[id] ?? 0) > 0;
  return {
    roomTypes: roomTypes.filter((t) => uses(t.details)).map((t) => t.name),
    rooms: rooms.filter((r) => uses(r.details)).map((r) => r.name),
  };
}

export type RemoveCheck = { kind: 'blocked'; message: string } | { kind: 'ok' };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Removing an item in use is refused, like deleting a Room Type that Rooms use. Legacy only asks
 * "Are you sure?" and leaves the check to its server; this build names what uses the item so the
 * admin knows what to change first (see entry 183).
 */
export function checkRemoveOption(label: string, usage: OptionUsage): RemoveCheck {
  const parts = [
    usage.roomTypes.length > 0 ? plural(usage.roomTypes.length, 'room type', 'room types') : '',
    usage.rooms.length > 0 ? plural(usage.rooms.length, 'room', 'rooms') : '',
  ].filter(Boolean);
  if (parts.length === 0) return { kind: 'ok' };
  const total = usage.roomTypes.length + usage.rooms.length;
  const names = [...usage.roomTypes, ...usage.rooms].slice(0, 3).join(', ');
  const more = total > 3 ? `, and ${total - 3} more` : '';
  return {
    kind: 'blocked',
    message: `${label} cannot be removed: it is used by ${parts.join(' and ')} (${names}${more}). Remove it from ${total === 1 ? 'that one' : 'those'} first.`,
  };
}

/** Ids of saved items that are no longer listed. */
export const removedIds = (
  saved: readonly LookupRef[],
  next: readonly RoomOptionInput[],
): string[] => saved.filter((s) => !next.some((n) => n.id === s.id)).map((s) => s.id);

/**
 * The draft after a successful save: ids and names from the answer, keys kept from the draft so no
 * field remounts. The server answers in the order sent.
 */
export function adoptSaved(draft: RoomOptionsDraft, stored: RoomOptions): RoomOptionsDraft {
  const adopt = (items: readonly RoomOptionDraft[], saved: readonly LookupRef[]) =>
    saved.map((s, i) => ({ key: items[i]?.key ?? s.id, id: s.id, label: s.label }));
  return {
    features: adopt(draft.features, stored.features),
    bedSizes: adopt(draft.bedSizes, stored.bedSizes),
  };
}

/**
 * Re-bases a draft on lists that changed elsewhere. `base` is what the draft started from, `latest`
 * what the server has now. The result follows `latest`; the admin's edits stay where the item
 * still exists: a changed name wins, a removal stays removed, new items are appended.
 */
export function rebaseDraft(
  base: RoomOptions,
  draft: RoomOptionsDraft,
  latest: RoomOptions,
): RoomOptionsDraft {
  const one = (
    was: readonly LookupRef[],
    mine: readonly RoomOptionDraft[],
    now: readonly LookupRef[],
  ): RoomOptionDraft[] => {
    const kept = now
      .filter((n) => !was.some((w) => w.id === n.id) || mine.some((m) => m.id === n.id))
      .map((n) => {
        const edited = mine.find((m) => m.id === n.id);
        const original = was.find((w) => w.id === n.id);
        const label =
          edited && original && edited.label !== original.label ? edited.label : n.label;
        return { key: edited?.key ?? n.id, id: n.id, label };
      });
    return [...kept, ...mine.filter((m) => m.id === undefined)];
  };
  return {
    features: one(base.features, draft.features, latest.features),
    bedSizes: one(base.bedSizes, draft.bedSizes, latest.bedSizes),
  };
}

/** Puts refused (in-use) saved items back into a draft at their saved position. */
export function restoreItems(
  draft: readonly RoomOptionDraft[],
  saved: readonly LookupRef[],
  ids: readonly string[],
): RoomOptionDraft[] {
  const out = [...draft];
  saved.forEach((s, index) => {
    if (ids.includes(s.id) && !out.some((d) => d.id === s.id)) {
      out.splice(Math.min(index, out.length), 0, { key: s.id, id: s.id, label: s.label });
    }
  });
  return out;
}

/** Feature and bed size ids of room details that are not in the current lists. */
export function unknownOptionIds(
  details: { featureIds: readonly string[]; bedTypes: Record<string, number> },
  options: { features: readonly LookupRef[]; bedSizes: readonly LookupRef[] },
): { features: string[]; bedSizes: string[] } {
  return {
    features: details.featureIds.filter((id) => !options.features.some((f) => f.id === id)),
    bedSizes: Object.keys(details.bedTypes).filter(
      (id) => !options.bedSizes.some((b) => b.id === id),
    ),
  };
}
