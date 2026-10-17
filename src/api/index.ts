import { resolveApiConfig, MOCK_STORAGE_KEY } from './config';
import type { ApiConfig } from './config';
import { createHttpClient } from './http';
import { createMockClient } from './mock';
import type { ApiClient } from './types';

export * from './types';
export { createMockClient, createHttpClient, resolveApiConfig };
export { permissionsFromGrant } from './grant';
export { ApiProvider, useApi } from './ApiProvider';

const MOCK_LATENCY_MS = 300;

export function createApiClient(config: ApiConfig): ApiClient {
  return config.baseUrl
    ? createHttpClient(config.baseUrl)
    : createMockClient({ scenario: config.scenario, latencyMs: MOCK_LATENCY_MS });
}

/** Builds the app's client from Vite env, the URL and localStorage. */
export function createApiClientFromEnvironment(): ApiClient {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(MOCK_STORAGE_KEY);
  } catch {
    // storage unavailable (private mode); ignore
  }
  const config = resolveApiConfig({
    apiUrl: import.meta.env.VITE_API_URL,
    envScenario: import.meta.env.VITE_MOCK_SCENARIO,
    search: window.location.search,
    stored,
    dev: import.meta.env.DEV,
  });
  if (import.meta.env.DEV && !config.baseUrl && config.scenario !== 'normal') {
    console.info(`[api] mock scenario: ${config.scenario}`);
  }
  return createApiClient(config);
}
