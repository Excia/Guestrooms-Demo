// What the user is told when Cancel Reservation or Undo Check In fails (ticket 2.5), and whether the
// reservation must be reloaded. Pure.
import { ApiError } from '../api/types';

export type MenuMutation = 'cancel' | 'undo-check-in';

export interface MenuFailure {
  message: string;
  /** The reservation may have changed (or the outcome is unknown): load it again. */
  refetch: boolean;
  /** The request may have been applied (no answer, 408 or 5xx): a retry reuses its idempotency key. */
  outcomeUnknown?: boolean;
}

export const menuSuccessMessage = (kind: MenuMutation, confirmationNumber: string) =>
  kind === 'cancel'
    ? `Reservation #${confirmationNumber} cancelled.`
    : `Check in undone for reservation #${confirmationNumber}.`;

export function menuFailure(kind: MenuMutation, error: unknown): MenuFailure {
  const status = error instanceof ApiError ? error.status : 0;
  const code = error instanceof ApiError ? error.code : undefined;
  const what = kind === 'cancel' ? 'cancel this reservation' : 'undo this check in';
  if (status === 403) return { message: `You may not ${what}.`, refetch: false };
  if (code === 'stale') {
    return {
      message: 'This reservation changed elsewhere. It was reloaded; try again.',
      refetch: true,
    };
  }
  if (code === 'audit-closed') {
    return {
      message: 'The night audit has already run for this check in, so it cannot be undone.',
      refetch: true,
    };
  }
  if (code === 'not-cancellable') {
    return {
      message: 'A reservation with a checked-in or checked-out room cannot be cancelled.',
      refetch: true,
    };
  }
  if (code === 'not-checked-in') {
    return {
      message: 'There is no check in to undo. The reservation was reloaded.',
      refetch: true,
    };
  }
  if (status >= 400 && status < 500 && status !== 408) {
    return { message: `Could not ${what}.`, refetch: false };
  }
  return {
    message: 'Could not confirm whether the reservation was changed. It was reloaded.',
    refetch: true,
    outcomeUnknown: true,
  };
}
