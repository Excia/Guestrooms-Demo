import { permissionsFromGrant } from './grant';

describe('permissionsFromGrant', () => {
  it("allows everything only for 'all'", () => {
    expect(permissionsFromGrant({ role: 'x', permissions: 'all' }).can('page.dashboard')).toBe(
      true,
    );
  });
  it('allows exactly the listed permissions', () => {
    const p = permissionsFromGrant({ role: 'x', permissions: ['page.dashboard'] });
    expect(p.can('page.dashboard')).toBe(true);
    expect(p.can('page.reporting')).toBe(false);
  });
  it('denies everything for an empty list', () => {
    expect(permissionsFromGrant({ role: 'x', permissions: [] }).can('page.dashboard')).toBe(false);
  });
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty object', {}],
    ['a string', 'all'],
    ['a missing permissions field', { role: 'x' }],
    ['permissions null', { role: 'x', permissions: null }],
    ['permissions a non-"all" string', { role: 'x', permissions: 'ALL' }],
    ['permissions an object', { role: 'x', permissions: { 'page.dashboard': true } }],
  ])('denies everything for %s', (_label, grant) => {
    expect(permissionsFromGrant(grant).can('page.dashboard')).toBe(false);
  });
  it('drops permission strings the app does not know', () => {
    const p = permissionsFromGrant({ role: 'x', permissions: ['page.dashboard', 'page.bogus'] });
    expect(p.can('page.dashboard')).toBe(true);
    expect(p.can('page.bogus' as never)).toBe(false);
  });
  it('ignores a malformed role and non-string entries', () => {
    const p = permissionsFromGrant({ role: 42, permissions: ['page.dashboard', 7, null] });
    expect(p.can('page.dashboard')).toBe(true);
    expect(p.can('page.reporting')).toBe(false);
  });
});
