import { describe, expect, it } from 'vitest';
import {
  blockOpacityToken,
  dropColumns,
  isActiveEvent,
  isPastEvent,
  pastColumnCount,
} from './scheduleBlockState';
import type { ScheduleBlock, ScheduleClosure } from '../api/types';

const block = (over: Partial<ScheduleBlock> = {}): ScheduleBlock => ({
  kind: 'reservation',
  id: 'rr-1',
  reservationId: 'rs-1',
  confirmationNumber: 'GR-1',
  guestName: 'Ada Lovelace',
  guestType: 'guest',
  roomId: 'rm-1',
  startDate: '2026-10-10',
  endDate: '2026-10-13',
  status: 'confirmed',
  roomCount: 1,
  roomTypeLocked: false,
  version: 'v1',
  ...over,
});
const closure: ScheduleClosure = {
  kind: 'closure',
  id: 'cl-1',
  roomId: 'rm-1',
  startDate: '2026-10-10',
  endDate: '2026-10-12',
  reason: 'Fixed loss',
  endMarker: false,
};

describe('isPastEvent', () => {
  it('is true only after check out, whatever the dates', () => {
    expect(isPastEvent(block({ status: 'checked-out' }))).toBe(true);
    expect(isPastEvent(block({ status: 'checked-in', endDate: '2026-10-01' }))).toBe(false);
    expect(isPastEvent(block({ status: 'confirmed', endDate: '2026-10-01' }))).toBe(false);
    expect(isPastEvent(block({ status: 'nyci' }))).toBe(false);
  });
  it('is false for a closure', () => {
    expect(isPastEvent(closure)).toBe(false);
  });
});

describe('isActiveEvent', () => {
  it('matches every room of the reservation, or just the selected room', () => {
    expect(isActiveEvent(block(), { reservationId: 'rs-1' })).toBe(true);
    expect(isActiveEvent(block({ id: 'rr-2' }), { reservationId: 'rs-1' })).toBe(true);
    expect(
      isActiveEvent(block({ id: 'rr-2' }), { reservationId: 'rs-1', reservationRoomId: 'rr-1' }),
    ).toBe(false);
    expect(isActiveEvent(block(), { reservationId: 'rs-1', reservationRoomId: 'rr-1' })).toBe(true);
  });
  it('is false for another reservation, no active event, closures and linked-room blocks', () => {
    expect(isActiveEvent(block({ reservationId: 'rs-9' }), { reservationId: 'rs-1' })).toBe(false);
    expect(isActiveEvent(block(), null)).toBe(false);
    expect(isActiveEvent(block(), undefined)).toBe(false);
    expect(isActiveEvent(closure, { reservationId: 'rs-1' })).toBe(false);
    expect(
      isActiveEvent(block({ linkedTo: { roomNumber: '1', reserverName: 'X' } }), {
        reservationId: 'rs-1',
      }),
    ).toBe(false);
  });
});

describe('blockOpacityToken', () => {
  it('is normal by default and past once checked out', () => {
    expect(blockOpacityToken(block(), {})).toBe('normal');
    expect(blockOpacityToken(block({ status: 'checked-out' }), {})).toBe('past');
    expect(blockOpacityToken(closure, {})).toBe('normal');
  });
  it('active beats past', () => {
    expect(blockOpacityToken(block({ status: 'checked-out' }), { active: true })).toBe('active');
  });
  it('dragging and the ghost beat everything, linked beats active and past', () => {
    expect(blockOpacityToken(block(), { dragging: true, active: true })).toBe('dragging');
    expect(blockOpacityToken(block(), { ghost: true })).toBe('ghost');
    const linked = block({ linkedTo: { roomNumber: '1', reserverName: 'X' } });
    expect(blockOpacityToken(linked, { active: true })).toBe('linked');
  });
});

describe('pastColumnCount', () => {
  it('counts the visible columns before today', () => {
    expect(pastColumnCount('2026-10-20', 7, '2026-10-23')).toBe(3);
    expect(pastColumnCount('2026-10-23', 7, '2026-10-23')).toBe(0);
    expect(pastColumnCount('2026-10-25', 7, '2026-10-23')).toBe(0);
    expect(pastColumnCount('2026-10-01', 7, '2026-10-23')).toBe(7);
  });
});

describe('dropColumns', () => {
  const stay = { startDate: '2026-10-10', endDate: '2026-10-13' };
  it('keeps the stay length wherever it lands', () => {
    for (const shift of [-2, 0, 1, 3]) {
      expect(dropColumns(stay, shift, '2026-10-05', 14)).toMatchObject({ count: 3, nights: 3 });
    }
  });
  it('starts at the target column', () => {
    expect(dropColumns(stay, 0, '2026-10-08', 14)).toEqual({ first: 2, count: 3, nights: 3 });
    expect(dropColumns(stay, 2, '2026-10-08', 14)).toEqual({ first: 4, count: 3, nights: 3 });
  });
  it('is clipped to the visible range, and null when nothing is visible', () => {
    expect(dropColumns(stay, 0, '2026-10-11', 7)).toEqual({ first: 0, count: 2, nights: 3 });
    expect(dropColumns(stay, 0, '2026-10-05', 7)).toEqual({ first: 5, count: 2, nights: 3 });
    expect(dropColumns(stay, 20, '2026-10-05', 7)).toBeNull();
    expect(dropColumns(stay, -20, '2026-10-05', 7)).toBeNull();
  });
});
