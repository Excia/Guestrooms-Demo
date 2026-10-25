import {
  formatFieldTime,
  fromClockParts,
  hourAtAngle,
  minuteAtAngle,
  nearestAllowed,
  parseTypedTime,
  pointAngle,
  stepHour,
  stepMinute,
  toClockParts,
} from './clockTime';

describe('clock parts', () => {
  it('maps minutes to 12 hour parts and back', () => {
    expect(toClockParts(0)).toEqual({ hour: 12, minute: 0, pm: false });
    expect(toClockParts(12 * 60)).toEqual({ hour: 12, minute: 0, pm: true });
    expect(toClockParts(16 * 60 + 5)).toEqual({ hour: 4, minute: 5, pm: true });
    for (const t of [0, 5, 719, 720, 1439]) expect(fromClockParts(toClockParts(t))).toBe(t);
  });
  it('formats the field text as hh:mm AM/PM', () => {
    expect(formatFieldTime('16:05')).toBe('04:05 PM');
    expect(formatFieldTime('00:00')).toBe('12:00 AM');
    expect(formatFieldTime('')).toBe('');
  });
});

describe('parseTypedTime', () => {
  it.each([
    ['4:05 pm', '16:05'],
    ['04:05PM', '16:05'],
    ['12:00 AM', '00:00'],
    ['12:30 pm', '12:30'],
    ['4 PM', '16:00'],
    ['16:05', '16:05'],
  ])('reads %s', (text, expected) => expect(parseTypedTime(text)).toBe(expected));
  it.each(['', 'abc', '13:00 PM', '0:30 AM', '4:75 PM', '25:00', '4'])('rejects %s', (text) =>
    expect(parseTypedTime(text)).toBeNull(),
  );
});

describe('dial geometry', () => {
  it("turns a point into a clockwise angle from 12 o'clock", () => {
    expect(pointAngle(0, -1)).toBe(0);
    expect(pointAngle(1, 0)).toBe(90);
    expect(pointAngle(0, 1)).toBe(180);
    expect(pointAngle(-1, 0)).toBe(270);
  });
  it('snaps angles to hours and to the minute step', () => {
    expect(hourAtAngle(0)).toBe(12);
    expect(hourAtAngle(92)).toBe(3);
    expect(hourAtAngle(359)).toBe(12);
    expect(minuteAtAngle(90, 5)).toBe(15);
    expect(minuteAtAngle(359, 5)).toBe(0);
    expect(minuteAtAngle(16, 5)).toBe(5);
  });
});

describe('allowed times', () => {
  const afternoon = (t: number) => t >= 12 * 60 + 5 && t <= 15 * 60; // late checkout: 12:05 to 3:00 PM
  it('finds the nearest allowed time on the step', () => {
    expect(nearestAllowed(10 * 60, 5, afternoon)).toBe(12 * 60 + 5);
    expect(nearestAllowed(17 * 60, 5, afternoon)).toBe(15 * 60);
    expect(nearestAllowed(13 * 60, 5, afternoon)).toBe(13 * 60);
    expect(nearestAllowed(0, 5, () => false)).toBeNull();
  });
  it('steps over hours and minutes that are not allowed', () => {
    const parts = { hour: 3, minute: 0, pm: true };
    expect(stepHour(parts, 1, 5, afternoon)).toBe(12);
    expect(stepHour(parts, -1, 5, afternoon)).toBe(2);
    expect(stepMinute({ hour: 3, minute: 0, pm: true }, 1, 5, afternoon)).toBe(0);
    expect(stepMinute({ hour: 12, minute: 5, pm: true }, -1, 5, afternoon)).toBe(55);
  });
});
