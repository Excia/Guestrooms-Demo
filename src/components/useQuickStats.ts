import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../api';
import type { QuickStats, QuickStatsView } from '../api';
import { quickStatsQuery } from '../app/quickStats';

export type QuickStatsState =
  /** Nothing to show yet for this view (first load). */
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  /** `refreshing`: `data` is the previous answer for this view while the new one loads. */
  | { status: 'success'; data: QuickStats; refreshing: boolean };

interface Settled {
  /** Which request this result answers; anything else means a newer request is pending. */
  key: string;
  result: { status: 'success'; data: QuickStats } | { status: 'error'; error: unknown };
}

/**
 * Fetches Quick Stats for one view and its period (a date, a week's start or a `yyyy-mm` month).
 * Changing either refetches and aborts the stale request; `retry` refetches after an error.
 * Stale-while-revalidate: while a new period loads, the last answer for that view stays
 * (`refreshing`); the skeleton is only for a view that has no answer yet. An answer for another
 * request is never shown as current, and a late answer for an aborted one is dropped.
 */
export function useQuickStats(
  view: QuickStatsView,
  period: string,
): QuickStatsState & { retry: () => void } {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [last, setLast] = useState<Partial<Record<QuickStatsView, QuickStats>>>({});
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
        if (controller.signal.aborted) return;
        setSettled({ key, result });
        if (result.status === 'success') setLast((l) => ({ ...l, [view]: result.data }));
      });
    return () => controller.abort();
  }, [api, view, period, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  let state: QuickStatsState;
  if (settled?.key === key) {
    state =
      settled.result.status === 'success'
        ? { status: 'success', data: settled.result.data, refreshing: false }
        : settled.result;
  } else {
    const previous = last[view];
    state = previous
      ? { status: 'success', data: previous, refreshing: true }
      : { status: 'loading' };
  }
  return { ...state, retry };
}
