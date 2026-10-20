import { MOCK_STORAGE_KEY, resolveApiConfig } from './config';
import type { ApiConfig } from './config';
import { createHttpClient } from './http';
import { createLazyClient } from './lazy';
import { DEMO_MOCK_USER, MOCK_USER_STORAGE_KEY, resolveMockUser } from './mockUsers';
import { createUnavailableClient } from './unavailable';
import type { ApiClient } from './types';
import { ApiError } from './types';

export * from './types';
export { ApiProvider, useApi } from './ApiProvider';
export { permissionsFromGrant } from './grant';

const MOCK_LATENCY_MS = 300;

type Log = Pick<Console, 'warn' | 'error' | 'info'>;

export interface ApiSetup {
  client: ApiClient;
  /** The mock is active in a non-dev build: show the "Demo data" chip. */
  demo: boolean;
  /** Dev build on the mock client: the mock user switcher applies. */
  devMock: boolean;
}

/**
 * Picks the client for a resolved config (see `resolveApiConfig` for the rules). The mock and its
 * data are loaded lazily, so builds pointed at a real URL never fetch that chunk.
 */
export function createApiClient(
  config: ApiConfig,
  log: Log = console,
  /** `mockUser`: stored mock user id (dev only); unknown or absent means the non-admin user. */
  { mockUser }: { mockUser?: string | null } = {},
): ApiSetup {
  for (const warning of config.warnings) log.warn(`[api] ${warning}`);
  if (config.source === 'http' && config.baseUrl) {
    return { client: createHttpClient(config.baseUrl), demo: false, devMock: false };
  }
  if (config.source === 'mock') {
    log.info(`[api] using the mock client (scenario: ${config.scenario}).`);
    const { scenario } = config;
    const { grant } = config.demo ? DEMO_MOCK_USER : resolveMockUser(mockUser);
    const client = createLazyClient(async () =>
      (await import('./mock')).createMockClient({ scenario, latencyMs: MOCK_LATENCY_MS, grant }),
    );
    return { client, demo: config.demo, devMock: !config.demo };
  }
  const message =
    config.problem === 'invalid'
      ? 'VITE_API_URL is invalid; the API is unavailable.'
      : 'VITE_API_URL is not set and VITE_API_MODE is not "mock"; the API is unavailable.';
  log.error(`[api] ${message}`);
  return {
    client: createUnavailableClient(new ApiError(0, message, { code: 'misconfigured' })),
    demo: false,
    devMock: false,
  };
}

export interface EnvironmentSources {
  env?: Pick<ImportMetaEnv, 'VITE_API_URL' | 'VITE_API_MODE' | 'VITE_MOCK_SCENARIO' | 'DEV'>;
  search?: string;
  storage?: Pick<Storage, 'getItem'>;
  log?: Log;
}

/** Builds the app's client from Vite env, the URL and localStorage. */
export function createApiClientFromEnvironment({
  env = import.meta.env,
  search = window.location.search,
  storage,
  log,
}: EnvironmentSources = {}): ApiSetup {
  let stored: string | null = null;
  let storedUser: string | null = null;
  if (env.DEV) {
    try {
      stored = (storage ?? window.localStorage).getItem(MOCK_STORAGE_KEY);
      storedUser = (storage ?? window.localStorage).getItem(MOCK_USER_STORAGE_KEY);
    } catch {
      // storage unavailable (private mode); ignore
    }
  }
  const config = resolveApiConfig({
    apiUrl: env.VITE_API_URL,
    apiMode: env.VITE_API_MODE,
    envScenario: env.VITE_MOCK_SCENARIO,
    search,
    stored,
    dev: env.DEV,
  });
  return createApiClient(config, log, { mockUser: storedUser });
}
