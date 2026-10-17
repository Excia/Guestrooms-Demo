import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { createMockClient } from './mock';
import type { ApiClient } from './types';

// Default is a fast mock so components render in tests without a provider.
const ApiContext = createContext<ApiClient>(createMockClient());

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  const [stable] = useState(client);
  return <ApiContext.Provider value={stable}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  return useContext(ApiContext);
}
