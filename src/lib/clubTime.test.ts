import { clubClock, departurePassed, formatClubDateTime } from './clubTime';

describe('clubClock', () => {
  it('reads the date and time on the club zone, not the browser zone', () => {
    // 03:30 UTC on the 25th is still the evening of the 24th in New York (EDT, UTC-4).
    const now = new Date('2026-10-25T03:30:00Z');
    expect(clubClock('America/New_York', now)).toEqual({ date: '2026-10-24', time: '23:30' });
    expect(clubClock('Asia/Tokyo', now)).toEqual({ date: '2026-10-25', time: '12:30' });
  });

  it('prints midnight as 00:00, never 24:00', () => {
    const now = new Date('2026-10-24T04:00:00Z');
    expect(clubClock('America/New_York', now).time).toBe('00:00');
  });

  it('falls back to the browser zone for an unknown zone', () => {
    const clock = clubClock('Not/AZone', new Date('2026-10-24T12:00:00Z'));
    expect(clock.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(clock.time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('departurePassed', () => {
  const clock = (date: string, time: string) => ({ date, time });
  it('is false before the departure day and true after it', () => {
    expect(departurePassed('2026-10-20', '12:00', clock('2026-10-19', '23:59'))).toBe(false);
    expect(departurePassed('2026-10-20', '12:00', clock('2026-10-21', '00:00'))).toBe(true);
  });
  it('on the departure day only a time after check-out counts', () => {
    expect(departurePassed('2026-10-20', '12:00', clock('2026-10-20', '11:59'))).toBe(false);
    expect(departurePassed('2026-10-20', '12:00', clock('2026-10-20', '12:00'))).toBe(false);
    expect(departurePassed('2026-10-20', '12:00', clock('2026-10-20', '12:01'))).toBe(true);
  });
});

describe('formatClubDateTime', () => {
  it('formats on the club clock', () => {
    expect(formatClubDateTime('2026-10-24T18:05:00Z', 'America/New_York')).toBe('10/24/2026 2:05 PM');
  });
  it('is empty for garbage', () => {
    expect(formatClubDateTime('nope', 'America/New_York')).toBe('');
  });
});
