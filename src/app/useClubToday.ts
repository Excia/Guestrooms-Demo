import { useEffect, useState } from 'react';
import type { IsoDate } from '../lib/dates';
import { clubTodayIso } from '../lib/clubTime';
import { useSystemSettings } from './useSystemSettings';

/** How often a page left open re-reads the clock (the day can also change while the tab sleeps). */
export const CLUB_DAY_CHECK_MS = 60_000;

export interface ClubDay {
  /** Today's date on the club's clock; the browser's until the System Settings have loaded. */
  today: IsoDate;
  /**
   * The settings are loaded, failed to load (the browser's date stays), or can never load (no
   * provider): `today` will not change because of them any more.
   */
  settled: boolean;
}

/**
 * Today's date in the club's time zone (System Settings `timeZone`), kept current: it is re-read
 * every minute and when the tab becomes visible or the window gets focus, so a page left open past
 * the club's midnight changes day. `override` (tests, or a date the page was given) wins. Starts the
 * settings fetch like any `useSystemSettings()` caller.
 */
export function useClubDay(override?: IsoDate): ClubDay {
  const { settings, status, provided } = useSystemSettings();
  const timeZone = settings?.timeZone;
  const [clock, setClock] = useState(() => ({ timeZone, date: clubTodayIso(timeZone) }));
  useEffect(() => {
    const update = () => {
      const date = clubTodayIso(timeZone);
      setClock((c) => (c.timeZone === timeZone && c.date === date ? c : { timeZone, date }));
    };
    update();
    const timer = window.setInterval(update, CLUB_DAY_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') update();
    };
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [timeZone]);
  // A new zone applies in the same render, not one effect later.
  const date = clock.timeZone === timeZone ? clock.date : clubTodayIso(timeZone);
  return {
    today: override ?? date,
    settled: !provided || status === 'ready' || status === 'error',
  };
}

/** Today's date on the club's clock (see `useClubDay`). */
export function useClubToday(override?: IsoDate): IsoDate {
  return useClubDay(override).today;
}
