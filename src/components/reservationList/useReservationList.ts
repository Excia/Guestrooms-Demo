import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api';
import type {
  Page,
  ReservationListOptions,
  ReservationListQuery,
  ReservationListRow,
} from '../../api';

export type ReservationListState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  /** `refreshing`: `page` is the previous answer while a changed query loads. */
  | { status: 'success'; page: Page<ReservationListRow>; refreshing: boolean };

interface Settled {
  key: string;
  page?: Page<ReservationListRow>;
  error?: unknown;
}

/**
 * Fetches one page of the Reservation List for `query` (filter, sort and paging are the server's).
 * A changed query aborts the stale request; the last answer stays on screen, dimmed by the caller
 * through `refreshing`, so the table does not flash empty between pages. `queryKey` identifies
 * the query (a stable string), since the query object itself changes identity on every render.
 */
export function useReservationList(
  query: ReservationListQuery,
  queryKey: string,
  /** Changing it fetches the same query again, keeping the last answer on screen meanwhile. */
  reloadToken = 0,
): ReservationListState & { retry: () => void } {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [last, setLast] = useState<Page<ReservationListRow> | null>(null);
  const key = `${queryKey}|${attempt}|${reloadToken}`;

  useEffect(() => {
    const controller = new AbortController();
    api.reservationList.list(query, { signal: controller.signal }).then(
      (page) => {
        if (controller.signal.aborted) return;
        setLast(page);
        setSettled({ key, page });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setSettled({ key, error });
      },
    );
    return () => controller.abort();
    // `query` is described by `queryKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key]);

  const retry = useCallback(() => {
    setLast(null);
    setAttempt((n) => n + 1);
  }, []);

  const current = settled?.key === key ? settled : null;
  let state: ReservationListState;
  if (current && current.page === undefined) state = { status: 'error', error: current.error };
  else if (current?.page) state = { status: 'success', page: current.page, refreshing: false };
  else if (last) state = { status: 'success', page: last, refreshing: true };
  else state = { status: 'loading' };
  return { ...state, retry };
}

export type OptionsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; options: ReservationListOptions };

/** The value lists of the filters; a failure leaves the lists empty and the table still usable. */
export function useReservationListOptions(): OptionsState {
  const api = useApi();
  const [state, setState] = useState<OptionsState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    api.reservationList.getOptions({ signal: controller.signal }).then(
      (options) => {
        if (!controller.signal.aborted) setState({ status: 'success', options });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [api]);
  return state;
}
