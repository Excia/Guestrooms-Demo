import {
  ACCESS_KEYS,
  FUNCTION_KEYS,
  type AccessKey,
  type FunctionKey,
} from '../app/permissionKeys';
import { ADMIN_PAGE_IDS } from '../app/permissions';
import {
  normalizeSet,
  type AccessLevel,
  type PermissionSet,
  type SetupLevel,
} from '../app/permissionSets';

// Mock data for the Permissions page. P-186-2: the defaults are the legacy PermissionsEdit defaults
// (setPermissionsOrDefaults), with Admin Setup View mapped onto every setup page.

const setup = (level: SetupLevel, except: Record<string, SetupLevel> = {}) =>
  Object.fromEntries(ADMIN_PAGE_IDS.map((id) => [id, except[id] ?? level]));

const access = (levels: Partial<Record<AccessKey, AccessLevel>>) =>
  Object.fromEntries(ACCESS_KEYS.map((k) => [k, levels[k] ?? 'none'])) as Record<
    AccessKey,
    AccessLevel
  >;

const functions = (on: readonly FunctionKey[]) =>
  Object.fromEntries(FUNCTION_KEYS.map((k) => [k, on.includes(k)])) as Record<FunctionKey, boolean>;

export function mockPermissionSets(): PermissionSet[] {
  return [
    normalizeSet({
      id: 'management',
      name: 'Management',
      // Legacy default: Admin Setup View (every setup page, read-only).
      setup: setup('view'),
      access: access({
        closures: 'create-edit',
        reservations: 'create-edit',
        reservationDetails: 'edit',
        nightAudit: 'create-edit',
        roomBlocks: 'create-edit',
        reporting: 'edit',
        folio: 'edit',
        nonMembers: 'create-edit',
      }),
      functions: functions(FUNCTION_KEYS.filter((k) => k !== 'reopenCloseFolio')),
      checkIn: 'arrival-date',
      pinOverride: true,
    }),
    normalizeSet({
      id: 'staff',
      name: 'Staff',
      setup: setup('none'),
      access: access({
        closures: 'view',
        reservations: 'view',
        reservationDetails: 'edit',
        nightAudit: 'view',
        roomBlocks: 'edit',
        reporting: 'none',
        folio: 'edit',
        nonMembers: 'edit',
      }),
      functions: functions(['addManualChargeCredit', 'addPositiveDepositPayment']),
      checkIn: 'never',
      // No PIN row in legacy: whoever holds the permission may authorize an override with their PIN.
      pinOverride: true,
    }),
  ];
}
