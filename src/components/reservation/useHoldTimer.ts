import { useCallback, useEffect, useState } from 'react';
import { holdStatus, type HoldStatus } from '../../app/holdTimer';

/**
 * Runs the hold from the moment `minutes` is known. Ticks once a second but always derives the
 * remaining time from the clock (`now`, Date.now by default), so a throttled background tab is
 * right when it wakes. Stops ticking at expiry; `restart` starts a fresh hold.
 */
export function useHoldTimer(
  minutes: number | null,
  now: () => number = Date.now,
  /** False once the panel is closing: no more ticks. */
  active = true,
): { status: HoldStatus | null; restart: () => void } {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(() => now());
  const begin = useCallback(() => {
    const t = now();
    setStartedAt(t);
    setTick(t);
  }, [now]);

  // The hold starts the moment its length is known (adjusting state while rendering, not in an effect).
  if (minutes !== null && startedAt === null) begin();

  const status =
    startedAt !== null && minutes !== null ? holdStatus(startedAt, minutes, tick) : null;
  const expired = status?.phase === 'expired';
  useEffect(() => {
    if (startedAt === null || expired || !active) return;
    const id = setInterval(() => setTick(now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, expired, active, now]);

  return { status, restart: begin };
}
