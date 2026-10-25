import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { ApiClient } from './types';

// No default: a missing provider must fail loudly rather than serve mock data.
const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

/** The client when there is a provider, else null (for components that can do without data). */
export function useOptionalApi(): ApiClient | null {
  return useContext(ApiContext);
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi must be used inside <ApiProvider>.');
  return client;
}
