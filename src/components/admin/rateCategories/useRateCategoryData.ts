import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../../api';
import type { RateCategoryOptions, RateCategorySetup } from '../../../api/types';

export interface RateCategoryData {
  status: 'loading' | 'error' | 'ready';
  options: RateCategoryOptions | null;
  categories: RateCategorySetup[];
  /** Retry after a load error. */
  reload: () => void;
  /** Re-reads the list after a save, duplicate or delete. */
  refresh: () => Promise<void>;
  /** Updates the list locally (when a refresh fails after the change was stored). */
  patch: (change: (list: RateCategorySetup[]) => RateCategorySetup[]) => void;
}

// Options (SKUs, room types) and the category list load together.
export function useRateCategoryData(): RateCategoryData {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: RateCategoryData['status'];
    options: RateCategoryOptions | null;
    categories: RateCategorySetup[];
  }>({ status: 'loading', options: null, categories: [] });

  useEffect(() => {
    const controller = new AbortController();
    const signal = { signal: controller.signal };
    Promise.all([api.rateCategories.getOptions(signal), api.rateCategories.list(signal)])
      .then(([options, categories]) => setState({ status: 'ready', options, categories }))
      .catch(() => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, status: 'error' }));
      });
    return () => controller.abort();
  }, [api, attempt]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }));
    setAttempt((n) => n + 1);
  }, []);

  const refresh = useCallback(async () => {
    const categories = await api.rateCategories.list();
    setState((s) => ({ ...s, categories }));
  }, [api]);

  const patch = useCallback((change: (list: RateCategorySetup[]) => RateCategorySetup[]) => {
    setState((s) => ({ ...s, categories: change(s.categories) }));
  }, []);

  return { ...state, reload, refresh, patch };
}
