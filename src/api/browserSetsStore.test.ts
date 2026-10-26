import { browserSetsStore, MOCK_PERMISSION_SETS_KEY } from './index';
import { mockPermissionSets } from './permissionSetsData';

describe('browser permission sets store (dev mock)', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the sets under a version', () => {
    const store = browserSetsStore();
    store.save(mockPermissionSets());
    expect(JSON.parse(localStorage.getItem(MOCK_PERMISSION_SETS_KEY) as string).version).toBe(2);
    expect(store.load()).toEqual(mockPermissionSets());
  });

  it('drops sets stored by the first version of the page (a bare array) and junk', () => {
    localStorage.setItem(MOCK_PERMISSION_SETS_KEY, JSON.stringify(mockPermissionSets()));
    expect(browserSetsStore().load()).toBeNull();
    localStorage.setItem(MOCK_PERMISSION_SETS_KEY, '{not json');
    expect(browserSetsStore().load()).toBeNull();
    localStorage.setItem(MOCK_PERMISSION_SETS_KEY, JSON.stringify({ version: 2, sets: [{}] }));
    expect(browserSetsStore().load()).toBeNull();
  });
});
