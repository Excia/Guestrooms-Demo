import { useCallback, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { closureFailure, type ClosureFailure } from '../../app/closures';
import { newRequestId } from '../../lib/requestId';

/**
 * Runs one closure request at a time. The idempotency key is kept while the request body is
 * unchanged, so a retry after an unknown outcome (timeout, network, 5xx) replays instead of
 * saving twice; it is dropped after a definitive answer.
 */
export function useClosureSubmit() {
  const inFlight = useRef(false);
  const attempt = useRef<{ id: string; body: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ClosureFailure | null>(null);

  const run = useCallback(
    async <T>(
      body: unknown,
      call: (requestId: string) => Promise<T>,
      onDone: (result: T) => void,
      onUnknown: () => void,
    ) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setFailure(null);
      const fingerprint = JSON.stringify(body);
      if (attempt.current?.body !== fingerprint) {
        attempt.current = { id: newRequestId(), body: fingerprint };
      }
      let result: Awaited<ReturnType<typeof call>>;
      try {
        result = await call(attempt.current.id);
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 0;
        const code = error instanceof ApiError ? error.code : undefined;
        const failed = closureFailure(status, code);
        setFailure(failed);
        if (failed.unknown) onUnknown();
        else if (!failed.retryable) attempt.current = null;
        inFlight.current = false;
        setSaving(false);
        return;
      }
      attempt.current = null;
      inFlight.current = false;
      setSaving(false);
      // Outside the try: a throw in the caller's handler is not a failed save.
      onDone(result);
    },
    [],
  );
  return { run, saving, failure, clearFailure: () => setFailure(null) };
}
