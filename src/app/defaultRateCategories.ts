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

export const addMemberTypeOverride = (
  value: DefaultRateCategories,
  id: string,
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

/**
 * Rules that stop a save: every override needs a member type and a rate category, and a member
 * type can have only one override. Legacy checks nothing (an empty row would save as id 0).
 * Keys are field keys (`overrideFieldKey`) with one message each.
 */
export function validateDefaultRateCategories(
  value: DefaultRateCategories,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  for (const o of value.memberTypeOverrides) {
    const typeKey = overrideFieldKey(o.id, 'memberTypeId');
    if (!o.memberTypeId) errors[typeKey] = DEFAULT_RATE_MESSAGES.memberType;
    else if (seen.has(o.memberTypeId)) errors[typeKey] = DEFAULT_RATE_MESSAGES.duplicate;
    else seen.add(o.memberTypeId);
    if (!o.rateCategoryId) {
      errors[overrideFieldKey(o.id, 'rateCategoryId')] = DEFAULT_RATE_MESSAGES.rateCategory;
    }
  }
  return errors;
}

/** Every rate category id the value names (for the backend check that they still exist). */
export function referencedRateCategoryIds(value: DefaultRateCategories): string[] {
  const ids = [value.roomBlock, value.member, value.nonMember, value.owner];
  for (const o of value.memberTypeOverrides) ids.push(o.rateCategoryId);
  return ids.filter((id): id is string => Boolean(id));
}
