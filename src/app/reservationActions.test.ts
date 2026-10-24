import { ApiError } from '../api/types';
import { menuFailure, menuSuccessMessage } from './reservationActions';

const err = (status: number, code?: string) =>
  new ApiError(status, 'x', code ? { code } : undefined);

describe('menuFailure', () => {
  it('explains the audit rule and reloads', () => {
    expect(menuFailure('undo-check-in', err(409, 'audit-closed'))).toMatchObject({
      refetch: true,
      message: expect.stringContaining('night audit'),
    });
  });
  it('403 is final, a stale version reloads', () => {
    expect(menuFailure('cancel', err(403, 'forbidden'))).toEqual({
      message: 'You may not cancel this reservation.',
      refetch: false,
    });
    expect(menuFailure('cancel', err(409, 'stale')).refetch).toBe(true);
  });
  it('another 4xx is final; a 5xx or network error is an unknown outcome', () => {
    expect(menuFailure('cancel', err(400, 'invalid-query')).refetch).toBe(false);
    expect(menuFailure('cancel', err(500)).refetch).toBe(true);
    expect(menuFailure('cancel', new Error('offline')).refetch).toBe(true);
    expect(menuFailure('cancel', err(408)).refetch).toBe(true);
  });
  it('success copy', () => {
    expect(menuSuccessMessage('cancel', 'GR-1')).toBe('Reservation #GR-1 cancelled.');
  });
});
