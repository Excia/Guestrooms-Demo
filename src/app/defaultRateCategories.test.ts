import type { DefaultRateCategories } from '../api/types';
import {
  addMemberTypeOverride,
  emptyDefaultRateCategories,
  nextOverrideId,
  overrideFieldKey,
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

describe('nextOverrideId', () => {
  it('never repeats an id in use, including ones the backend made', () => {
    let v = base();
    const seen = new Set<string>();
    for (let i = 0; i < 4; i += 1) {
      v = addMemberTypeOverride(v);
      const id = v.memberTypeOverrides[v.memberTypeOverrides.length - 1].id;
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      if (i === 1) v = removeMemberTypeOverride(v, v.memberTypeOverrides[0].id);
    }
    const withBackend: DefaultRateCategories = {
      ...base(),
      memberTypeOverrides: [
        { id: 'override-new-2', memberTypeId: 'full', rateCategoryId: 'rc-a' },
        { id: '7', memberTypeId: 'social', rateCategoryId: 'rc-a' },
      ],
    };
    expect(nextOverrideId(withBackend)).toBe('override-new-3');
  });
});

describe('validateDefaultRateCategories with known choices', () => {
  const known = {
    rateCategoryIds: new Set(['rc-a', 'rc-b']),
    memberTypeIds: new Set(['full', 'social']),
  };

  it('flags deleted rate categories and member types, and lists errors in page order', () => {
    const v: DefaultRateCategories = {
      roomBlock: null,
      member: 'rc-gone',
      nonMember: 'rc-a',
      owner: 'rc-gone',
      memberTypeOverrides: [
        { id: '1', memberTypeId: 'full', rateCategoryId: 'rc-gone' },
        { id: '2', memberTypeId: null, rateCategoryId: 'rc-a' },
        { id: '3', memberTypeId: 'full', rateCategoryId: 'rc-a' },
        { id: '4', memberTypeId: 'gone', rateCategoryId: null },
      ],
    };
    const errors = validateDefaultRateCategories(v, known);
    expect(Object.keys(errors)).toEqual([
      'defaultRateCategories.member',
      'defaultRateCategories.owner',
      overrideFieldKey('1', 'rateCategoryId'),
      overrideFieldKey('2', 'memberTypeId'),
      overrideFieldKey('3', 'memberTypeId'),
      overrideFieldKey('4', 'memberTypeId'),
      overrideFieldKey('4', 'rateCategoryId'),
    ]);
    expect(errors[overrideFieldKey('3', 'memberTypeId')]).toMatch(/already has an override/);
    expect(errors[overrideFieldKey('4', 'memberTypeId')]).toMatch(/member type no longer exists/);
  });

  it('checks existence only when the choices are known', () => {
    const v = { ...base(), member: 'anything' };
    expect(validateDefaultRateCategories(v)).toEqual({});
    expect(validateDefaultRateCategories(v, known)).toHaveProperty('defaultRateCategories.member');
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
