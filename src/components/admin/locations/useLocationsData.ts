import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../../api';
import type { LocationSetup, LookupRef } from '../../../api/types';

export interface LocationsData {
  status: 'loading' | 'error' | 'ready';
  locations: LocationSetup[];
  areas: LookupRef[];
  /** Retry after a load error. */
  reload: () => void;
  /** Takes the list the server answered a save with. */
  setLocations: (locations: LocationSetup[]) => void;
}

// The saved locations and the areas to choose from load together.
export function useLocationsData(): LocationsData {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: LocationsData['status'];
    locations: LocationSetup[];
    areas: LookupRef[];
  }>({ status: 'loading', locations: [], areas: [] });

  useEffect(() => {
    const controller = new AbortController();
    const signal = { signal: controller.signal };
    Promise.all([api.locations.list(signal), api.locations.listAreas(signal)])
      .then(([locations, areas]) => setState({ status: 'ready', locations, areas }))
      .catch(() => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, status: 'error' }));
      });
    return () => controller.abort();
  }, [api, attempt]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }));
    setAttempt((n) => n + 1);
  }, []);
  const setLocations = useCallback(
    (locations: LocationSetup[]) => setState((s) => ({ ...s, locations })),
    [],
  );
  return { ...state, reload, setLocations };
}
