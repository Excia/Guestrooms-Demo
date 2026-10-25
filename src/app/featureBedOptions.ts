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

export const toRequest = (draft: RoomOptionsDraft, requestId: string): SaveRoomOptionsRequest => ({
  requestId,
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
  features: readonly { label: string }[];
  bedSizes: readonly { label: string }[];
}): RoomOptionErrors {
  return {
    features: validateOptionLabels(
      input.features.map((i) => i.label),
      'features',
    ),
    bedSizes: validateOptionLabels(
      input.bedSizes.map((i) => i.label),
      'bedSizes',
    ),
  };
}

export const hasOptionErrors = (errors: RoomOptionErrors): boolean =>
  [...errors.features, ...errors.bedSizes].some((e) => e !== undefined);

/** Trims the names; the stored name is what the lists show. */
export const normalizeLabel = (label: string): string => label.trim();

/** Whether the draft differs from the saved lists (order, names, additions, removals). */
export function isOptionsDirty(saved: RoomOptions, draft: RoomOptionsDraft): boolean {
  const same = (a: readonly LookupRef[], b: readonly RoomOptionDraft[]) =>
    a.length === b.length && a.every((x, i) => x.id === b[i].id && x.label === b[i].label);
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
