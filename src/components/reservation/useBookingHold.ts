import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api';
import type { BookingHold } from '../../api';

export type BookingHoldState =
  { status: 'loading' } | { status: 'error' } | { status: 'success'; hold: BookingHold };

/** The "Reservation Hold" minutes from Booking Rules (ticket 7.5), read once when the panel opens. */
export function useBookingHold(): BookingHoldState & { retry: () => void } {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; state: BookingHoldState } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api.settings.getBookingHold({ signal: controller.signal }).then(
      (hold) => {
        if (!controller.signal.aborted) setResult({ attempt, state: { status: 'success', hold } });
      },
      () => {
        if (!controller.signal.aborted) setResult({ attempt, state: { status: 'error' } });
      },
    );
    return () => controller.abort();
  }, [api, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state: BookingHoldState =
    result?.attempt === attempt ? result.state : { status: 'loading' };
  return { ...state, retry };
}
