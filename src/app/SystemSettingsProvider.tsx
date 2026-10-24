import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApi } from '../api';
import type { ApiClient, SystemSettings } from '../api/types';
import { SystemSettingsContext, type SystemSettingsState } from './systemSettingsContext';

interface Loaded {
  /** The client this result belongs to; a result for another client is never served. */
  api: ApiClient;
  status: 'loading' | 'ready' | 'error';
  settings: SystemSettings | null;
}

/**
 * Holds the club's System Settings (ticket 7.1) for the whole app: the early/late switch, the
 * Room Owner field, Print Registration Card and so on read it through `useSystemSettings()`.
 * The first consumer starts the fetch (pages that never read it cost no request); saving on the
 * System Settings page calls `apply`, which updates every consumer.
 */
export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const applied = useRef<SystemSettings | null>(null);

  useEffect(() => {
    if (!requested) return;
    const controller = new AbortController();
    api.systemSettings
      .get({ signal: controller.signal })
      .then((settings) => {
        // A save that landed while this fetch was running is newer than the fetch.
        if (!controller.signal.aborted) {
          setLoaded({ api, status: 'ready', settings: applied.current ?? settings });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ api, status: 'error', settings: null });
      });
    return () => controller.abort();
  }, [api, requested, attempt]);

  const load = useCallback(() => setRequested(true), []);
  const reload = useCallback(() => {
    setLoaded(null);
    setRequested(true);
    setAttempt((n) => n + 1);
  }, []);
  const apply = useCallback(
    (saved: SystemSettings) => {
      applied.current = saved;
      setLoaded({ api, status: 'ready', settings: saved });
    },
    [api],
  );

  const current = loaded?.api === api ? loaded : null;
  const value = useMemo<SystemSettingsState>(
    () => ({
      provided: true,
      status: current?.status ?? (requested ? 'loading' : 'idle'),
      settings: current?.settings ?? null,
      load,
      reload,
      apply,
    }),
    [current, requested, load, reload, apply],
  );
  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>;
}
