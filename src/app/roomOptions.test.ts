import type { ScheduleLocation, ScheduleRoom, ScheduleRoomType } from '../api/types';
import { buildRoomOptions, filterRoomOptions } from './roomOptions';

const locations: ScheduleLocation[] = [
  { id: 'a', name: 'Main Clubhouse' },
  { id: 'b', name: 'Lakeside Cottages' },
];
const types: ScheduleRoomType[] = [
  { id: 'k', name: 'King Deluxe' },
  { id: 's', name: 'Suite' },
];
const rooms: ScheduleRoom[] = [
  { id: 'r10', number: '10', locationId: 'b', roomTypeId: 'k' },
  { id: 'r2', number: '2', locationId: 'a', roomTypeId: 's' },
  { id: 'r9', number: '9', locationId: 'a', roomTypeId: 'k' },
  { id: 'r1', number: '1', locationId: 'a', roomTypeId: 'k' },
];

describe('room options for the New Reservation panel', () => {
  const options = buildRoomOptions(rooms, locations, types);

  it('lists every room, grouped by location and type, numbers in natural order', () => {
    expect(options).toHaveLength(rooms.length);
    expect(options.map((o) => `${o.group}:${o.number}`)).toEqual([
      'Main Clubhouse | King Deluxe:1',
      'Main Clubhouse | King Deluxe:9',
      'Main Clubhouse | Suite:2',
      'Lakeside Cottages | King Deluxe:10',
    ]);
    expect(options[0].label).toBe('Room 1');
  });

  it('searches by number, location and room type, case-insensitively, all words must match', () => {
    expect(filterRoomOptions(options, '').length).toBe(4);
    expect(filterRoomOptions(options, 'lake').map((o) => o.id)).toEqual(['r10']);
    expect(filterRoomOptions(options, 'SUITE').map((o) => o.id)).toEqual(['r2']);
    expect(filterRoomOptions(options, 'king main').map((o) => o.id)).toEqual(['r1', 'r9']);
    expect(filterRoomOptions(options, 'room 9').map((o) => o.id)).toEqual(['r9']);
    expect(filterRoomOptions(options, 'nothing')).toEqual([]);
  });

  it('copes with a room whose location or type is not listed', () => {
    const [o] = buildRoomOptions(
      [{ id: 'x', number: '5', locationId: 'zz', roomTypeId: 'zz' }],
      [],
      [],
    );
    expect(o.group).toBe('Unknown location | Unknown type');
  });
});
