export type MockScenario = 'normal' | 'loading' | 'empty' | 'error';

export const MOCK_SCENARIOS: readonly MockScenario[] = ['normal', 'loading', 'empty', 'error'];
/** Query parameter and localStorage key that pick the mock scenario in dev. */
export const MOCK_PARAM = 'mock';
export const MOCK_STORAGE_KEY = 'gr.mock';

/** Which client the app runs on. "unavailable" is a misconfigured build that fails every call. */
export type ApiSource = 'http' | 'mock' | 'unavailable';

export interface ApiConfig {
  source: ApiSource;
  /** True when the mock is active in a non-dev build; the UI shows a "Demo data" chip. */
  demo: boolean;
  /** Set: real fetch client against this URL. Null: no usable URL (see `problem`). */
  baseUrl: string | null;
  /** Why `baseUrl` is null. Absent when it is set. */
  problem?: 'missing' | 'invalid';
  scenario: MockScenario;
  warnings: string[];
}

export interface ApiConfigInput {
  apiUrl?: string;
  /** `VITE_API_MODE`. Only "mock" is meaningful: opt in to the mock in any build. */
  apiMode?: string;
  /** `VITE_MOCK_SCENARIO`. Dev, or any build with `apiMode` "mock". */
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
 * Resolves client configuration.
 * - `VITE_API_URL` valid: the real client, in every build. If `VITE_API_MODE=mock` is also set the
 *   URL wins and a warning says so.
 * - Otherwise the mock runs in dev, or in any build with `VITE_API_MODE=mock` (a demo; `demo` is
 *   true outside dev). An invalid URL is never papered over outside dev.
 * - Otherwise (production, no URL, no flag) the client is "unavailable" and fails loudly.
 * Mock scenario precedence in dev: `?mock=`, then localStorage, then `VITE_MOCK_SCENARIO`, then
 * "normal". Outside dev only `VITE_MOCK_SCENARIO` counts, and only together with the mock flag.
 */
export function resolveApiConfig(input: ApiConfigInput): ApiConfig {
  const url = parseApiUrl(input.apiUrl);
  const warnings = [...url.warnings];
  const mockFlag = input.apiMode?.trim() === 'mock';
  let source: ApiSource;
  if (url.baseUrl) {
    source = 'http';
    if (mockFlag) warnings.push('VITE_API_MODE=mock is ignored because VITE_API_URL is set.');
  } else if (input.dev || (mockFlag && url.problem === 'missing')) {
    source = 'mock';
  } else {
    source = 'unavailable';
  }
  const scenarioFromEnv = input.dev || mockFlag ? asScenario(input.envScenario) : null;
  const scenario = input.dev
    ? (asScenario(new URLSearchParams(input.search ?? '').get(MOCK_PARAM)) ??
      asScenario(input.stored) ??
      scenarioFromEnv ??
      'normal')
    : (scenarioFromEnv ?? 'normal');
  return { ...url, warnings, source, demo: source === 'mock' && !input.dev, scenario };
}
