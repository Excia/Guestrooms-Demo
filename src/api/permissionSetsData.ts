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

// Mock data for the Permissions page (ticket 186). P-186-1: the defaults follow the legacy
// PermissionsEdit defaults where it has them. Management sees every setup page read-only (the owner
// says most non-admins are View); Staff has no setup access and keeps the pages the earlier mock
// "Non-admin" user had, so the demo does not change for anyone who does not edit the sets.

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
      setup: setup('view', { permissions: 'none' }),
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
      checkIn: 'any-time',
      pinOverride: true,
    }),
    normalizeSet({
      id: 'staff',
      name: 'Staff',
      setup: setup('none'),
      access: access({
        closures: 'view',
        reservations: 'edit',
        reservationDetails: 'edit',
        nightAudit: 'view',
        roomBlocks: 'view',
        reporting: 'edit',
        folio: 'edit',
        nonMembers: 'edit',
      }),
      functions: functions(['addManualChargeCredit', 'addPositiveDepositPayment']),
      checkIn: 'arrival-date',
      pinOverride: false,
    }),
  ];
}
