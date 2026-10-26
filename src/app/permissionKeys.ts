// Keys of the permission sets (Permissions page, ticket 186). A leaf module with no imports, so the
// permission registry (`permissions.ts`) and the set rules (`permissionSets.ts`) can both use it.

/** Access sets: one level per area of the product (the legacy "Access Set" rows). */
export const ACCESS_KEYS = [
  'closures',
  'reservations',
  'reservationDetails',
  'nightAudit',
  'roomBlocks',
  'reporting',
  'folio',
  'nonMembers',
] as const;
export type AccessKey = (typeof ACCESS_KEYS)[number];

/** Function sets: yes/no switches for single actions (the legacy "Function Set" rows). */
export const FUNCTION_KEYS = [
  'changeReservationRoom',
  'changeReservationLocation',
  'changeReservationRoomType',
  'changeRateCategory',
  'adjustRoomRate',
  'undoCheckIn',
  'checkOutReservation',
  'viewPrivateNotes',
  'operationalReports',
  'financialReports',
  'addManualChargeCredit',
  'addPositiveDepositPayment',
  'addNegativeDepositPayment',
  'splitFolio',
  'settleFolio',
  'reopenCloseFolio',
] as const;
export type FunctionKey = (typeof FUNCTION_KEYS)[number];
