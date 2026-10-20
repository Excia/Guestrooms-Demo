import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../api';
import type { QuickStats, QuickStatsView } from '../api';
import { quickStatsQuery } from '../app/quickStats';

export type QuickStatsState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: QuickStats };

interface Settled {
  /** Which request this result answers; anything else means a newer request is pending. */
  key: string;
  result: Exclude<QuickStatsState, { status: 'loading' }>;
}

/**
 * Fetches Quick Stats for one view and its period (a date, a week's start or a `yyyy-mm` month).
 * Changing either refetches and aborts the stale request; `retry` refetches after an error.
 * A result for another request is never shown: until the new one settles the state is "loading".
 */
export function useQuickStats(
  view: QuickStatsView,
  period: string,
): QuickStatsState & { retry: () => void } {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const key = `${view}|${period}|${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    api.dashboard
      .getQuickStats(quickStatsQuery(view, period), { signal: controller.signal })
      .then(
        (data) => ({ status: 'success', data }) as const,
        (error: unknown) => ({ status: 'error', error }) as const,
      )
      .then((result) => {
        if (!controller.signal.aborted) setSettled({ key, result });
      });
    return () => controller.abort();
  }, [api, view, period, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state: QuickStatsState = settled?.key === key ? settled.result : { status: 'loading' };
  return { ...state, retry };
}
