import type {
  ApiClient,
  DashboardStats,
  Page,
  PermissionGrant,
  Reservation,
  ReservationQuery,
  RequestOptions,
} from './types';
import { ApiError } from './types';

export interface HttpClientOptions {
  fetch?: typeof fetch;
  /** Per-request timeout. Default 15 s. */
  timeoutMs?: number;
  /** Called on any 401, before the ApiError is thrown (e.g. to start a sign-in redirect). */
  onUnauthorized?: () => void;
  /** Extra headers for every request (e.g. an auth token). */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

function invalid(status: number, what: string): ApiError {
  return new ApiError(status, `Malformed ${what} response`, { code: 'invalid-response' });
}

function parseGrant(body: unknown, status: number): PermissionGrant {
  if (
    !isObject(body) ||
    typeof body.role !== 'string' ||
    !(
      body.permissions === 'all' ||
      (Array.isArray(body.permissions) && body.permissions.every((p) => typeof p === 'string'))
    )
  ) {
    throw invalid(status, 'permissions');
  }
  return body as unknown as PermissionGrant;
}

function parsePage(body: unknown, status: number): Page<Reservation> {
  if (!isObject(body) || !Array.isArray(body.items) || typeof body.total !== 'number') {
    throw invalid(status, 'reservations');
  }
  return body as unknown as Page<Reservation>;
}

function requireObject<T>(what: string) {
  return (body: unknown, status: number): T => {
    if (!isObject(body)) throw invalid(status, what);
    return body as unknown as T;
  };
}

function errorFromBody(status: number, statusText: string, text: string): ApiError {
  let message = statusText || 'Request failed';
  let code: string | undefined;
  let details: Record<string, string[]> | undefined;
  try {
    const body: unknown = JSON.parse(text);
    if (isObject(body)) {
      if (typeof body.message === 'string') message = body.message;
      else if (typeof body.error === 'string') message = body.error;
      if (typeof body.code === 'string') code = body.code;
      if (isObject(body.details)) details = body.details as Record<string, string[]>;
    }
  } catch {
    // Not JSON (e.g. an HTML error page): keep the status text.
  }
  return new ApiError(status, message, { code, details });
}

/**
 * Real client: JSON over fetch against `baseUrl`. The paths are the contract for the backend.
 * `credentials: 'include'` is a placeholder decision until auth is designed.
 */
export function createHttpClient(baseUrl: string, options: HttpClientOptions = {}): ApiClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(
    path: string,
    params: Record<string, string | undefined>,
    requestOptions: RequestOptions | undefined,
    parse: (body: unknown, status: number) => T,
  ): Promise<T> {
    const url = new URL(baseUrl + path, globalThis.location?.origin);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }

    // Abort on the caller's signal or on timeout; remember which, to tell them apart.
    const controller = new AbortController();
    const callerSignal = requestOptions?.signal;
    let timedOut = false;
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) onCallerAbort();
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    let response: Response;
    let text: string;
    try {
      const extra = (await options.getHeaders?.()) ?? {};
      if (controller.signal.aborted)
        throw new DOMException('The operation was aborted.', 'AbortError');
      response = await (options.fetch ?? fetch)(url, {
        headers: { Accept: 'application/json', ...extra },
        credentials: 'include',
        signal: controller.signal,
      });
      text = await response.text();
    } catch (error) {
      if (timedOut && !callerSignal?.aborted) {
        throw new ApiError(0, 'Request timed out', { code: 'timeout' });
      }
      if (isAbort(error) || callerSignal?.aborted) {
        throw error instanceof Error && isAbort(error)
          ? error
          : new DOMException('The operation was aborted.', 'AbortError');
      }
      throw new ApiError(0, 'Network error', { code: 'network' });
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }

    if (!response.ok) {
      if (response.status === 401) options.onUnauthorized?.();
      throw errorFromBody(response.status, response.statusText, text);
    }

    // 204 and empty bodies parse as `undefined`; each parser decides whether that is valid.
    let body: unknown;
    if (text.trim() !== '') {
      try {
        body = JSON.parse(text);
      } catch {
        throw new ApiError(response.status, 'Response was not JSON', { code: 'invalid-response' });
      }
    }
    return parse(body, response.status);
  }

  return {
    dashboard: {
      getStats: (o) =>
        request('/dashboard/stats', {}, o, requireObject<DashboardStats>('dashboard stats')),
    },
    reservations: {
      list: (q: ReservationQuery = {}, o) =>
        request(
          '/reservations',
          {
            status: q.status,
            search: q.search,
            arrivalFrom: q.arrivalFrom,
            arrivalTo: q.arrivalTo,
            departureFrom: q.departureFrom,
            departureTo: q.departureTo,
            sort: q.sort && `${q.sort.field}:${q.sort.direction}`,
            cursor: q.cursor,
            limit: q.limit === undefined ? undefined : String(q.limit),
          },
          o,
          parsePage,
        ),
      get: (id, o) =>
        request(
          `/reservations/${encodeURIComponent(id)}`,
          {},
          o,
          requireObject<Reservation>('reservation'),
        ),
    },
    permissions: { getGrant: (o) => request('/permissions/me', {}, o, parseGrant) },
  };
}
