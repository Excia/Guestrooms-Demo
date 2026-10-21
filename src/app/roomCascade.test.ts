import type { ScheduleRoom } from '../api/types';
import {
  roomChoices,
  selectLocation,
  selectRoom,
  selectRoomType,
  UNASSIGNED_SELECTION as NONE,
  type RoomSelection,
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
const sel = (over: Partial<RoomSelection>): RoomSelection => ({ ...NONE, ...over });

describe('room cascade: what is offered', () => {
  it('with nothing chosen every location, type and room is offered', () => {
    const c = roomChoices(rooms, NONE);
    expect(ids(c.locationIds)).toEqual(['A', 'B', 'C']);
    expect(ids(c.roomTypeIds)).toEqual(['cottage', 'king', 'queen', 'suite']);
    expect(c.rooms).toHaveLength(5);
  });

  it('a location limits the types and rooms; a type limits the locations and rooms', () => {
    const byLocation = roomChoices(rooms, sel({ locationId: 'A' }));
    expect(ids(byLocation.roomTypeIds)).toEqual(['king', 'suite']);
    expect(byLocation.rooms.map((x) => x.id)).toEqual(['1', '2']);
    const byType = roomChoices(rooms, sel({ roomTypeId: 'king' }));
    expect(ids(byType.locationIds)).toEqual(['A', 'B']);
    expect(byType.rooms.map((x) => x.id)).toEqual(['1', '3']);
    expect(
      roomChoices(rooms, sel({ locationId: 'B', roomTypeId: 'king' })).rooms.map((x) => x.id),
    ).toEqual(['3']);
  });

  it('copes with no rooms at all', () => {
    expect(roomChoices([], NONE).rooms).toEqual([]);
    expect(selectLocation([], NONE, 'A')).toMatchObject({ locationId: 'A', roomId: '' });
  });
});

describe('room cascade: choosing', () => {
  it('a room sets its location and type, marked as filled in by the room', () => {
    expect(selectRoom(rooms, NONE, '4')).toEqual({
      locationId: 'B',
      roomTypeId: 'cottage',
      roomId: '4',
      autoLocation: true,
      autoRoomType: true,
    });
  });

  it('choices the user made themselves are not marked as filled in', () => {
    const chosen = selectRoom(rooms, sel({ locationId: 'B', roomTypeId: '' }), '3');
    expect(chosen).toMatchObject({
      locationId: 'B',
      autoLocation: false,
      roomTypeId: 'king',
      autoRoomType: true,
    });
  });

  it('clearing the room undoes only what the room filled in', () => {
    // nothing chosen before: both go back to Unassigned, so the Room list widens again
    expect(selectRoom(rooms, selectRoom(rooms, NONE, '4'), '')).toEqual(NONE);
    // the user had chosen the location: it stays, the type goes
    const partly = selectRoom(rooms, selectLocation(rooms, NONE, 'B'), '3');
    expect(selectRoom(rooms, partly, '')).toEqual(sel({ locationId: 'B' }));
    // both chosen explicitly: both stay
    const both = selectRoom(rooms, sel({ locationId: 'B', roomTypeId: 'king' }), '3');
    expect(selectRoom(rooms, both, '')).toEqual(sel({ locationId: 'B', roomTypeId: 'king' }));
    // an unknown room is Unassigned too
    expect(selectRoom(rooms, selectRoom(rooms, NONE, '4'), 'nope')).toEqual(NONE);
  });

  it('picking another room keeps the explicit/auto marks', () => {
    const first = selectRoom(rooms, NONE, '1');
    const second = selectRoom(rooms, first, '3'); // list was not narrowed: other location
    expect(second).toMatchObject({
      locationId: 'B',
      roomId: '3',
      autoLocation: true,
      autoRoomType: true,
    });
  });
});

describe('room cascade: Unassigned in Location or Room Type', () => {
  it('Unassigned location also clears the room: "Location Unassigned, Room 302" never shows', () => {
    const withRoom = selectRoom(rooms, NONE, '2');
    expect(selectLocation(rooms, withRoom, '')).toEqual(NONE);
  });

  it('Unassigned room type also clears the room', () => {
    const withRoom = selectRoom(rooms, NONE, '2');
    expect(selectRoomType(rooms, withRoom, '')).toEqual(NONE);
  });

  it('what the user chose explicitly stays when the other dropdown is set to Unassigned', () => {
    const state = selectRoom(rooms, sel({ locationId: 'A', roomTypeId: '' }), '1');
    // type was filled in by the room; the user sets Location to Unassigned: the room goes, so does the auto type
    expect(selectLocation(rooms, state, '')).toEqual(NONE);
    // the user sets the Type (explicit) to Unassigned: room and auto type go, the explicit location stays
    expect(selectRoomType(rooms, state, '')).toEqual(sel({ locationId: 'A' }));
  });

  it('Unassigned without a room just widens the others', () => {
    expect(selectLocation(rooms, sel({ locationId: 'A' }), '')).toEqual(NONE);
    expect(selectRoomType(rooms, sel({ roomTypeId: 'king' }), '')).toEqual(NONE);
  });
});

describe('room cascade: changing to another value', () => {
  it('a new location clears an incompatible room and type', () => {
    const state = selectRoom(rooms, NONE, '4'); // B cottage
    expect(selectLocation(rooms, state, 'A')).toEqual(sel({ locationId: 'A' }));
  });

  it('a new location keeps a room that still fits', () => {
    const state = sel({ roomTypeId: 'king', roomId: '3', locationId: 'B', autoLocation: true });
    expect(selectLocation(rooms, state, 'B')).toMatchObject({ roomId: '3', autoLocation: false });
  });

  it('a new room type clears an incompatible room and location', () => {
    const state = selectRoom(rooms, NONE, '5'); // C queen
    expect(selectRoomType(rooms, state, 'king')).toEqual(sel({ roomTypeId: 'king' }));
  });

  it('a new room type keeps a fitting room and an explicit location', () => {
    const state = selectRoom(rooms, sel({ locationId: 'A' }), '1');
    expect(selectRoomType(rooms, state, 'king')).toMatchObject({
      locationId: 'A',
      roomId: '1',
      roomTypeId: 'king',
      autoRoomType: false,
    });
  });

  it('a type that no longer exists in the new location resets and an explicit type stays otherwise', () => {
    const state = sel({ locationId: 'A', roomTypeId: 'suite' });
    expect(selectLocation(rooms, state, 'B')).toEqual(sel({ locationId: 'B' }));
    expect(selectLocation(rooms, sel({ locationId: 'A', roomTypeId: 'king' }), 'B')).toMatchObject({
      locationId: 'B',
      roomTypeId: 'king',
    });
  });
});
