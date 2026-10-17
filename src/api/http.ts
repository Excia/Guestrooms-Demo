import type {
  ApiClient,
  PermissionGrant,
  Reservation,
  ReservationQuery,
  DashboardStats,
} from './types';
import { ApiError } from './types';

/** Real client: plain JSON over fetch against `baseUrl`. Paths are the contract for the backend. */
export function createHttpClient(baseUrl: string, fetchImpl: typeof fetch = fetch): ApiClient {
  async function request<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    const url = new URL(baseUrl + path, globalThis.location?.origin);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) url.searchParams.set(key, value);
    }
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
    } catch {
      throw new ApiError(0, 'Network error');
    }
    if (!response.ok) throw new ApiError(response.status, response.statusText || 'Request failed');
    return (await response.json()) as T;
  }

  return {
    dashboard: { getStats: () => request<DashboardStats>('/dashboard/stats') },
    reservations: {
      list: (q: ReservationQuery = {}) =>
        request<Reservation[]>('/reservations', { status: q.status, search: q.search }),
      get: (id) => request<Reservation>(`/reservations/${encodeURIComponent(id)}`),
    },
    permissions: { getGrant: () => request<PermissionGrant>('/permissions/me') },
  };
}
