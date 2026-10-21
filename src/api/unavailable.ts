import type { ApiClient } from './types';
import { ApiError } from './types';

/**
 * Client for a misconfigured build: every call rejects with `error`, so nothing fakes success.
 * Areas and methods are answered by name, so a new endpoint needs no entry here.
 */
export function createUnavailableClient(error: ApiError): ApiClient {
  const fail = () => Promise.reject(error);
  const area = new Proxy(
    {},
    {
      get: (_target, method) =>
        typeof method === 'symbol' || method === 'then' ? undefined : fail,
    },
  );
  return new Proxy({} as ApiClient, {
    get: (_target, name) => (typeof name === 'symbol' || name === 'then' ? undefined : area),
  });
}
