import type { LocationInput } from '../api/types';
import {
  blankLocation,
  canRemoveRow,
  checkRemoveLocation,
  firstLocationError,
  LOCATION_NAME_MAX,
  locationsDirty,
  normalizeLocations,
  showLocations,
  validateLocations,
} from './locations';

const area = { id: 'area-1', label: 'Rooms' };
const row = (id: string, name: string, a: typeof area | null = area): LocationInput => ({
  id,
  name,
  area: a,
});

describe('showLocations (the single-location rule)', () => {
  it('hides location controls for none or one location, shows them for two or more', () => {
    expect(showLocations([])).toBe(false);
    expect(showLocations([{}])).toBe(false);
    expect(showLocations([{}, {}])).toBe(true);
    expect(showLocations(0)).toBe(false);
    expect(showLocations(1)).toBe(false);
    expect(showLocations(3)).toBe(true);
  });
});

describe('validateLocations', () => {
  it('accepts a named location with an area', () => {
    expect(validateLocations([row('a', 'Main Clubhouse')])).toEqual({});
  });

  it('requires a name and an area, with separate messages', () => {
    expect(validateLocations([row('a', '  ', null)])).toEqual({
      a: { name: 'Enter a location name.', area: 'Select an area.' },
    });
  });

  it('limits the name to 50 characters', () => {
    expect(validateLocations([row('a', 'x'.repeat(LOCATION_NAME_MAX))])).toEqual({});
    expect(validateLocations([row('a', 'x'.repeat(LOCATION_NAME_MAX + 1))]).a?.name).toMatch(
      /at most 50/,
    );
  });

  it('flags the second of two locations with the same name, ignoring case and spaces', () => {
    const errors = validateLocations([row('a', 'Lodge'), row('b', ' lodge ')]);
    expect(errors.a).toBeUndefined();
    expect(errors.b?.name).toMatch(/already has this name/);
  });
});

describe('firstLocationError', () => {
  it('returns the first row with a problem, name before area', () => {
    const rows = [row('a', 'Ok'), row('b', '', null), row('c', '', null)];
    expect(firstLocationError(rows, validateLocations(rows))).toEqual({ id: 'b', field: 'name' });
    const areaOnly = [row('a', 'Ok', null)];
    expect(firstLocationError(areaOnly, validateLocations(areaOnly))).toEqual({
      id: 'a',
      field: 'area',
    });
    expect(firstLocationError([row('a', 'Ok')], {})).toBeNull();
  });
});

describe('normalizeLocations', () => {
  it('trims names', () => {
    expect(normalizeLocations([row('a', '  Lodge ')])[0].name).toBe('Lodge');
  });
});

describe('locationsDirty', () => {
  const saved = [row('a', 'Lodge'), row('b', 'Cottages')];

  it('is clean for the saved rows and for a new club with its blank row', () => {
    expect(locationsDirty(saved, structuredClone(saved))).toBe(false);
    expect(locationsDirty([], [blankLocation('x')])).toBe(false);
  });

  it('is dirty after a rename, an area change, an added or a removed row', () => {
    expect(locationsDirty(saved, [row('a', 'Lodge 2'), saved[1]])).toBe(true);
    expect(locationsDirty(saved, [row('a', 'Lodge', { id: 'area-2', label: 'F&B' }), saved[1]])).toBe(
      true,
    );
    expect(locationsDirty(saved, [...saved, row('c', 'New')])).toBe(true);
    expect(locationsDirty(saved, [saved[0]])).toBe(true);
  });

  it('ignores a blank row added and left empty, and trailing spaces', () => {
    expect(locationsDirty(saved, [...saved, blankLocation('x')])).toBe(false);
    expect(locationsDirty(saved, [row('a', 'Lodge '), saved[1]])).toBe(false);
  });
});

describe('checkRemoveLocation', () => {
  it('allows removing an unused location', () => {
    expect(checkRemoveLocation({ roomTypes: [], roomCount: 0 })).toMatchObject({ allowed: true });
  });

  it('blocks a location used by room types and names the counts', () => {
    const check = checkRemoveLocation({ roomTypes: ['King Room'], roomCount: 3 });
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe(
      'This location is used by 1 room type and 3 rooms. Move or remove them before removing the location.',
    );
    expect(check.roomTypes).toEqual(['King Room']);
  });

  it('blocks a location used only by rooms', () => {
    expect(checkRemoveLocation({ roomTypes: [], roomCount: 1 }).reason).toMatch(/used by 1 room\. /);
  });
});

describe('canRemoveRow', () => {
  it('keeps the last row', () => {
    expect(canRemoveRow(1)).toBe(false);
    expect(canRemoveRow(2)).toBe(true);
  });
});
