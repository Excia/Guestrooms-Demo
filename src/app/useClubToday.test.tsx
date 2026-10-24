import { act, renderHook } from '@testing-library/react';
import { CLUB_DAY_CHECK_MS, useClubDay } from './useClubToday';

afterEach(() => {
  vi.useRealTimers();
});

describe('useClubDay', () => {
  it('follows the day change of a page left open, by the minute and on window focus', () => {
    vi.useFakeTimers({ now: new Date('2026-10-24T23:59:30Z') });
    const { result } = renderHook(() => useClubDay());
    const first = result.current.today;
    // Never loaded a provider: nothing to wait for.
    expect(result.current.settled).toBe(true);
    // Past the browser's midnight (UTC in CI; any zone moves its date within a day).
    act(() => {
      vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
      vi.advanceTimersByTime(CLUB_DAY_CHECK_MS);
    });
    expect(result.current.today).not.toBe(first);
    const second = result.current.today;
    act(() => {
      vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current.today).not.toBe(second);
  });

  it('lets an explicit date win', () => {
    const { result } = renderHook(() => useClubDay('2026-01-02'));
    expect(result.current.today).toBe('2026-01-02');
  });
});
