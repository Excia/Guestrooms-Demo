import { describe, expect, it } from 'vitest';
import { formatDisplayDate } from './folioFormat';

describe('formatDisplayDate', () => {
  it('writes MM/DD/YY', () => {
    expect(formatDisplayDate('2026-10-06')).toBe('10/06/26');
    expect(formatDisplayDate('2027-01-31')).toBe('01/31/27');
  });
  it('returns an invalid date unchanged', () => {
    expect(formatDisplayDate('2026-02-30')).toBe('2026-02-30');
  });
});
