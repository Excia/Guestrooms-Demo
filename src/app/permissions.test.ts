import {
  ALL_PERMISSIONS,
  checkInLevel,
  CHECK_IN_ANY_TIME_PERMISSION,
  CHECK_IN_ARRIVAL_DATE_PERMISSION,
  createPermissions,
  isKnownPermission,
} from './permissions';

describe('checkInLevel (ticket 163)', () => {
  it('holding the "any time" grant is the highest level, also when the arrival grant is held too', () => {
    expect(checkInLevel(createPermissions([CHECK_IN_ANY_TIME_PERMISSION]).can)).toBe('any-time');
    expect(
      checkInLevel(
        createPermissions([CHECK_IN_ARRIVAL_DATE_PERMISSION, CHECK_IN_ANY_TIME_PERMISSION]).can,
      ),
    ).toBe('any-time');
  });
  it('the arrival grant alone is "arrival date only"', () => {
    expect(checkInLevel(createPermissions([CHECK_IN_ARRIVAL_DATE_PERMISSION]).can)).toBe(
      'arrival-date-only',
    );
  });
  it('holding neither is "never"; so is a user with no permissions at all', () => {
    expect(checkInLevel(createPermissions(['reservation.edit']).can)).toBe('never');
    expect(checkInLevel(createPermissions([]).can)).toBe('never');
  });
  it('an unrestricted user has the highest level', () => {
    expect(checkInLevel(createPermissions().can)).toBe('any-time');
  });
  it('both grants are in the registry; ids that are not fail closed', () => {
    expect(ALL_PERMISSIONS).toContain(CHECK_IN_ANY_TIME_PERMISSION);
    expect(ALL_PERMISSIONS).toContain(CHECK_IN_ARRIVAL_DATE_PERMISSION);
    expect(isKnownPermission('reservation.check-in.sometimes')).toBe(false);
  });
});
