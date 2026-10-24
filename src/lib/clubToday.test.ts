import { describe, expect, it } from 'vitest';
import { clubTodayIso } from './dates';

// 2026-10-25 03:30 UTC: still the 24th in New York and Los Angeles, already the 25th in Berlin and Tokyo.
const instant = new Date('2026-10-25T03:30:00Z');

describe('clubTodayIso', () => {
  it('is the date in the club time zone', () => {
    expect(clubTodayIso('America/New_York', instant)).toBe('2026-10-24');
    expect(clubTodayIso('America/Los_Angeles', instant)).toBe('2026-10-24');
    expect(clubTodayIso('Europe/Berlin', instant)).toBe('2026-10-25');
    expect(clubTodayIso('Asia/Tokyo', instant)).toBe('2026-10-25');
  });
  it('follows the day boundary of the zone', () => {
    expect(clubTodayIso('America/New_York', new Date('2026-10-25T03:59:59Z'))).toBe('2026-10-24');
    expect(clubTodayIso('America/New_York', new Date('2026-10-25T04:00:00Z'))).toBe('2026-10-25');
  });
  it('falls back to the browser date for no zone or an unknown one', () => {
    const local = clubTodayIso(undefined, instant);
    expect(clubTodayIso('', instant)).toBe(local);
    expect(clubTodayIso('Not/AZone', instant)).toBe(local);
  });
});
