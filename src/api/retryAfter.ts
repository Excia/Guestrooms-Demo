import type { ApiError } from './types';

/** The wait in seconds an error carries in `details.retryAfterSeconds` (set from the body or the Retry-After header), or undefined. */
export function retryAfterOf(error: ApiError): number | undefined {
  const n = Number(error.details?.retryAfterSeconds?.[0]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
