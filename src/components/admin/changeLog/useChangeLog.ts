import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../../api';
import type { ChangeLogEntry, ChangeLogQuery } from '../../../api/changeLogTypes';

export interface ChangeLogState {
  status: 'loading' | 'error' | 'ready';
  /** The rows of the last answer; they stay on screen while the next page loads. */
  items: ChangeLogEntry[];
  total: number;
  retry: () => void;
}

interface Settled {
  /** The request this answer belongs to. */
  request: string;
  failed: boolean;
  items: ChangeLogEntry[];
  total: number;
}

// One page of the log for `query`; a new query aborts the one in flight. Paused while `enabled` is off.
export function useChangeLog(query: ChangeLogQuery, enabled: boolean): ChangeLogState {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  // The query object is rebuilt on every render; its content is what matters.
  const key = JSON.stringify(query);
  const request = `${attempt}:${key}`;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    api.changeLog
      .list(JSON.parse(key) as ChangeLogQuery, { signal: controller.signal })
      .then((page) =>
        setSettled({
          request: `${attempt}:${key}`,
          failed: false,
          items: page.items,
          total: page.total,
        }),
      )
      .catch(() => {
        if (!controller.signal.aborted) {
          setSettled((s) => ({
            request: `${attempt}:${key}`,
            failed: true,
            items: s?.items ?? [],
            total: s?.total ?? 0,
          }));
        }
      });
    return () => controller.abort();
  }, [api, key, enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current = settled?.request === request;
  return {
    status: !current ? 'loading' : settled.failed ? 'error' : 'ready',
    items: settled?.items ?? [],
    total: settled?.total ?? 0,
    retry,
  };
}
