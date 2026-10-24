import { useEffect, useMemo, useState } from 'react';
import type { ScheduleHold } from '../../api';
import { liveHolds, nextHoldExpiry } from '../../app/slotHolds';

/**
 * The holds that are still live, redrawn the moment the next one ends (no polling): a hold shades
 * the grid until its `expiresAt`, whether or not the schedule reloads. `now` is injectable (epoch ms).
 */
export function useLiveHolds(
  holds: readonly ScheduleHold[],
  now: () => number = Date.now,
): ScheduleHold[] {
  const [clock, setClock] = useState(() => now());
  // New holds arrived: look at the clock again before deciding what is live.
  const [seen, setSeen] = useState(holds);
  if (seen !== holds) {
    setSeen(holds);
    setClock(now());
  }
  useEffect(() => {
    const wait = nextHoldExpiry(holds, clock);
    if (wait === null) return;
    const timer = setTimeout(() => setClock(now()), wait + 1);
    return () => clearTimeout(timer);
  }, [holds, clock, now]);
  // Memoised so the rows that take it as a prop keep their identity between redraws.
  return useMemo(() => liveHolds(holds, clock), [holds, clock]);
}
