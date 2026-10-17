import { isAllLocations, normalizeSelection, toggleLocation } from './locationSelection';

describe('location selection', () => {
  it('toggles a location on and off', () => {
    expect(toggleLocation([], 'a')).toEqual(['a']);
    expect(toggleLocation(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('All Locations clears the selection', () => {
    expect(toggleLocation(['a', 'b'], null)).toEqual([]);
  });

  it('drops unknown ids and follows the list order', () => {
    expect(normalizeSelection(['b', 'x', 'a'], ['a', 'b', 'c'])).toEqual(['a', 'b']);
  });

  it('treats none or every location as all', () => {
    expect(isAllLocations([], ['a', 'b'])).toBe(true);
    expect(isAllLocations(['b', 'a'], ['a', 'b'])).toBe(true);
    expect(isAllLocations(['a'], ['a', 'b'])).toBe(false);
  });
});
