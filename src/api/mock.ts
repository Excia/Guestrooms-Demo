import type { MockScenario } from './config';
import { emptyStats, fullGrant, mockReservations, mockStats, noGrant } from './mockData';
import type { ApiClient, Reservation, ReservationQuery } from './types';
import { ApiError } from './types';

export interface MockOptions {
  scenario?: MockScenario;
  /** Simulated network delay in ms. Tests pass 0. */
  latencyMs?: number;
}

export function filterReservations(
  all: readonly Reservation[],
  query: ReservationQuery = {},
): Reservation[] {
  const needle = query.search?.trim().toLowerCase();
  return all.filter(
    (r) =>
      (!query.status || r.status === query.status) &&
      (!needle ||
        r.guestName.toLowerCase().includes(needle) ||
        r.confirmationNumber.toLowerCase().includes(needle)),
  );
}

/**
 * In-memory ApiClient. Scenarios: "normal" data, "empty" data, "error" (every call rejects with
 * a 500) and "loading" (calls never settle, so the UI stays in its loading state).
 */
export function createMockClient({
  scenario = 'normal',
  latencyMs = 0,
}: MockOptions = {}): ApiClient {
  function respond<T>(normal: () => T, empty: () => T): Promise<T> {
    if (scenario === 'loading') return new Promise<T>(() => {});
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        try {
          if (scenario === 'error') throw new ApiError(500, 'Mock server error');
          resolve(scenario === 'empty' ? empty() : normal());
        } catch (error) {
          reject(error);
        }
      }, latencyMs);
    });
  }

  return {
    dashboard: {
      getStats: () =>
        respond(
          () => structuredClone(mockStats),
          () => structuredClone(emptyStats),
        ),
    },
    reservations: {
      list: (query) =>
        respond(
          () => filterReservations(mockReservations, query),
          () => [],
        ),
      get: (id) =>
        respond(
          () => {
            const found = mockReservations.find((r) => r.id === id);
            if (!found) throw new ApiError(404, 'Reservation not found');
            return { ...found };
          },
          () => {
            throw new ApiError(404, 'Reservation not found');
          },
        ),
    },
    permissions: {
      getGrant: () =>
        respond(
          () => ({ ...fullGrant }),
          () => ({ ...noGrant }),
        ),
    },
  };
}
