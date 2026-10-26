import type { Permission } from '../app/permissions';
import { permissionsFromGrant } from './grant';
import { MOCK_USERS } from './mockUsers';
import type { PermissionGrant } from './types';

/** Wrong PINs in a row that lock the caller out. */
export const MAX_FAILED_PINS = 5;
/** How long the lock lasts. */
export const PIN_LOCKOUT_SECONDS = 300;

export interface PinHolder {
  id: string;
  name: string;
  /** PLACEHOLDER (P-187-1): a real backend stores only a hash and never returns it. */
  pin: string;
  grant: PermissionGrant;
  /**
   * The permission set the holder belongs to (Permissions page, ticket 186). When the guard is given a
   * resolver, the holder counts only if the saved set has PIN override on and grants the permission.
   */
  permissionSetId?: string;
}

const grantOf = (id: 'admin' | 'non-admin' | 'partial') =>
  MOCK_USERS.find((u) => u.id === id)!.grant;

/**
 * PLACEHOLDER (P-187-1): the employees whose PIN the mock knows, until the Employees page (#185)
 * and the Permissions page (#186) own this data. They reuse the mock users' grants, so the
 * Administrator and the "Partial" user may override check in and the Staff user may not.
 */
export const MOCK_PIN_HOLDERS: readonly PinHolder[] = [
  { id: 'emp-1', name: 'Morgan Reyes', pin: '4821', grant: grantOf('admin') },
  {
    id: 'emp-2',
    name: 'Jordan Lee',
    pin: '1357',
    grant: grantOf('partial'),
    permissionSetId: 'management',
  },
  {
    id: 'emp-3',
    name: 'Sam Okafor',
    pin: '2468',
    grant: grantOf('non-admin'),
    permissionSetId: 'staff',
  },
];

/** Convenience for tests and docs: a PIN whose holder may override, and one whose holder may not. */
export const MOCK_MANAGER_PIN = MOCK_PIN_HOLDERS[0].pin;
export const MOCK_STAFF_PIN = MOCK_PIN_HOLDERS[2].pin;

export type PinCheck =
  | { kind: 'valid'; holder: PinHolder }
  | { kind: 'invalid' }
  | { kind: 'locked'; retryAfterSeconds: number };

export interface PinGuard {
  /** Tests a PIN for a permission. A PIN of someone without the permission is just "invalid". */
  check(permission: Permission, pin: string): PinCheck;
}

/**
 * Rate limit and lockout for PIN tests, for one caller: after `MAX_FAILED_PINS` wrong PINs in a
 * row every attempt is refused as locked, without testing the PIN, until the lock ends. A right PIN
 * resets the count. "Wrong" and "unknown holder" and "holder lacks the permission" answer alike, so
 * PINs cannot be probed.
 */
export function createPinGuard(
  holders: readonly PinHolder[],
  now: () => Date,
  limits: { maxFailed: number; lockoutSeconds: number } = {
    maxFailed: MAX_FAILED_PINS,
    lockoutSeconds: PIN_LOCKOUT_SECONDS,
  },
  /** The grant a holder has now, or null when their PIN does not count (default: the fixed grant). */
  grantOfHolder: (holder: PinHolder) => PermissionGrant | null = (h) => h.grant,
): PinGuard {
  let failures = 0;
  let lockedUntil = 0;
  return {
    check(permission, pin) {
      const at = now().getTime();
      if (at < lockedUntil) {
        return { kind: 'locked', retryAfterSeconds: Math.ceil((lockedUntil - at) / 1000) };
      }
      const holder = holders.find((h) => {
        const grant = h.pin === pin ? grantOfHolder(h) : null;
        return grant !== null && permissionsFromGrant(grant).can(permission);
      });
      if (holder) {
        failures = 0;
        return { kind: 'valid', holder };
      }
      failures += 1;
      if (failures >= limits.maxFailed) {
        failures = 0;
        lockedUntil = at + limits.lockoutSeconds * 1000;
        return { kind: 'locked', retryAfterSeconds: limits.lockoutSeconds };
      }
      return { kind: 'invalid' };
    },
  };
}
