import { ACCESS_KEYS, FUNCTION_KEYS, type AccessKey, type FunctionKey } from './permissionKeys';
import {
  adminEditPermission,
  ADMIN_PAGE_IDS,
  CHECK_IN_ANY_TIME_PERMISSION,
  CHECK_IN_ARRIVAL_DATE_PERMISSION,
  functionPermission,
  NIGHT_AUDIT_RUN_PERMISSION,
  pagePermission,
  RESERVATION_EDIT_PERMISSION,
  type AdminPageId,
  type PermissionPageId,
} from './permissions';

// Permission sets (Permissions page, ticket 186). A set is what Management or Staff may do: a level
// on every Admin Setup page, a level per Access area, yes/no Function switches, the check-in
// setting and the PIN override switch. Administrators are not a set: they hold everything.
// The rows follow the legacy Permissions screen (PermissionsEdit.vue); the owner's screenshots were
// not available, so the layout is an assumption (see the ticket entry).

export type { AccessKey, FunctionKey } from './permissionKeys';

/** Level of one Access area. `create-edit` is the legacy "Create + Edit". */
export type AccessLevel = 'none' | 'view' | 'edit' | 'create-edit';
/** Level of one Admin Setup page: No Access, View (read-only) or Edit. */
export type SetupLevel = 'none' | 'view' | 'edit';
export type CheckInSetting = 'any-time' | 'arrival-date' | 'never';

export interface PermissionSet {
  /** `management` or `staff` (the two editable sets today). */
  id: string;
  name: string;
  /** Level per Admin Setup page id; a page that is missing counts as 'none'. */
  setup: Record<string, SetupLevel>;
  access: Record<AccessKey, AccessLevel>;
  functions: Record<FunctionKey, boolean>;
  checkIn: CheckInSetting;
  /** Whether this set may authorize another user's override with its PIN (ticket 187 wires it). */
  pinOverride: boolean;
}

/** What other screens (Employees) need to offer a set: small and stable. */
export interface PermissionSetSummary {
  id: string;
  name: string;
  /** False for the Administrator set, which always holds every permission. */
  editable: boolean;
}

export const ADMINISTRATOR_SET: PermissionSetSummary = {
  id: 'admin',
  name: 'Administrator',
  editable: false,
};

export const SETUP_LEVELS: readonly SetupLevel[] = ['none', 'view', 'edit'];

/**
 * The levels the Permissions page offers for an Admin Setup page of a non-admin set: View or No
 * Access only, as in the legacy screen (Administrators alone change setup, so granting Edit would
 * hand out more than any non-admin may hold). A stored `edit` (a backend decision) still shows, so it is not hidden.
 */
export const setupLevelOptions = (current: SetupLevel): readonly SetupLevel[] =>
  current === 'edit' ? SETUP_LEVELS : ['none', 'view'];
export const SETUP_LEVEL_LABEL: Record<SetupLevel, string> = {
  none: 'No Access',
  view: 'View',
  edit: 'Edit',
};

export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = {
  none: 'No Access',
  view: 'View',
  edit: 'Edit',
  'create-edit': 'Create + Edit',
};

export const CHECK_IN_OPTIONS: readonly { value: CheckInSetting; label: string }[] = [
  { value: 'any-time', label: 'AnyTime' },
  { value: 'arrival-date', label: 'On Check-In Date Only' },
  { value: 'never', label: 'Never' },
];

export interface AccessRow {
  kind: 'access';
  key: AccessKey;
  label: string;
  hint?: string;
  /** The levels the legacy screen offers for this area, best first. */
  levels: readonly AccessLevel[];
}
export interface FunctionRow {
  kind: 'function';
  key: FunctionKey;
  label: string;
  hint?: string;
  /** The Access area this function belongs to; it does not apply (N/A) when that area is No Access. */
  parent: AccessKey;
  /** Legacy: Management only; the Staff column shows N/A (Operation Reports, Financial Reports). */
  managementOnly?: boolean;
}
export interface CheckInRow {
  kind: 'checkIn';
  label: string;
  parent: AccessKey;
}
export type PermissionRow = AccessRow | FunctionRow | CheckInRow;

const FOUR: readonly AccessLevel[] = ['create-edit', 'edit', 'view', 'none'];
const EDIT_VIEW: readonly AccessLevel[] = ['edit', 'view', 'none'];
const EDIT_ONLY: readonly AccessLevel[] = ['edit', 'none'];

const access = (
  key: AccessKey,
  label: string,
  levels: readonly AccessLevel[],
  hint?: string,
): AccessRow => ({ kind: 'access', key, label, levels, hint });
const fn = (
  key: FunctionKey,
  label: string,
  parent: AccessKey,
  hint?: string,
  managementOnly?: boolean,
): FunctionRow => ({
  kind: 'function',
  key,
  label,
  parent,
  hint,
  ...(managementOnly ? { managementOnly } : {}),
});

/** The Access and Function rows in the order of the page (legacy order). */
export const PERMISSION_ROWS: readonly PermissionRow[] = [
  access('closures', 'Closure Events + Details', FOUR),
  access('reservations', 'Reservation Events + Core Details', FOUR),
  fn(
    'changeReservationRoom',
    'Change Reservation Room',
    'reservations',
    'from unassigned or other room',
  ),
  fn('changeReservationLocation', 'Change Reservation Location', 'reservations'),
  fn('changeReservationRoomType', 'Change Reservation Room Type', 'reservations'),
  fn('changeRateCategory', 'Change Rate Category', 'reservations'),
  fn('adjustRoomRate', 'Adjust Room Rate', 'reservations'),
  { kind: 'checkIn', label: 'Check In Room', parent: 'reservations' },
  fn('undoCheckIn', 'Undo Check In', 'reservations'),
  fn(
    'checkOutReservation',
    'Check Out Reservation',
    'reservations',
    'manual check out prior to set check out time',
  ),
  access('reservationDetails', 'Reservation Full Details', EDIT_VIEW, 'guests, add-ons, notes'),
  fn('viewPrivateNotes', 'View Private Notes', 'reservationDetails'),
  access('nightAudit', 'Night Audit', FOUR, 'history and manual night audit run (create)'),
  access('roomBlocks', 'Room Block', FOUR),
  access('reporting', 'Reporting', EDIT_ONLY),
  fn('operationalReports', 'Operation Reports', 'reporting', undefined, true),
  fn('financialReports', 'Financial Reports', 'reporting', undefined, true),
  access('folio', 'Folio', EDIT_VIEW),
  fn('addManualChargeCredit', 'Add Manual Charge / Credit', 'folio'),
  fn('addPositiveDepositPayment', 'Add Positive Deposit / Payment', 'folio'),
  fn('addNegativeDepositPayment', 'Add Negative Deposit / Payment', 'folio'),
  fn('splitFolio', 'Split Folio', 'folio'),
  fn('settleFolio', 'Settle Folio', 'folio'),
  fn('reopenCloseFolio', 'Manually Reopen / Close Folio', 'folio'),
  access('nonMembers', 'Non-Members', FOUR),
];

export const ACCESS_ROWS = PERMISSION_ROWS.filter((r): r is AccessRow => r.kind === 'access');

/** The levels offered for an area. */
export const levelsFor = (key: AccessKey): readonly AccessLevel[] =>
  ACCESS_ROWS.find((r) => r.key === key)?.levels ?? ['none'];

/**
 * Function and check-in rows are N/A (shown greyed, saved as off) when their area does not allow them.
 * Like the legacy screen, the Reservation Events functions (change room, check in, undo, check out...)
 * need Edit or Create + Edit: with View they are off and check in is Never. Other areas need more than No Access.
 */
export function rowApplies(set: PermissionSet, row: PermissionRow): boolean {
  if (row.kind === 'access') return true;
  const level = set.access[row.parent];
  return row.parent === 'reservations'
    ? level === 'edit' || level === 'create-edit'
    : level !== 'none';
}

/**
 * Legacy display rule: a cell is N/A (greyed) in the Staff column while Reservation Events is No Access
 * (every function under it), and for the two Management-only report rows. Management always shows its cells.
 */
export function rowIsNotApplicable(set: PermissionSet, row: PermissionRow): boolean {
  if (row.kind === 'access') return false;
  if ('managementOnly' in row && row.managementOnly && set.id !== 'management') return true;
  return (
    row.parent === 'reservations' && set.id !== 'management' && set.access.reservations === 'none'
  );
}

const rank = (level: AccessLevel) => ['none', 'view', 'edit', 'create-edit'].indexOf(level);

/** An unknown level, or one the area does not offer, falls back to the highest level it offers that is not above it. */
export function clampLevel(key: AccessKey, level: unknown): AccessLevel {
  const offered = levelsFor(key);
  if (typeof level === 'string' && (offered as readonly string[]).includes(level)) {
    return level as AccessLevel;
  }
  const asked = typeof level === 'string' ? rank(level as AccessLevel) : -1;
  const below = offered.filter((l) => rank(l) <= asked).sort((a, b) => rank(b) - rank(a));
  return below[0] ?? 'none';
}

export const isSetupLevel = (value: unknown): value is SetupLevel =>
  value === 'none' || value === 'view' || value === 'edit';

/** The level on an Admin Setup page; unknown pages and missing entries are 'none' (fail closed). */
export const setupLevel = (set: PermissionSet, id: string): SetupLevel => {
  const level = set.setup[id];
  return isSetupLevel(level) ? level : 'none';
};

/**
 * Repairs a set from the wire: unknown values fall back to the safest one, every key is present,
 * and a function that does not apply is off. Pure; the mock and the editor use the same rule.
 */
export function normalizeSet(raw: PermissionSet, keepHidden = false): PermissionSet {
  // Every known page gets a level; a key this client does not know is kept as it is (a newer backend
  // may have more pages), but only with a valid level.
  const setup: Record<string, SetupLevel> = {};
  for (const [id, level] of Object.entries(raw.setup ?? {}))
    if (isSetupLevel(level)) setup[id] = level;
  for (const id of ADMIN_PAGE_IDS) setup[id] = setupLevel(raw, id);
  const accessLevels = {} as Record<AccessKey, AccessLevel>;
  for (const key of ACCESS_KEYS) accessLevels[key] = clampLevel(key, raw.access?.[key]);
  const normalized: PermissionSet = {
    id: raw.id,
    name: raw.name,
    setup,
    access: accessLevels,
    functions: {} as Record<FunctionKey, boolean>,
    checkIn: raw.checkIn === 'any-time' || raw.checkIn === 'arrival-date' ? raw.checkIn : 'never',
    pinOverride: raw.pinOverride === true,
  };
  for (const key of FUNCTION_KEYS) normalized.functions[key] = raw.functions?.[key] === true;
  // The editor keeps what a hidden (N/A) row held, so switching the area back restores it; what is
  // saved and granted is always off.
  if (keepHidden) return normalized;
  // What the page shows as N/A is saved as off (legacy). Other values are kept as chosen; the grant
  // (`rowApplies`) is what ignores a function whose area does not allow it.
  for (const row of PERMISSION_ROWS) {
    if (row.kind === 'function' && rowIsNotApplicable(normalized, row)) {
      normalized.functions[row.key] = false;
    }
    if (row.kind === 'checkIn' && rowIsNotApplicable(normalized, row)) normalized.checkIn = 'never';
  }
  return normalized;
}

/** Sets differ in anything a user can change. Both sides are normalized first. */
export function setsDirty(
  saved: readonly PermissionSet[],
  draft: readonly PermissionSet[],
): boolean {
  const key = (sets: readonly PermissionSet[]) => JSON.stringify(sets.map((s) => normalizeSet(s)));
  return key(saved) !== key(draft);
}

/** Replaces one value of one set; applies the N/A rule afterwards. Pure, returns a new list. */
export function updateSet(
  sets: readonly PermissionSet[],
  id: string,
  change: (set: PermissionSet) => PermissionSet,
): PermissionSet[] {
  return sets.map((s) => (s.id === id ? normalizeSet(change(s), true) : s));
}

const PAGES_OF_RESERVATIONS: readonly PermissionPageId[] = [
  'schedule',
  'reservations',
  'new-reservation-results',
  'waitlist',
  'add-on-countdown',
  'member-directory',
];
const PAGES_OF_FOLIO: readonly PermissionPageId[] = ['folio', 'open-folios', 'unassigned-charges'];

/**
 * The permission ids a user holds through a set. This is what `GET /permissions/me` returns for
 * someone assigned to the set, so `can()` reads the saved set.
 * - Admin Setup: View gives `page.<id>`, Edit adds `<id>.edit`.
 * - Reservation Events: View gives the reservation pages, Edit adds `reservation.edit`.
 * - Check in: the two check-in grants (only when the user may see reservations).
 * - Night Audit: View gives the history page, Edit/Create + Edit adds `night-audit.run`.
 * - Room Block, Reporting, Folio: their pages. Everyone sees the dashboard.
 * - Each Function that is on and applies: `function.<key>`.
 * Closures, Reservation Full Details and Non-Members are stored but no screen asks for them yet.
 */
export function grantFromSet(raw: PermissionSet): string[] {
  const set = normalizeSet(raw);
  const out = new Set<string>([pagePermission('dashboard')]);
  for (const id of ADMIN_PAGE_IDS) {
    const level = setupLevel(set, id);
    if (level !== 'none') out.add(pagePermission(id as AdminPageId & PermissionPageId));
    if (level === 'edit') out.add(adminEditPermission(id));
  }
  const reservations = set.access.reservations;
  if (reservations !== 'none') {
    for (const id of PAGES_OF_RESERVATIONS) out.add(pagePermission(id));
    // View is read-only: no editing and, like legacy, no check in (normalizeSet has set it to never).
    if (reservations !== 'view') {
      out.add(RESERVATION_EDIT_PERMISSION);
      if (set.checkIn === 'any-time') out.add(CHECK_IN_ANY_TIME_PERMISSION);
      if (set.checkIn === 'arrival-date') out.add(CHECK_IN_ARRIVAL_DATE_PERMISSION);
    }
  }
  if (set.access.nightAudit !== 'none') {
    out.add(pagePermission('night-audit-history'));
    if (set.access.nightAudit !== 'view') out.add(NIGHT_AUDIT_RUN_PERMISSION);
  }
  if (set.access.roomBlocks !== 'none') out.add(pagePermission('room-blocks'));
  if (set.access.reporting !== 'none') out.add(pagePermission('reporting'));
  if (set.access.folio !== 'none') for (const id of PAGES_OF_FOLIO) out.add(pagePermission(id));
  for (const row of PERMISSION_ROWS) {
    if (row.kind === 'function' && set.functions[row.key] && rowApplies(set, row)) {
      out.add(functionPermission(row.key));
    }
  }
  return [...out];
}

/** The editable sets every club has; a save must send exactly these (a PUT replaces the list). */
export const REQUIRED_SET_IDS: readonly string[] = ['management', 'staff'];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Structurally a permission set (right kinds of fields); levels are not checked, `normalizeSet` repairs them. */
export function isPermissionSetShape(v: unknown): v is PermissionSet {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    isRecord(v.setup) &&
    isRecord(v.access) &&
    isRecord(v.functions)
  );
}

/**
 * Sets read back from storage (the dev mock keeps them in localStorage): all of them well formed and
 * including every required set, else null so the defaults are used. Normalized.
 */
export function parseStoredSets(raw: unknown): PermissionSet[] | null {
  if (!Array.isArray(raw) || !raw.every(isPermissionSetShape)) return null;
  const sets = raw.map((s) => normalizeSet(s));
  // Exactly the known sets: a missing one, an extra one (even `admin`) or a duplicate falls back.
  const ids = sets.map((s) => s.id).sort();
  return ids.length === REQUIRED_SET_IDS.length && REQUIRED_SET_IDS.every((id) => ids.includes(id))
    ? sets
    : null;
}

export interface SetProblem {
  setId: string;
  message: string;
}

/** The server refuses what the editor cannot produce; the mock uses the same checks. */
export function validateSets(sets: readonly PermissionSet[]): SetProblem[] {
  const problems: SetProblem[] = [];
  const seen = new Set<string>();
  for (const id of REQUIRED_SET_IDS) {
    if (!sets.some((s) => s.id === id))
      problems.push({ setId: id, message: 'A permission set is missing.' });
  }
  for (const set of sets) {
    if (seen.has(set.id)) problems.push({ setId: set.id, message: 'Duplicate permission set.' });
    seen.add(set.id);
    if (set.id === ADMINISTRATOR_SET.id) {
      problems.push({ setId: set.id, message: 'The Administrator set cannot be changed.' });
    }
    if (!set.name.trim())
      problems.push({ setId: set.id, message: 'A permission set needs a name.' });
  }
  return problems;
}

export const toSummary = (set: PermissionSet): PermissionSetSummary => ({
  id: set.id,
  name: set.name,
  editable: true,
});

/** The Administrator set first, then the editable ones. */
export const summarizeSets = (sets: readonly PermissionSet[]): PermissionSetSummary[] => [
  { ...ADMINISTRATOR_SET },
  ...sets.map(toSummary),
];

// ---- single changes from the editor (each returns a new, normalized set) --------------------

export const withSetupLevel = (
  set: PermissionSet,
  id: string,
  level: SetupLevel,
): PermissionSet => ({
  ...set,
  setup: { ...set.setup, [id]: level },
});

export function withAccessLevel(
  set: PermissionSet,
  key: AccessKey,
  level: AccessLevel,
): PermissionSet {
  const next: PermissionSet = { ...set, access: { ...set.access, [key]: clampLevel(key, level) } };
  if (key !== 'reservations') return next;
  const edits = (s: PermissionSet) =>
    s.access.reservations === 'edit' || s.access.reservations === 'create-edit';
  // Legacy cascade: Edit switches the reservation functions on (check in Any Time); View or No
  // Access switches them off (Never).
  if (edits(next) && !edits(set)) return withReservationFunctions(next, true);
  // Legacy: View switches them off; No Access leaves them (the Staff cells turn N/A and save as off).
  if (next.access.reservations === 'view') return withReservationFunctions(next, false);
  return next;
}

const RESERVATION_FUNCTIONS: readonly FunctionKey[] = [
  'changeReservationRoom',
  'changeReservationLocation',
  'changeReservationRoomType',
  'changeRateCategory',
  'adjustRoomRate',
  'undoCheckIn',
  'checkOutReservation',
];

function withReservationFunctions(set: PermissionSet, on: boolean): PermissionSet {
  const functions = { ...set.functions };
  for (const key of RESERVATION_FUNCTIONS) functions[key] = on;
  return { ...set, functions, checkIn: on ? 'any-time' : 'never' };
}

export const withFunction = (set: PermissionSet, key: FunctionKey, on: boolean): PermissionSet => ({
  ...set,
  functions: { ...set.functions, [key]: on },
});

export const withCheckIn = (set: PermissionSet, checkIn: CheckInSetting): PermissionSet => ({
  ...set,
  checkIn,
});

export const withPinOverride = (set: PermissionSet, pinOverride: boolean): PermissionSet => ({
  ...set,
  pinOverride,
});

/** Label of an Admin Setup page in the table: the navigation's name (Primary Setup is "System Settings"). */
export const SETUP_PAGE_LABEL: Record<string, string> = {
  'primary-setup': 'System Settings',
};

// ---- the legacy "Admin Setup" row ------------------------------------------------------------

/** The one Admin Setup row of the legacy screen: View (every setup page, read-only) or No Access. */
export type AdminSetupLevel = 'view' | 'none';
export const ADMIN_SETUP_OPTIONS: readonly AdminSetupLevel[] = ['view', 'none'];

/** View when the set may open any setup page, else No Access. */
export const adminSetupLevel = (set: PermissionSet): AdminSetupLevel =>
  ADMIN_PAGE_IDS.some((id) => setupLevel(set, id) !== 'none') ? 'view' : 'none';

/** Sets every Admin Setup page to the level (non-admin sets never get Edit). */
export const withAdminSetup = (set: PermissionSet, level: AdminSetupLevel): PermissionSet => ({
  ...set,
  setup: Object.fromEntries([
    ...Object.entries(set.setup),
    ...ADMIN_PAGE_IDS.map((id) => [id, level] as const),
  ]),
});
