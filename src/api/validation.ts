import { ApiError } from './types';

/** Ids go into URL paths; "." and ".." would escape the resource path even after encoding. */
export function assertResourceId(id: string, what: string): void {
  if (typeof id !== 'string' || id.trim() === '' || id === '.' || id === '..') {
    throw new ApiError(400, `Invalid ${what} id`, { code: 'invalid-id' });
  }
}
