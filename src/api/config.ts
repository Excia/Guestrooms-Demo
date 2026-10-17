export type MockScenario = 'normal' | 'loading' | 'empty' | 'error';

export const MOCK_SCENARIOS: readonly MockScenario[] = ['normal', 'loading', 'empty', 'error'];
/** Query parameter and localStorage key that pick the mock scenario in dev. */
export const MOCK_PARAM = 'mock';
export const MOCK_STORAGE_KEY = 'gr.mock';

export interface ApiConfig {
  /** Set: real fetch client against this URL. Null: in-memory mock. */
  baseUrl: string | null;
  scenario: MockScenario;
}

export interface ApiConfigInput {
  apiUrl?: string;
  /** `VITE_MOCK_SCENARIO`: default scenario for the mock. */
  envScenario?: string;
  /** `location.search`. */
  search?: string;
  /** Value stored under MOCK_STORAGE_KEY. */
  stored?: string | null;
  /** Query param and storage overrides apply in dev only. */
  dev: boolean;
}

const asScenario = (value: string | null | undefined): MockScenario | null =>
  MOCK_SCENARIOS.find((s) => s === value?.trim()) ?? null;

/**
 * Resolves client configuration. A real base URL needs only `VITE_API_URL`. Mock scenario
 * precedence (dev): `?mock=` query, then localStorage, then `VITE_MOCK_SCENARIO`, then "normal".
 */
export function resolveApiConfig(input: ApiConfigInput): ApiConfig {
  const baseUrl = input.apiUrl?.trim().replace(/\/+$/, '') || null;
  const fromQuery = input.dev
    ? asScenario(new URLSearchParams(input.search ?? '').get(MOCK_PARAM))
    : null;
  const fromStorage = input.dev ? asScenario(input.stored) : null;
  const scenario = fromQuery ?? fromStorage ?? asScenario(input.envScenario) ?? 'normal';
  return { baseUrl, scenario };
}
