import { mockPermissionSets } from '../api/permissionSetsData';
import { ADMIN_PAGE_IDS, createPermissions, type Permission } from './permissions';
import {
  clampLevel,
  grantFromSet,
  levelsFor,
  normalizeSet,
  parseStoredSets,
  PERMISSION_ROWS,
  rowApplies,
  setsDirty,
  summarizeSets,
  updateSet,
  validateSets,
  withAccessLevel,
  withCheckIn,
  withFunction,
  withSetupLevel,
  type PermissionSet,
} from './permissionSets';
import { adminPageLevel } from './access';

const [management, staff] = mockPermissionSets() as [PermissionSet, PermissionSet];
const canOf = (set: PermissionSet) => createPermissions(grantFromSet(set) as Permission[]).can;

describe('clampLevel', () => {
  it('keeps an offered level', () => {
    expect(clampLevel('reporting', 'edit')).toBe('edit');
  });
  it('falls back to the best offered level not above the asked one', () => {
    expect(clampLevel('reporting', 'view')).toBe('none');
    expect(clampLevel('folio', 'create-edit')).toBe('edit');
  });
  it('treats junk as none', () => {
    expect(clampLevel('closures', 'root')).toBe('none');
    expect(clampLevel('closures', 7)).toBe('none');
  });
  it('offers the legacy level lists', () => {
    expect(levelsFor('closures')).toEqual(['create-edit', 'edit', 'view', 'none']);
    expect(levelsFor('reporting')).toEqual(['edit', 'none']);
  });
});

describe('normalizeSet', () => {
  it('has a level for every admin page and fails closed for missing ones', () => {
    const set = normalizeSet({ ...staff, setup: { rooms: 'edit', junk: 'edit' } });
    expect(Object.keys(set.setup).sort()).toEqual([...ADMIN_PAGE_IDS, 'junk'].sort());
    expect(set.setup.rooms).toBe('edit');
    expect(set.setup.locations).toBe('none');
  });
  it('keeps the page keys of a newer backend, with valid levels only', () => {
    const set = normalizeSet({ ...staff, setup: { 'api-keys': 'view', bad: 'root' as never } });
    expect(set.setup['api-keys']).toBe('view');
    expect(set.setup.bad).toBeUndefined();
  });
  it('turns off functions and check in whose area is No Access', () => {
    const set = normalizeSet({
      ...management,
      access: { ...management.access, reservations: 'none', folio: 'none' },
    });
    expect(set.checkIn).toBe('never');
    expect(set.functions.undoCheckIn).toBe(false);
    expect(set.functions.splitFolio).toBe(false);
    expect(set.functions.viewPrivateNotes).toBe(true);
  });
  it('is idempotent', () => {
    expect(normalizeSet(normalizeSet(management))).toEqual(normalizeSet(management));
  });
});

describe('rowApplies', () => {
  it('access rows always apply; function rows follow their area', () => {
    const none = withAccessLevel(management, 'reporting', 'none');
    const rows = PERMISSION_ROWS.filter((r) => r.kind !== 'access' && r.parent === 'reporting');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(rowApplies(none, row)).toBe(false);
      expect(rowApplies(management, row)).toBe(true);
    }
  });
});

describe('grantFromSet', () => {
  it('Staff keeps what the earlier non-admin mock user had, and no setup page', () => {
    const can = canOf(staff);
    expect(can('page.schedule')).toBe(true);
    expect(can('page.reporting')).toBe(true);
    expect(can('page.night-audit-history')).toBe(true);
    expect(can('reservation.edit')).toBe(true);
    expect(can('reservation.check-in.arrival-date')).toBe(true);
    expect(can('reservation.check-in.any-time')).toBe(false);
    expect(can('night-audit.run')).toBe(false);
    for (const id of ADMIN_PAGE_IDS) expect(can(`page.${id}`)).toBe(false);
  });
  it('View gives the page, Edit adds <id>.edit', () => {
    let set = withSetupLevel(staff, 'rooms', 'view');
    set = withSetupLevel(set, 'locations', 'edit');
    const can = canOf(set);
    expect(can('page.rooms')).toBe(true);
    expect(can('rooms.edit')).toBe(false);
    expect(can('page.locations')).toBe(true);
    expect(can('locations.edit')).toBe(true);
    expect(adminPageLevel(can, 'rooms')).toBe('view');
    expect(adminPageLevel(can, 'locations')).toBe('edit');
    expect(adminPageLevel(can, 'room-types')).toBe('none');
  });
  it('Night Audit Edit adds running the audit on top of the history', () => {
    expect(canOf(withAccessLevel(staff, 'nightAudit', 'edit'))('night-audit.run')).toBe(true);
    expect(canOf(withAccessLevel(staff, 'nightAudit', 'edit'))('page.night-audit-history')).toBe(
      true,
    );
    expect(canOf(withAccessLevel(staff, 'nightAudit', 'view'))('night-audit.run')).toBe(false);
    expect(canOf(withAccessLevel(staff, 'nightAudit', 'none'))('page.night-audit-history')).toBe(
      false,
    );
  });
  it('reservations View is read-only; none removes the pages and check in', () => {
    const view = canOf(withAccessLevel(staff, 'reservations', 'view'));
    expect(view('page.reservations')).toBe(true);
    expect(view('reservation.edit')).toBe(false);
    const none = canOf(withAccessLevel(staff, 'reservations', 'none'));
    expect(none('page.schedule')).toBe(false);
    expect(none('reservation.check-in.arrival-date')).toBe(false);
  });
  it('a View reservation set cannot check in or change anything (legacy)', () => {
    const view = withAccessLevel(management, 'reservations', 'view');
    expect(view.checkIn).toBe('never');
    expect(view.functions.undoCheckIn).toBe(false);
    expect(view.functions.adjustRoomRate).toBe(false);
    // Even a stored any-time / arrival-date with View grants nothing.
    const forced = {
      ...view,
      checkIn: 'any-time' as const,
      functions: { ...view.functions, undoCheckIn: true },
    };
    const can = canOf(forced);
    expect(can('reservation.check-in.any-time')).toBe(false);
    expect(can('reservation.check-in.arrival-date')).toBe(false);
    expect(can('function.undoCheckIn')).toBe(false);
    expect(can('reservation.edit')).toBe(false);
    expect(can('page.reservations')).toBe(true);
  });
  it('switching Reservation Events back to Edit switches the reservation functions on again (legacy)', () => {
    const view = withAccessLevel(staff, 'reservations', 'view');
    const back = withAccessLevel(view, 'reservations', 'edit');
    expect(back.checkIn).toBe('any-time');
    expect(back.functions.changeReservationRoom).toBe(true);
    expect(back.functions.checkOutReservation).toBe(true);
  });
  it('the editor remembers hidden values of other areas, but what is saved is off', () => {
    const none = updateSet([management], 'management', (s) =>
      withAccessLevel(s, 'folio', 'none'),
    )[0] as PermissionSet;
    expect(none.functions.splitFolio).toBe(true);
    expect(normalizeSet(none).functions.splitFolio).toBe(false);
    const back = updateSet([none], 'management', (s) =>
      withAccessLevel(s, 'folio', 'edit'),
    )[0] as PermissionSet;
    expect(back.functions.splitFolio).toBe(true);
  });
  it('check in follows the setting', () => {
    expect(canOf(withCheckIn(management, 'any-time'))('reservation.check-in.any-time')).toBe(true);
    expect(canOf(withCheckIn(management, 'never'))('reservation.check-in.any-time')).toBe(false);
  });
  it('a function grants function.<key> only while it is on and applies', () => {
    expect(canOf(management)('function.undoCheckIn')).toBe(true);
    expect(canOf(withFunction(management, 'undoCheckIn', false))('function.undoCheckIn')).toBe(
      false,
    );
    expect(canOf(staff)('function.splitFolio')).toBe(false);
  });
  it('everyone sees the dashboard', () => {
    expect(
      canOf(normalizeSet({ ...staff, access: { ...staff.access, reservations: 'none' } }))(
        'page.dashboard',
      ),
    ).toBe(true);
  });
  it('only returns known permissions', () => {
    const all = createPermissions();
    for (const p of grantFromSet(management)) expect(all.can(p as Permission)).toBe(true);
  });
});

describe('editing helpers', () => {
  it('updateSet changes only the named set and re-normalizes', () => {
    const next = updateSet([management, staff], 'staff', (s) =>
      withAccessLevel(s, 'folio', 'none'),
    );
    expect(next[0]).toBe(management);
    expect(next[1]?.access.folio).toBe('none');
  });
  it('setsDirty compares normalized values', () => {
    expect(setsDirty([management, staff], [management, staff])).toBe(false);
    expect(
      setsDirty([management, staff], [management, withFunction(staff, 'splitFolio', true)]),
    ).toBe(true);
  });
});

describe('validateSets and summarizeSets', () => {
  it('refuses duplicates, nameless sets and the Administrator set', () => {
    expect(validateSets([management, staff])).toEqual([]);
    expect(validateSets([management, staff, management])).toHaveLength(1);
    expect(validateSets([management, { ...staff, name: ' ' }])).toHaveLength(1);
    expect(validateSets([management, staff, { ...staff, id: 'admin' }])).toHaveLength(1);
  });
  it('lists the Administrator first, not editable', () => {
    expect(summarizeSets([management, staff])).toEqual([
      { id: 'admin', name: 'Administrator', editable: false },
      { id: 'management', name: 'Management', editable: true },
      { id: 'staff', name: 'Staff', editable: true },
    ]);
  });
});

describe('parseStoredSets', () => {
  it('accepts a full, well formed list and normalizes it', () => {
    expect(parseStoredSets([management, staff])).toEqual([management, staff]);
  });
  it('falls back (null) for junk, a missing required set or a malformed set', () => {
    expect(parseStoredSets(null)).toBeNull();
    expect(parseStoredSets('x')).toBeNull();
    expect(parseStoredSets([management])).toBeNull();
    expect(parseStoredSets([management, staff, { ...staff, id: 'admin' }])).toBeNull();
    expect(parseStoredSets([management, { id: 'staff' }])).toBeNull();
    expect(parseStoredSets([management, { ...staff, access: 'all' }])).toBeNull();
  });
  it('a save must include both required sets', () => {
    expect(validateSets([management])).toHaveLength(1);
  });
});
