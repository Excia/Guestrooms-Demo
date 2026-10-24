import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { newRequestId } from '../../lib/requestId';

export type SaveResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** No answer, a timeout or a server error: the request may have been applied. */
export const outcomeIsUnknown = (error: unknown): boolean =>
  !(error instanceof ApiError) || error.status === 408 || error.status >= 500;

/**
 * One save at a time for the edit panel (add room, guests, notes). `fingerprint` describes the
 * request body: while it is unchanged, a retry after an unknown outcome reuses the idempotency key,
 * so a request that was in fact applied is replayed instead of repeated. A definitive answer drops
 * the key. A second call while one is in flight is ignored (null). Late answers after the panel is
 * gone are still returned (the caller decides what to touch), but `busy` is not set on it.
 */
export function useIdempotentSave() {
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  const mounted = useRef(true);
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async <T>(
      fingerprint: string,
      send: (requestId: string) => Promise<T>,
    ): Promise<SaveResult<T> | null> => {
      if (inflight.current) return null;
      inflight.current = true;
      setBusy(true);
      const id = attempt.current?.fingerprint === fingerprint ? attempt.current.id : newRequestId();
      attempt.current = null;
      try {
        const value = await send(id);
        return { ok: true, value };
      } catch (error) {
        if (outcomeIsUnknown(error)) attempt.current = { fingerprint, id };
        return { ok: false, error };
      } finally {
        inflight.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [],
  );

  return { busy, run, isMounted: () => mounted.current };
}
