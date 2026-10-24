import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../../api';
import type { AddOnOptions, AddOnSetup } from '../../../api/types';

export interface AddOnData {
  status: 'loading' | 'error' | 'ready';
  options: AddOnOptions | null;
  addOns: AddOnSetup[];
  /** Retry after a load error. */
  reload: () => void;
  /** Re-reads the list after a save or delete. */
  refresh: () => Promise<void>;
  /** Updates the list locally (when a refresh fails after the change was stored). */
  patch: (change: (list: AddOnSetup[]) => AddOnSetup[]) => void;
}

// Options (SKUs, locations, room types) and the add-on list load together.
export function useAddOnData(): AddOnData {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: AddOnData['status'];
    options: AddOnOptions | null;
    addOns: AddOnSetup[];
  }>({ status: 'loading', options: null, addOns: [] });

  useEffect(() => {
    const controller = new AbortController();
    const signal = { signal: controller.signal };
    Promise.all([api.addOns.getOptions(signal), api.addOns.list(signal)])
      .then(([options, addOns]) => setState({ status: 'ready', options, addOns }))
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
    const addOns = await api.addOns.list();
    setState((s) => ({ ...s, addOns }));
  }, [api]);

  const patch = useCallback((change: (list: AddOnSetup[]) => AddOnSetup[]) => {
    setState((s) => ({ ...s, addOns: change(s.addOns) }));
  }, []);

  return { ...state, reload, refresh, patch };
}
