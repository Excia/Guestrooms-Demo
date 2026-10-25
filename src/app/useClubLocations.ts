import { useEffect, useState } from 'react';
import { useOptionalApi } from '../api/ApiProvider';
import type { SearchLocation } from './placeholderLocations';

/**
 * The club's locations for a search form: null while loading, without an API or when the load
 * failed (the form then offers no location choice and searches every location).
 */
export function useClubLocations(): SearchLocation[] | null {
  const api = useOptionalApi();
  const [locations, setLocations] = useState<SearchLocation[] | null>(null);
  useEffect(() => {
    if (!api) return;
    const controller = new AbortController();
    api.locations
      .list({ signal: controller.signal })
      .then((list) => setLocations(list.map((l) => ({ id: l.id, name: l.name }))))
      .catch(() => undefined);
    return () => controller.abort();
  }, [api]);
  return locations;
}
