import { MOCK_STORAGE_KEY, resolveApiConfig } from './config';
import type { ApiConfig } from './config';
import { createHttpClient } from './http';
import { createMockClient } from './mock';
import { createUnavailableClient } from './unavailable';
import type { ApiClient } from './types';
import { ApiError } from './types';

export * from './types';
export { ApiProvider, useApi } from './ApiProvider';
export { permissionsFromGrant } from './grant';

const MOCK_LATENCY_MS = 300;

/**
 * Real client when there is a base URL. The mock only when the URL is absent or invalid in dev.
 * In a production build a missing or invalid URL yields a client whose calls all reject, so a
 * misconfigured deploy fails visibly instead of serving mock data.
 */
export function createApiClient(
  config: ApiConfig,
  { dev, log = console }: { dev: boolean; log?: Pick<Console, 'warn' | 'error' | 'info'> },
): ApiClient {
  for (const warning of config.warnings) log.warn(`[api] ${warning}`);
  if (config.baseUrl) return createHttpClient(config.baseUrl);
  if (dev) {
    log.info(`[api] using the mock client (scenario: ${config.scenario}).`);
    return createMockClient({ scenario: config.scenario, latencyMs: MOCK_LATENCY_MS });
  }
  const message =
    config.problem === 'invalid'
      ? 'VITE_API_URL is invalid; the API is unavailable.'
      : 'VITE_API_URL is not set; the API is unavailable.';
  log.error(`[api] ${message}`);
  return createUnavailableClient(new ApiError(0, message, { code: 'misconfigured' }));
}

export interface EnvironmentSources {
  env?: Pick<ImportMetaEnv, 'VITE_API_URL' | 'VITE_MOCK_SCENARIO' | 'DEV'>;
  search?: string;
  storage?: Pick<Storage, 'getItem'>;
  log?: Pick<Console, 'warn' | 'error' | 'info'>;
}

/** Builds the app's client from Vite env, the URL and localStorage. */
export function createApiClientFromEnvironment({
  env = import.meta.env,
  search = window.location.search,
  storage,
  log,
}: EnvironmentSources = {}): ApiClient {
  let stored: string | null = null;
  if (env.DEV) {
    try {
      stored = (storage ?? window.localStorage).getItem(MOCK_STORAGE_KEY);
    } catch {
      // storage unavailable (private mode); ignore
    }
  }
  const config = resolveApiConfig({
    apiUrl: env.VITE_API_URL,
    envScenario: env.VITE_MOCK_SCENARIO,
    search,
    stored,
    dev: env.DEV,
  });
  return createApiClient(config, { dev: env.DEV, log });
}
