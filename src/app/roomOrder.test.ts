import { describe, expect, it } from 'vitest';
import {
  applyRoomOrder,
  moveItem,
  orderScheduleRooms,
  reorderableRooms,
  sameOrder,
} from './roomOrder';

describe('moveItem', () => {
  it('moves an item up, down and to the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });
  it('ignores out-of-range moves and does not mutate', () => {
    const list = ['a', 'b'];
    expect(moveItem(list, 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(list, 1, 5)).toEqual(['a', 'b']);
    expect(moveItem(list, 1, 1)).toEqual(['a', 'b']);
    expect(list).toEqual(['a', 'b']);
  });
});

describe('sameOrder', () => {
  it('compares position by position', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameOrder(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('reorderableRooms / applyRoomOrder', () => {
  const rooms = [{ id: 'a' }, { id: 'b' }, { id: 'x' }, { id: 'c' }];
  it('lists only the active rooms', () => {
    expect(reorderableRooms(rooms, (r) => r.id !== 'x').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
  it('puts the panel order first and keeps the rest after, in order', () => {
    expect(applyRoomOrder(rooms, ['c', 'a', 'b']).map((r) => r.id)).toEqual(['c', 'a', 'b', 'x']);
  });
  it('ignores unknown ids', () => {
    expect(applyRoomOrder(rooms, ['b', 'zzz']).map((r) => r.id)).toEqual(['b', 'a', 'x', 'c']);
  });
});

describe('orderScheduleRooms', () => {
  const rows = [{ number: '201' }, { number: '101' }, { number: '301' }, { number: '102' }];
  it('fills the matched rows in setup order and leaves the others in place', () => {
    const out = orderScheduleRooms(rows, ['102', '101']).map((r) => r.number);
    expect(out).toEqual(['201', '102', '301', '101']);
  });
  it('is unchanged when nothing matches', () => {
    expect(orderScheduleRooms(rows, ['999'])).toEqual(rows);
  });
});
