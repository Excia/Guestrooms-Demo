import type { ScheduleBlock, ScheduleClosure } from '../api/types';
import {
  CLOSURE_DESCRIPTION_MAX,
  cleanDescription,
  closureBlockText,
  closureConflict,
  conflictMessage,
  defaultClosureDates,
  moveClosureStart,
  validateClosure,
} from './closures';

const closure = (over: Partial<ScheduleClosure> = {}): ScheduleClosure => ({
  kind: 'closure',
  id: 'cl-x',
  roomId: 'rm-1',
  startDate: '2026-10-10',
  endDate: '2026-10-12',
  reason: 'Carpet',
  endMarker: false,
  ...over,
});
const block = (over: Partial<ScheduleBlock> = {}): ScheduleBlock =>
  ({
    kind: 'reservation',
    id: 'rr-1',
    roomId: 'rm-1',
    confirmationNumber: 'GR-1',
    startDate: '2026-10-10',
    endDate: '2026-10-12',
    ...over,
  }) as ScheduleBlock;

const form = { roomId: 'rm-1', startDate: '2026-10-10', endDate: '2026-10-11', description: '' };

describe('validateClosure', () => {
  it('accepts a complete form, with or without a description', () => {
    expect(validateClosure(form)).toEqual({});
    expect(validateClosure({ ...form, description: 'x'.repeat(50) })).toEqual({});
  });
  it('requires a room and both dates', () => {
    const errors = validateClosure({ roomId: '', startDate: '', endDate: '', description: '' });
    expect(Object.keys(errors).sort()).toEqual(['endDate', 'roomId', 'startDate']);
  });
  it('needs the end after the start', () => {
    expect(validateClosure({ ...form, endDate: '2026-10-10' }).endDate).toMatch(/after the start/);
    expect(validateClosure({ ...form, endDate: '2026-10-09' }).endDate).toMatch(/after the start/);
  });
  it('limits the description to 50 characters', () => {
    expect(validateClosure({ ...form, description: 'x'.repeat(51) }).description).toMatch(/50/);
    expect(cleanDescription(` ${'x'.repeat(60)} `)).toHaveLength(CLOSURE_DESCRIPTION_MAX);
  });
});

describe('closureConflict', () => {
  const window = { blocks: [block()], closures: [closure()] };
  const room = { roomId: 'rm-1', startDate: '2026-10-11', endDate: '2026-10-13' };
  it('finds a reservation first, then another closure', () => {
    expect(closureConflict(window, room)).toEqual({
      kind: 'reservation',
      confirmationNumber: 'GR-1',
    });
    expect(closureConflict({ blocks: [], closures: window.closures }, room)).toEqual({
      kind: 'closure',
    });
  });
  it('treats dates as half-open: a same-day turnover is free', () => {
    expect(closureConflict(window, { ...room, startDate: '2026-10-12', endDate: '2026-10-14' })).toBe(
      null,
    );
    expect(closureConflict(window, { ...room, startDate: '2026-10-08', endDate: '2026-10-10' })).toBe(
      null,
    );
  });
  it('ignores other rooms and the closure being edited', () => {
    expect(closureConflict(window, { ...room, roomId: 'rm-2' })).toBe(null);
    expect(closureConflict({ blocks: [], closures: window.closures }, room, 'cl-x')).toBe(null);
  });
  it('has no conflict without a room or a valid range', () => {
    expect(closureConflict(window, { ...room, roomId: '' })).toBe(null);
    expect(closureConflict(window, { ...room, endDate: room.startDate })).toBe(null);
  });
  it('words the message with the room number', () => {
    expect(conflictMessage({ kind: 'reservation', confirmationNumber: 'GR-1' }, '208')).toBe(
      'Room 208 has reservation GR-1 on those dates.',
    );
    expect(conflictMessage({ kind: 'closure' }, '208')).toBe(
      'Room 208 is already closed on those dates.',
    );
  });
});

describe('closure block text', () => {
  const long = 'Maintenance: Carpet replacement';
  it('cuts after 20 characters on a short closure', () => {
    expect(closureBlockText(long, '2026-10-10', '2026-10-12')).toBe('Maintenance: Carpet…');
    expect(closureBlockText('Short text', '2026-10-10', '2026-10-11')).toBe('Short text');
  });
  it('keeps the whole text on a longer closure', () => {
    expect(closureBlockText(long, '2026-10-10', '2026-10-13')).toBe(long);
  });
  it('names a closure without a description', () => {
    expect(closureBlockText('  ', '2026-10-10', '2026-10-20')).toBe('Room closed');
  });
});

describe('default and moved dates', () => {
  it('starts today or on the clicked day and ends one night later', () => {
    expect(defaultClosureDates('2026-10-16')).toEqual({
      startDate: '2026-10-16',
      endDate: '2026-10-17',
    });
    expect(defaultClosureDates('2026-10-16', '2026-10-20').endDate).toBe('2026-10-21');
  });
  it('keeps the end after the start when the start moves', () => {
    const wide = { ...form, endDate: '2026-10-13' };
    expect(moveClosureStart(wide, '2026-10-20')).toMatchObject({
      startDate: '2026-10-20',
      endDate: '2026-10-23',
    });
    expect(moveClosureStart(wide, '2026-10-11').endDate).toBe('2026-10-13');
    expect(moveClosureStart(wide, '').startDate).toBe('');
  });
});
