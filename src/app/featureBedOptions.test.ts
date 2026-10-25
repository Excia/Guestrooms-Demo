import { MOCK_ROOM_OPTIONS } from '../api/roomOptionsData';
import { mockRoomTypes, mockRooms } from '../api/roomSetupData';
import {
  checkRemoveOption,
  draftFromOptions,
  hasOptionErrors,
  isOptionsDirty,
  optionUsage,
  removedIds,
  ROOM_OPTION_MAX,
  toRequest,
  validateOptionLabels,
  validateRoomOptions,
} from './featureBedOptions';

describe('validateOptionLabels', () => {
  it('accepts distinct names', () => {
    expect(validateOptionLabels(['Balcony', 'Fireplace'], 'features')).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('requires a name, ignoring spaces', () => {
    expect(validateOptionLabels(['', '   '], 'features')).toEqual([
      'Feature must have a name.',
      'Feature must have a name.',
    ]);
    expect(validateOptionLabels([''], 'bedSizes')).toEqual(['Bed Size must have a name.']);
  });

  it('allows exactly 50 characters and refuses 51', () => {
    expect(validateOptionLabels(['a'.repeat(ROOM_OPTION_MAX)], 'features')).toEqual([undefined]);
    expect(validateOptionLabels(['a'.repeat(ROOM_OPTION_MAX + 1)], 'features')[0]).toMatch(
      /at most 50/,
    );
  });

  it('refuses duplicates regardless of case and surrounding spaces, on every copy', () => {
    const result = validateOptionLabels(['King', ' king ', 'Queen'], 'bedSizes');
    expect(result[0]).toMatch(/already in the list/);
    expect(result[1]).toMatch(/already in the list/);
    expect(result[2]).toBeUndefined();
  });
});

describe('validateRoomOptions', () => {
  it('checks each list on its own: the same name in both lists is fine', () => {
    const errors = validateRoomOptions({
      features: [{ label: 'Queen' }],
      bedSizes: [{ label: 'Queen' }],
    });
    expect(hasOptionErrors(errors)).toBe(false);
  });

  it('reports errors of either list', () => {
    expect(hasOptionErrors(validateRoomOptions({ features: [], bedSizes: [{ label: '' }] }))).toBe(
      true,
    );
  });
});

describe('draft helpers', () => {
  it('round-trips the saved lists and detects edits, removals, additions and reordering', () => {
    const draft = draftFromOptions(MOCK_ROOM_OPTIONS);
    expect(isOptionsDirty(MOCK_ROOM_OPTIONS, draft)).toBe(false);
    expect(
      isOptionsDirty(MOCK_ROOM_OPTIONS, {
        ...draft,
        features: [{ ...draft.features[0], label: 'Fridge' }, ...draft.features.slice(1)],
      }),
    ).toBe(true);
    expect(isOptionsDirty(MOCK_ROOM_OPTIONS, { ...draft, bedSizes: draft.bedSizes.slice(1) })).toBe(
      true,
    );
    expect(
      isOptionsDirty(MOCK_ROOM_OPTIONS, {
        ...draft,
        features: [...draft.features, { key: 'k', label: 'New' }],
      }),
    ).toBe(true);
    expect(
      isOptionsDirty(MOCK_ROOM_OPTIONS, { ...draft, bedSizes: [...draft.bedSizes].reverse() }),
    ).toBe(true);
  });

  it('sends new items without an id', () => {
    const request = toRequest(
      {
        features: [{ key: 'a', id: 'feature-fridge', label: 'Fridge' }],
        bedSizes: [{ key: 'b', label: 'Cot' }],
      },
      'req-1',
    );
    expect(request).toEqual({
      requestId: 'req-1',
      features: [{ id: 'feature-fridge', label: 'Fridge' }],
      bedSizes: [{ label: 'Cot' }],
    });
  });

  it('finds the saved ids that are no longer listed', () => {
    expect(removedIds(MOCK_ROOM_OPTIONS.bedSizes, [{ id: 'bed-king', label: 'King' }])).toEqual([
      'bed-queen',
      'bed-double',
      'bed-twin',
    ]);
  });
});

describe('optionUsage and checkRemoveOption', () => {
  const roomTypes = mockRoomTypes();
  const rooms = mockRooms(roomTypes);

  it('counts a feature that room types or rooms tick', () => {
    const usage = optionUsage('features', 'feature-fridge', roomTypes, rooms);
    expect(usage.roomTypes).toEqual(['Double Queen Room', 'King Room']);
    expect(usage.rooms.length).toBeGreaterThan(0);
  });

  it('counts a bed size only with a quantity above zero', () => {
    expect(optionUsage('bedSizes', 'bed-queen', roomTypes, rooms).roomTypes).toEqual([
      'Double Queen Room',
    ]);
    expect(optionUsage('bedSizes', 'bed-twin', roomTypes, rooms)).toEqual({
      roomTypes: [],
      rooms: [],
    });
  });

  it('allows removing an item nothing uses', () => {
    expect(
      checkRemoveOption('Twin', optionUsage('bedSizes', 'bed-twin', roomTypes, rooms)),
    ).toEqual({ kind: 'ok' });
  });

  it('blocks an item in use and names what uses it', () => {
    const check = checkRemoveOption(
      'Mini fridge',
      optionUsage('features', 'feature-fridge', roomTypes, rooms),
    );
    expect(check.kind).toBe('blocked');
    expect(check.kind === 'blocked' && check.message).toMatch(
      /Mini fridge cannot be removed: it is used by 2 room types and \d rooms? \(Double Queen Room/,
    );
  });

  it('shortens a long list of users', () => {
    const check = checkRemoveOption('X', { roomTypes: ['A', 'B', 'C', 'D'], rooms: ['1'] });
    expect(check.kind === 'blocked' && check.message).toContain('A, B, C, and 2 more');
  });
});
