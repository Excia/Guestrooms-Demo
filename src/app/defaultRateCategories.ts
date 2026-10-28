// Business rules of the Default Rate Categories tab (ticket 189; legacy DefaultRateCategoriesEdit.vue).
// Pure functions; the tab and the mock only call them.
import type { DefaultRateCategories, MemberTypeRateOverride } from '../api/types';

export const emptyDefaultRateCategories = (): DefaultRateCategories => ({
  roomBlock: null,
  member: null,
  nonMember: null,
  owner: null,
  memberTypeOverrides: [],
});

/** The four fixed rows, in legacy order; `hint` is the italic line legacy shows under the label. */
export const DEFAULT_RATE_ROWS = [
  {
    key: 'roomBlock',
    label: 'Room Block Rate Category',
    hint: 'default selection on creation of room block',
  },
  { key: 'member', label: 'Members', hint: null },
  { key: 'nonMember', label: 'Non-Members', hint: null },
  { key: 'owner', label: 'Owners', hint: 'applied when the occupant owns the room' },
] as const;

export type DefaultRateKey = (typeof DEFAULT_RATE_ROWS)[number]['key'];

export const newMemberTypeOverride = (id: string): MemberTypeRateOverride => ({
  id,
  memberTypeId: null,
  rateCategoryId: null,
});

/**
 * An id for a new row that no existing row uses, whatever ids the backend made for saved rows
 * (derived from the rows, so it stays unique across tab switches and saves).
 */
export function nextOverrideId(value: DefaultRateCategories): string {
  const used = new Set(value.memberTypeOverrides.map((o) => o.id));
  let n = value.memberTypeOverrides.length + 1;
  while (used.has(`override-new-${n}`)) n += 1;
  return `override-new-${n}`;
}

export const addMemberTypeOverride = (
  value: DefaultRateCategories,
  id: string = nextOverrideId(value),
): DefaultRateCategories => ({
  ...value,
  memberTypeOverrides: [...value.memberTypeOverrides, newMemberTypeOverride(id)],
});

export const updateMemberTypeOverride = (
  value: DefaultRateCategories,
  id: string,
  patch: Partial<Omit<MemberTypeRateOverride, 'id'>>,
): DefaultRateCategories => ({
  ...value,
  memberTypeOverrides: value.memberTypeOverrides.map((o) => (o.id === id ? { ...o, ...patch } : o)),
});

export const removeMemberTypeOverride = (
  value: DefaultRateCategories,
  id: string,
): DefaultRateCategories => ({
  ...value,
  memberTypeOverrides: value.memberTypeOverrides.filter((o) => o.id !== id),
});

export const overrideFieldKey = (id: string, part: 'memberTypeId' | 'rateCategoryId') =>
  `defaultRateCategories.override.${id}.${part}` as const;

export const DEFAULT_RATE_MESSAGES = {
  memberType: 'Choose a member type.',
  rateCategory: 'Choose a rate category.',
  duplicate: 'This member type already has an override.',
} as const;

export const STALE_CATEGORY_MESSAGE = 'This rate category no longer exists. Choose another.';
export const STALE_MEMBER_TYPE_MESSAGE = 'This member type no longer exists. Choose another.';

/** The choices that exist now; a saved id missing from them was deleted since. */
export interface KnownChoices {
  rateCategoryIds: ReadonlySet<string>;
  memberTypeIds: ReadonlySet<string>;
}

/**
 * Rules that stop a save: every override needs a member type and a rate category, and a member
 * type can have only one override. Legacy checks nothing (an empty row would save as id 0).
 * With `known`, a choice naming a rate category or member type that no longer exists is refused
 * too, so the user must choose another instead of hitting a failure on save.
 * Keys are field keys (`defaultRateCategories.<key>` for the fixed rows, `overrideFieldKey` for
 * overrides) with one message each, inserted in page order: fixed rows, then each override's
 * member type, then its rate category.
 */
export function validateDefaultRateCategories(
  value: DefaultRateCategories,
  known?: KnownChoices,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (known) {
    for (const row of DEFAULT_RATE_ROWS) {
      const id = value[row.key];
      if (id && !known.rateCategoryIds.has(id)) {
        errors[`defaultRateCategories.${row.key}`] = STALE_CATEGORY_MESSAGE;
      }
    }
  }
  const seen = new Set<string>();
  for (const o of value.memberTypeOverrides) {
    const typeKey = overrideFieldKey(o.id, 'memberTypeId');
    if (!o.memberTypeId) errors[typeKey] = DEFAULT_RATE_MESSAGES.memberType;
    else if (known && !known.memberTypeIds.has(o.memberTypeId)) {
      errors[typeKey] = STALE_MEMBER_TYPE_MESSAGE;
    } else if (seen.has(o.memberTypeId)) errors[typeKey] = DEFAULT_RATE_MESSAGES.duplicate;
    else seen.add(o.memberTypeId);
    const categoryKey = overrideFieldKey(o.id, 'rateCategoryId');
    if (!o.rateCategoryId) errors[categoryKey] = DEFAULT_RATE_MESSAGES.rateCategory;
    else if (known && !known.rateCategoryIds.has(o.rateCategoryId)) {
      errors[categoryKey] = STALE_CATEGORY_MESSAGE;
    }
  }
  return errors;
}
