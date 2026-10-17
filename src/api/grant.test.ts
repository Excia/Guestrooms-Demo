import { permissionsFromGrant } from './grant';

describe('permissionsFromGrant', () => {
  it('allows everything for an unrestricted grant', () => {
    expect(permissionsFromGrant({ role: 'x', permissions: 'all' }).can('page.dashboard')).toBe(
      true,
    );
  });
  it('allows only listed permissions', () => {
    const p = permissionsFromGrant({ role: 'x', permissions: ['page.dashboard'] });
    expect(p.can('page.dashboard')).toBe(true);
    expect(p.can('page.reporting')).toBe(false);
  });
  it('denies everything for an empty list', () => {
    expect(permissionsFromGrant({ role: 'x', permissions: [] }).can('page.dashboard')).toBe(false);
  });
});
