import { useCallback, useEffect, useState } from 'react';
import { ApiError, useApi } from '../../api';
import type { Folio } from '../../api';

export type FolioState =
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean }
  | { status: 'success'; folio: Folio };

/** Loads one reservation's folio; a changed id or `retry` refetches (the stale request is aborted). */
export function useFolio(reservationId: string): FolioState & {
  retry: () => void;
  /** Replace the loaded folio (after a post returned the updated one). */
  replace: (folio: Folio) => void;
} {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: FolioState } | null>(null);
  const key = `${reservationId}|${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    api.folios.get(reservationId, { signal: controller.signal }).then(
      (folio) => {
        if (!controller.signal.aborted) setResult({ key, state: { status: 'success', folio } });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          key,
          state: { status: 'error', notFound: error instanceof ApiError && error.status === 404 },
        });
      },
    );
    return () => controller.abort();
  }, [api, reservationId, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const replace = useCallback(
    (folio: Folio) => setResult((r) => (r ? { ...r, state: { status: 'success', folio } } : r)),
    [],
  );
  const state: FolioState = result?.key === key ? result.state : { status: 'loading' };
  return { ...state, retry, replace };
}
