export type MockScenario = 'normal' | 'loading' | 'empty' | 'error';

export const MOCK_SCENARIOS: readonly MockScenario[] = ['normal', 'loading', 'empty', 'error'];
/** Query parameter and localStorage key that pick the mock scenario in dev. */
export const MOCK_PARAM = 'mock';
export const MOCK_STORAGE_KEY = 'gr.mock';

export interface ApiConfig {
  /** Set: real fetch client against this URL. Null: no usable URL (see `problem`). */
  baseUrl: string | null;
  /** Why `baseUrl` is null. Absent when it is set. */
  problem?: 'missing' | 'invalid';
  scenario: MockScenario;
  warnings: string[];
}

export interface ApiConfigInput {
  apiUrl?: string;
  /** `VITE_MOCK_SCENARIO`. Dev only. */
  envScenario?: string;
  /** `location.search`. Dev only. */
  search?: string;
  /** Value stored under MOCK_STORAGE_KEY. Dev only. */
  stored?: string | null;
  dev: boolean;
}

const asScenario = (value: string | null | undefined): MockScenario | null =>
  MOCK_SCENARIOS.find((s) => s === value?.trim()) ?? null;

const isLocalhost = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');

/**
 * Validates VITE_API_URL: an absolute http(s) URL. Query and hash are dropped and trailing
 * slashes trimmed. Non-HTTPS outside localhost is accepted with a warning.
 */
export function parseApiUrl(
  value: string | undefined,
): Pick<ApiConfig, 'baseUrl' | 'problem' | 'warnings'> {
  const trimmed = value?.trim();
  if (!trimmed) return { baseUrl: null, problem: 'missing', warnings: [] };
  const invalid = (reason: string) => ({
    baseUrl: null,
    problem: 'invalid' as const,
    warnings: [`VITE_API_URL ${reason} (${JSON.stringify(value)}).`],
  });
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return invalid('is not an absolute URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return invalid('must use http or https');
  }
  const warnings: string[] = [];
  if (url.username || url.password) return invalid('must not contain credentials');
  if (url.protocol === 'http:' && !isLocalhost(url.hostname)) {
    warnings.push(`VITE_API_URL uses http outside localhost (${url.origin}); use https.`);
  }
  return { baseUrl: url.origin + url.pathname.replace(/\/+$/, ''), warnings };
}

/**
 * Resolves client configuration. A real base URL needs only `VITE_API_URL`. The mock scenario is
 * a dev tool: precedence is `?mock=` query, then localStorage, then `VITE_MOCK_SCENARIO`, then
 * "normal"; in production builds it is always "normal".
 */
export function resolveApiConfig(input: ApiConfigInput): ApiConfig {
  const url = parseApiUrl(input.apiUrl);
  const scenario = input.dev
    ? (asScenario(new URLSearchParams(input.search ?? '').get(MOCK_PARAM)) ??
      asScenario(input.stored) ??
      asScenario(input.envScenario) ??
      'normal')
    : 'normal';
  return { ...url, scenario };
}
