import type { ApiClient } from './types';

/**
 * An ApiClient that loads its implementation on first use, so code behind `load` (the mock and
 * its data) lands in a separate chunk and real-URL builds never fetch it.
 */
export function createLazyClient(load: () => Promise<ApiClient>): ApiClient {
  let loaded: Promise<ApiClient> | undefined;
  const client = () =>
    (loaded ??= load().catch((error) => {
      loaded = undefined; // let the next call retry
      throw error;
    }));
  return {
    dashboard: { getStats: (o) => client().then((c) => c.dashboard.getStats(o)) },
    reservations: {
      list: (q, o) => client().then((c) => c.reservations.list(q, o)),
      get: (id, o) => client().then((c) => c.reservations.get(id, o)),
    },
    permissions: { getGrant: (o) => client().then((c) => c.permissions.getGrant(o)) },
  };
}
