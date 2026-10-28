import type { DefaultRateCategories } from '../api/types';
import {
  addMemberTypeOverride,
  emptyDefaultRateCategories,
  overrideFieldKey,
  referencedRateCategoryIds,
  removeMemberTypeOverride,
  updateMemberTypeOverride,
  validateDefaultRateCategories,
} from './defaultRateCategories';

const base = (): DefaultRateCategories => ({
  ...emptyDefaultRateCategories(),
  member: 'rc-a',
  owner: 'rc-b',
});

describe('member type overrides', () => {
  it('adds an empty row, edits it and removes it without touching the rest', () => {
    const added = addMemberTypeOverride(base(), 'o1');
    expect(added.memberTypeOverrides).toEqual([
      { id: 'o1', memberTypeId: null, rateCategoryId: null },
    ]);
    const edited = updateMemberTypeOverride(added, 'o1', { memberTypeId: 'full' });
    expect(edited.memberTypeOverrides[0]).toMatchObject({ memberTypeId: 'full' });
    expect(edited.member).toBe('rc-a');
    expect(removeMemberTypeOverride(edited, 'o1').memberTypeOverrides).toEqual([]);
    expect(added).not.toBe(base());
  });
});

describe('validateDefaultRateCategories', () => {
  it('accepts no overrides and leaves the four defaults optional', () => {
    expect(validateDefaultRateCategories(emptyDefaultRateCategories())).toEqual({});
  });

  it('requires a member type and a rate category on every override', () => {
    const v = addMemberTypeOverride(base(), 'o1');
    expect(validateDefaultRateCategories(v)).toEqual({
      [overrideFieldKey('o1', 'memberTypeId')]: 'Choose a member type.',
      [overrideFieldKey('o1', 'rateCategoryId')]: 'Choose a rate category.',
    });
  });

  it('refuses a second override for the same member type', () => {
    let v = addMemberTypeOverride(base(), 'o1');
    v = addMemberTypeOverride(v, 'o2');
    v = updateMemberTypeOverride(v, 'o1', { memberTypeId: 'full', rateCategoryId: 'rc-a' });
    v = updateMemberTypeOverride(v, 'o2', { memberTypeId: 'full', rateCategoryId: 'rc-b' });
    expect(validateDefaultRateCategories(v)).toEqual({
      [overrideFieldKey('o2', 'memberTypeId')]: 'This member type already has an override.',
    });
  });
});

describe('referencedRateCategoryIds', () => {
  it('lists the defaults and the overrides, skipping empty ones', () => {
    let v = addMemberTypeOverride(base(), 'o1');
    v = updateMemberTypeOverride(v, 'o1', { rateCategoryId: 'rc-c' });
    v = addMemberTypeOverride(v, 'o2');
    expect(referencedRateCategoryIds(v)).toEqual(['rc-a', 'rc-b', 'rc-c']);
  });
});
