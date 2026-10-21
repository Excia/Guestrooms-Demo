import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api';
import type { ReservationDetail } from '../../api';
import { ApiError } from '../../api';

export type DetailState =
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean }
  | { status: 'success'; detail: ReservationDetail };

/**
 * Loads one reservation's detail; a changed id or `retry` refetches (the stale request is aborted).
 * A raised `refreshToken` reloads it in place: what is on screen stays until the new answer arrives
 * (the room changed during the stay, for example), so focus and the open sections are kept.
 */
export function useReservationDetail(
  id: string,
  refreshToken = 0,
): DetailState & {
  retry: () => void;
  /** Replace the loaded detail (after a reload that an early/late failure triggered). */
  replace: (detail: ReservationDetail) => void;
} {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: DetailState } | null>(null);
  const key = `${id}|${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    api.reservations.getDetail(id, { signal: controller.signal }).then(
      (detail) => {
        if (!controller.signal.aborted) setResult({ key, state: { status: 'success', detail } });
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
  }, [api, id, key]);

  useEffect(() => {
    if (refreshToken === 0) return;
    const controller = new AbortController();
    api.reservations.getDetail(id, { signal: controller.signal }).then(
      (detail) => {
        if (controller.signal.aborted) return;
        setResult((r) => (r ? { ...r, state: { status: 'success', detail } } : r));
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setResult((r) =>
          r
            ? {
                ...r,
                state: {
                  status: 'error',
                  notFound: error instanceof ApiError && error.status === 404,
                },
              }
            : r,
        );
      },
    );
    return () => controller.abort();
  }, [api, id, refreshToken]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const replace = useCallback(
    (detail: ReservationDetail) =>
      setResult((r) => (r ? { ...r, state: { status: 'success', detail } } : r)),
    [],
  );
  const state: DetailState = result?.key === key ? result.state : { status: 'loading' };
  return { ...state, retry, replace };
}
