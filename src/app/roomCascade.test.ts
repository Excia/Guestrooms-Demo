import type { ScheduleRoom } from '../api/types';
import {
  roomChoices,
  selectLocation,
  selectRoom,
  selectRoomType,
  UNASSIGNED_SELECTION,
} from './roomCascade';

const r = (id: string, locationId: string, roomTypeId: string): ScheduleRoom => ({
  id,
  number: id,
  locationId,
  roomTypeId,
});
// A: king, suite   B: king, cottage   C: queen
const rooms = [
  r('1', 'A', 'king'),
  r('2', 'A', 'suite'),
  r('3', 'B', 'king'),
  r('4', 'B', 'cottage'),
  r('5', 'C', 'queen'),
];
const ids = (s: ReadonlySet<string>) => [...s].sort();

describe('room cascade', () => {
  it('with nothing chosen every location, type and room is offered', () => {
    const c = roomChoices(rooms, UNASSIGNED_SELECTION);
    expect(ids(c.locationIds)).toEqual(['A', 'B', 'C']);
    expect(ids(c.roomTypeIds)).toEqual(['cottage', 'king', 'queen', 'suite']);
    expect(c.rooms).toHaveLength(5);
  });

  it('a location limits the types and rooms', () => {
    const c = roomChoices(rooms, { ...UNASSIGNED_SELECTION, locationId: 'A' });
    expect(ids(c.roomTypeIds)).toEqual(['king', 'suite']);
    expect(c.rooms.map((x) => x.id)).toEqual(['1', '2']);
    expect(ids(c.locationIds)).toEqual(['A', 'B', 'C']); // the location list itself is not narrowed by a location
  });

  it('a room type limits the locations and rooms', () => {
    const c = roomChoices(rooms, { ...UNASSIGNED_SELECTION, roomTypeId: 'king' });
    expect(ids(c.locationIds)).toEqual(['A', 'B']);
    expect(c.rooms.map((x) => x.id)).toEqual(['1', '3']);
  });

  it('both together give the rooms that match both', () => {
    const c = roomChoices(rooms, { locationId: 'B', roomTypeId: 'king', roomId: '' });
    expect(c.rooms.map((x) => x.id)).toEqual(['3']);
  });

  it('choosing a room sets its location and type', () => {
    expect(selectRoom(rooms, UNASSIGNED_SELECTION, '4')).toEqual({
      locationId: 'B',
      roomTypeId: 'cottage',
      roomId: '4',
    });
  });

  it('Unassigned for the room keeps the narrowing, and an unknown room is Unassigned', () => {
    const sel = { locationId: 'B', roomTypeId: 'king', roomId: '3' };
    expect(selectRoom(rooms, sel, '')).toEqual({ locationId: 'B', roomTypeId: 'king', roomId: '' });
    expect(selectRoom(rooms, sel, 'nope').roomId).toBe('');
  });

  it('changing the location clears an incompatible room and type', () => {
    const sel = { locationId: 'B', roomTypeId: 'cottage', roomId: '4' };
    expect(selectLocation(rooms, sel, 'A')).toEqual({
      locationId: 'A',
      roomTypeId: '',
      roomId: '',
    });
    // a compatible room stays
    expect(selectLocation(rooms, { locationId: '', roomTypeId: 'king', roomId: '3' }, 'B')).toEqual(
      {
        locationId: 'B',
        roomTypeId: 'king',
        roomId: '3',
      },
    );
  });

  it('changing the room type clears an incompatible room and location', () => {
    const sel = { locationId: 'C', roomTypeId: 'queen', roomId: '5' };
    expect(selectRoomType(rooms, sel, 'king')).toEqual({
      locationId: '',
      roomTypeId: 'king',
      roomId: '',
    });
    expect(selectRoomType(rooms, { locationId: 'A', roomTypeId: '', roomId: '1' }, 'king')).toEqual(
      {
        locationId: 'A',
        roomTypeId: 'king',
        roomId: '1',
      },
    );
  });

  it('Unassigned in a dropdown widens the others again and keeps a fitting room', () => {
    const sel = { locationId: 'A', roomTypeId: 'king', roomId: '1' };
    expect(selectLocation(rooms, sel, '')).toEqual({
      locationId: '',
      roomTypeId: 'king',
      roomId: '1',
    });
    expect(selectRoomType(rooms, sel, '')).toEqual({
      locationId: 'A',
      roomTypeId: '',
      roomId: '1',
    });
  });

  it('copes with no rooms at all', () => {
    expect(roomChoices([], UNASSIGNED_SELECTION).rooms).toEqual([]);
    expect(selectLocation([], UNASSIGNED_SELECTION, 'A')).toEqual({
      locationId: 'A',
      roomTypeId: '',
      roomId: '',
    });
  });
});
