import type { RoomSetup, RoomTypeSetup } from '../api/types';
import { MOCK_ROOM_SETUP_OPTIONS, mockRooms, mockRoomTypes } from '../api/roomSetupData';
import {
  acceptPhotoFiles,
  blankRoom,
  blankRoomType,
  changeRoomType,
  checkDeleteRoom,
  checkDeleteRoomType,
  clampCount,
  duplicateName,
  effectiveDetails,
  isActiveOn,
  MAX_PHOTOS,
  PHOTO_MAX_BYTES,
  selectAllIds,
  setInheritDetails,
  sortSetupItems,
  toSetupListEntries,
  syncLinkedRooms,
  toggleId,
  validateRoom,
  validateRoomType,
  withoutRoom,
} from './roomSetup';

const options = MOCK_ROOM_SETUP_OPTIONS;
const photo = { id: 'p', name: 'a.jpg', url: '' };
const validType = () => {
  const t = blankRoomType('2026-10-20', options);
  return { ...t, name: 'King', details: { ...t.details, photos: [photo] } };
};
const types = (): RoomTypeSetup[] => mockRoomTypes();
const rooms = (): RoomSetup[] => mockRooms(types());

describe('blank room type', () => {
  it('uses the defaults from the requirements', () => {
    const t = blankRoomType('2026-10-20', options);
    expect(t.details).toMatchObject({ maxOccupancy: 2, bedrooms: 0, fullBaths: 1, halfBaths: 0 });
    expect(t.details.bedTypes).toEqual({
      'bed-king': 0,
      'bed-queen': 0,
      'bed-double': 0,
      'bed-twin': 0,
    });
    expect(t).toMatchObject({ startDate: '2026-10-20', endDate: null, onlineBooking: false });
  });
});

describe('validateRoomType', () => {
  it('accepts a complete room type', () => {
    expect(validateRoomType(validType())).toEqual({});
  });
  it('requires a name of at most 50 characters', () => {
    expect(validateRoomType({ ...validType(), name: '  ' }).name).toMatch(/Enter a room type name/);
    expect(validateRoomType({ ...validType(), name: 'x'.repeat(51) }).name).toMatch(/50/);
  });
  it('requires the start date before the end date, when an end date is configured', () => {
    const t = validType();
    expect(validateRoomType({ ...t, endDate: '2026-10-20' }).endDate).toMatch(/after the start/);
    expect(validateRoomType({ ...t, endDate: '2026-10-19' }).endDate).toMatch(/after the start/);
    expect(validateRoomType({ ...t, endDate: '2026-10-21' })).toEqual({});
    expect(validateRoomType({ ...t, endDate: '' }).endDate).toMatch(/Enter an active end date/);
    expect(validateRoomType({ ...t, startDate: '' }).startDate).toBeDefined();
  });
  it('limits the description to 750 characters', () => {
    const t = validType();
    const long = { ...t, details: { ...t.details, description: 'x'.repeat(751) } };
    expect(validateRoomType(long).description).toMatch(/750/);
    const ok = { ...t, details: { ...t.details, description: 'x'.repeat(750) } };
    expect(validateRoomType(ok)).toEqual({});
  });
  it('requires at least one photo', () => {
    const t = validType();
    expect(validateRoomType({ ...t, details: { ...t.details, photos: [] } }).photos).toBeDefined();
  });
});

describe('validateRoom', () => {
  const room = () => ({ ...blankRoom('2026-10-20', options, types()[0]), name: '100' });
  it('needs a name and a room type', () => {
    expect(validateRoom(room())).toEqual({});
    expect(validateRoom({ ...room(), name: '' }).name).toBeDefined();
    expect(validateRoom({ ...room(), roomTypeId: '' }).roomTypeId).toBeDefined();
  });
  it('checks the active dates like a room type', () => {
    expect(validateRoom({ ...room(), endDate: '2026-10-01' }).endDate).toBeDefined();
  });
  it('checks the description only while details are not inherited', () => {
    const long = { ...room().details, description: 'x'.repeat(751) };
    expect(validateRoom({ ...room(), details: long }).description).toBeUndefined();
    expect(
      validateRoom({ ...room(), inheritDetails: false, details: long }).description,
    ).toBeDefined();
  });
});

describe('active dates and ordering', () => {
  it('is active between the start and the end, inclusive', () => {
    const item = { startDate: '2026-10-01', endDate: '2026-10-31' };
    expect(isActiveOn(item, '2026-09-30')).toBe(false);
    expect(isActiveOn(item, '2026-10-01')).toBe(true);
    expect(isActiveOn(item, '2026-10-31')).toBe(true);
    expect(isActiveOn(item, '2026-11-01')).toBe(false);
    expect(isActiveOn({ startDate: '2026-10-01', endDate: null }, '2030-01-01')).toBe(true);
  });
  it('moves inactive items to the bottom, each group sorted by name', () => {
    const items = [
      { name: 'B', startDate: '2020-01-01', endDate: '2021-01-01' },
      { name: 'Room 10', startDate: '2020-01-01', endDate: null },
      { name: 'Room 2', startDate: '2020-01-01', endDate: null },
      { name: 'A', startDate: '2020-01-01', endDate: '2021-01-01' },
    ];
    expect(sortSetupItems(items, '2026-10-20').map((i) => i.name)).toEqual([
      'Room 2',
      'Room 10',
      'A',
      'B',
    ]);
  });
});

describe('toSetupListEntries', () => {
  const mk = (id: string, name: string, endDate: string | null) => ({
    id,
    name,
    startDate: '2020-01-01',
    endDate,
  });
  it('flags inactive items; the first row is the item the editor selects by default', () => {
    const today = '2026-10-20';
    const entries = toSetupListEntries(
      sortSetupItems(
        [mk('1', 'Zed', '2021-01-01'), mk('2', 'Beta', null), mk('3', 'Alpha', null)],
        today,
      ),
      today,
    );
    expect(entries).toEqual([
      { id: '3', label: 'Alpha', inactive: false },
      { id: '2', label: 'Beta', inactive: false },
      { id: '1', label: 'Zed', inactive: true },
    ]);
  });
  it('treats an item as active through its end date and inactive before its start', () => {
    const today = '2026-10-20';
    expect(toSetupListEntries([mk('1', 'A', today)], today)[0].inactive).toBe(false);
    expect(
      toSetupListEntries([{ ...mk('1', 'A', null), startDate: '2026-10-21' }], today)[0].inactive,
    ).toBe(true);
  });
});

describe('association lists', () => {
  it('toggles one id and selects all or none', () => {
    expect(toggleId(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a', false)).toEqual(['b']);
    expect(toggleId(['a'], 'a', true)).toEqual(['a']);
    expect(selectAllIds([{ id: 'x' }, { id: 'y' }])).toEqual(['x', 'y']);
  });
});

describe('inheriting from the room type', () => {
  it('shows the room type details while inheriting and the room own details otherwise', () => {
    const [type] = types();
    const room = { ...rooms()[0], details: { ...type.details, maxOccupancy: 9 } };
    expect(effectiveDetails({ ...room, inheritDetails: true }, types()).maxOccupancy).toBe(4);
    expect(effectiveDetails({ ...room, inheritDetails: false }, types()).maxOccupancy).toBe(9);
  });
  it('changing the room type refreshes inherited details', () => {
    const next = changeRoomType(rooms()[0], 'rt-king', types());
    expect(next.roomTypeId).toBe('rt-king');
    expect(next.details.bedTypes['bed-king']).toBe(1);
  });
  it('changing the room type keeps edited details while Inherit Details is off', () => {
    const edited = { ...rooms()[2] };
    const next = changeRoomType(edited, 'rt-double-queen', types());
    expect(next.inheritDetails).toBe(false);
    expect(next.details.maxOccupancy).toBe(3);
  });
  it('turning Inherit Details on re-reads the room type; off keeps the values', () => {
    const edited = { ...rooms()[2] };
    expect(setInheritDetails(edited, true, types()).details.maxOccupancy).toBe(2);
    const off = setInheritDetails(rooms()[0], false, types());
    expect(off.inheritDetails).toBe(false);
    expect(off.details.maxOccupancy).toBe(4);
  });
  it('never touches the owner', () => {
    const room = { ...rooms()[2] };
    expect(changeRoomType(room, 'rt-double-queen', types()).owner).toEqual(room.owner);
    expect(setInheritDetails(room, true, types()).owner).toEqual(room.owner);
  });
});

describe('linked rooms', () => {
  it('links both ways and removes both ways', () => {
    const base = rooms().map((r) => ({ ...r, linkedRoomIds: [] as string[] }));
    const linked = syncLinkedRooms(base, 'room-100', ['room-101', 'room-200']);
    const ids = (id: string) => linked.find((r) => r.id === id)?.linkedRoomIds;
    expect(ids('room-100')).toEqual(['room-101', 'room-200']);
    expect(ids('room-101')).toEqual(['room-100']);
    expect(ids('room-200')).toEqual(['room-100']);
    const unlinked = syncLinkedRooms(linked, 'room-100', ['room-101']);
    expect(unlinked.find((r) => r.id === 'room-200')?.linkedRoomIds).toEqual([]);
    expect(unlinked.find((r) => r.id === 'room-101')?.linkedRoomIds).toEqual(['room-100']);
  });
  it('never links a room to itself', () => {
    const linked = syncLinkedRooms(rooms(), 'room-100', ['room-100']);
    expect(linked.find((r) => r.id === 'room-100')?.linkedRoomIds).toEqual([]);
  });
  it('removes a deleted room from every link', () => {
    const left = withoutRoom(rooms(), 'room-100');
    expect(left.map((r) => r.id)).toEqual(['room-101', 'room-200', 'room-300']);
    expect(left.find((r) => r.id === 'room-101')?.linkedRoomIds).toEqual([]);
  });
});

describe('deleting', () => {
  it('blocks a room type that rooms use', () => {
    const check = checkDeleteRoomType(types()[0], rooms());
    expect(check.kind).toBe('blocked');
    expect(check.message).toMatch(/2 rooms use it/);
    expect(checkDeleteRoomType(types()[2], rooms()).kind).toBe('ok');
  });
  it('counts a retired room too: King Room is used by rooms 200 and 300', () => {
    expect(checkDeleteRoomType(types()[1], rooms()).message).toMatch(/2 rooms use it/);
  });
  it('warns about a room with upcoming reservations', () => {
    expect(checkDeleteRoom({ name: '100', upcomingReservations: 2 }).kind).toBe('warn');
    expect(checkDeleteRoom({ name: '100', upcomingReservations: 1 }).message).toMatch(
      /1 upcoming reservation\./,
    );
    expect(checkDeleteRoom({ name: '101', upcomingReservations: 0 }).kind).toBe('ok');
  });
});

describe('duplicating', () => {
  it('names the copy and keeps it within 50 characters', () => {
    expect(duplicateName('King')).toBe('Copy of King');
    expect(duplicateName('x'.repeat(50))).toHaveLength(50);
    expect(duplicateName('  ')).toBe('Copy');
  });
});

describe('acceptPhotoFiles', () => {
  const file = (name: string, type = 'image/png', size = 1000) => ({ name, type, size });
  it('accepts images and explains every rejected file', () => {
    const { accepted, errors } = acceptPhotoFiles(
      [
        file('a.png'),
        file('b.pdf', 'application/pdf'),
        file('c.png', 'image/png', PHOTO_MAX_BYTES + 1),
      ],
      0,
    );
    expect(accepted.map((f) => f.name)).toEqual(['a.png']);
    expect(errors).toHaveLength(2);
  });
  it('stops at the maximum number of photos', () => {
    const { accepted, errors } = acceptPhotoFiles([file('a.png'), file('b.png')], MAX_PHOTOS - 1);
    expect(accepted).toHaveLength(1);
    expect(errors[0]).toMatch(/at most 50/);
  });
});

describe('clampCount', () => {
  it('keeps a count inside its range and whole', () => {
    expect(clampCount(-3, 0, 99)).toBe(0);
    expect(clampCount(120, 0, 99)).toBe(99);
    expect(clampCount(2.6, 0, 99)).toBe(3);
    expect(clampCount(Number.NaN, 1, 99)).toBe(1);
  });
});
