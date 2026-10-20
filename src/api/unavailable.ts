import type { ApiClient } from './types';
import { ApiError } from './types';

/** Client for a misconfigured build: every call rejects with `error`, so nothing fakes success. */
export function createUnavailableClient(error: ApiError): ApiClient {
  const fail = () => Promise.reject(error);
  return {
    dashboard: { getStats: fail, getQuickStats: fail },
    reservations: { list: fail, get: fail },
    permissions: { getGrant: fail },
    schedule: { get: fail, moveRoom: fail, moveDates: fail },
  };
}
