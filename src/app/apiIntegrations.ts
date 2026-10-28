// Business rules of API Integrations (ticket 188): API Keys, PayCloud API Tokens and the
// Authentications of Tiger TMS and Assa Abloy. Pure functions; the page, the mock API and the HTTP
// client only call them. A secret is never logged, never put in an error message and never shown
// again after it was saved: only `maskSecret` output reaches the screen.
import type {
  ConnectionTestResult,
  IntegrationAuthInput,
  IntegrationProvider,
  PayCloudEnvironment,
} from '../api/types';

// ---- masking ---------------------------------------------------------------------------------

const MASK_CHAR = '•';
const MASK_TAIL = 4;

/**
 * The display form of a saved secret: bullets and the last four characters, e.g. "••••••••a1b2".
 * A secret of eight characters or fewer shows bullets only, so a short value is not given away.
 */
export function maskSecret(secret: string): string {
  const tail = secret.length > MASK_TAIL * 2 ? secret.slice(-MASK_TAIL) : '';
  return `${MASK_CHAR.repeat(8)}${tail}`;
}

// ---- API Keys --------------------------------------------------------------------------------

export const API_KEY_NAME_MAX = 50;
/** Prefix of every generated Guest Rooms API key, so a leaked one can be recognised. */
export const API_KEY_PREFIX = 'grk_';
const API_KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const API_KEY_BODY_LENGTH = 40;

/** Names are trimmed and compared ignoring case; two keys may not share one. */
export const normalizeKeyName = (name: string): string => name.trim().replace(/\s+/g, ' ');

/** The message for a new key's name, or null when it is fine. `existing` are the names in use. */
export function validateKeyName(name: string, existing: readonly string[]): string | null {
  const clean = normalizeKeyName(name);
  if (clean === '') return 'Enter a key name.';
  if (clean.length > API_KEY_NAME_MAX) {
    return `Use ${API_KEY_NAME_MAX} characters or fewer.`;
  }
  const lower = clean.toLowerCase();
  if (existing.some((n) => normalizeKeyName(n).toLowerCase() === lower)) {
    return 'A key with this name already exists.';
  }
  return null;
}

/**
 * A new key secret from a source of random bytes (the mock passes `crypto.getRandomValues`; tests
 * pass a fixed one). 40 characters of a 36-letter alphabet after the prefix.
 */
export function generateApiKeySecret(randomBytes: (length: number) => Uint8Array): string {
  const bytes = randomBytes(API_KEY_BODY_LENGTH);
  let body = '';
  for (let i = 0; i < API_KEY_BODY_LENGTH; i++) {
    body += API_KEY_ALPHABET[bytes[i] % API_KEY_ALPHABET.length];
  }
  return `${API_KEY_PREFIX}${body}`;
}

// ---- PayCloud API Tokens ---------------------------------------------------------------------

/** The legacy field has maxlength 36 (a GUID). */
export const PAYCLOUD_KEY_MAX = 36;

export const PAYCLOUD_ENVIRONMENTS: readonly { value: PayCloudEnvironment; label: string }[] = [
  { value: 'local', label: 'Local' },
  { value: 'test', label: 'Test' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
];

export const environmentLabel = (value: PayCloudEnvironment): string =>
  PAYCLOUD_ENVIRONMENTS.find((e) => e.value === value)?.label ?? value;

/** One row being edited. `id` is the saved token's id, or a client id for a row not saved yet. */
export interface PayCloudRow {
  id: string;
  /** The saved token this row edits; absent for a new row. */
  saved?: { maskedKey: string; environment: PayCloudEnvironment };
  /** What was typed: the key of a new row, or the replacement key of a saved one. */
  apiKey: string;
  environment: PayCloudEnvironment;
  /** A saved row whose key is being replaced shows an input instead of the mask. */
  replacing: boolean;
}

/** The message for a typed key, or null. A saved row that keeps its key has nothing to check. */
export function validatePayCloudKey(row: PayCloudRow): string | null {
  if (row.saved && !row.replacing) return null;
  const key = row.apiKey.trim();
  if (key === '') return 'Enter the API key.';
  if (key.length > PAYCLOUD_KEY_MAX) return `Use ${PAYCLOUD_KEY_MAX} characters or fewer.`;
  if (/\s/.test(key)) return 'The API key has no spaces.';
  return null;
}

export function validatePayCloudRows(rows: readonly PayCloudRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const row of rows) {
    const message = validatePayCloudKey(row);
    if (message) errors[row.id] = message;
  }
  return errors;
}

/** Whether the rows differ from the saved tokens (rows added, removed, replaced or re-environmented). */
export function payCloudChanged(
  saved: readonly { id: string; environment: PayCloudEnvironment }[],
  rows: readonly PayCloudRow[],
): boolean {
  if (saved.length !== rows.length) return true;
  return rows.some((row, i) => {
    const was = saved[i];
    if (!row.saved || was?.id !== row.id) return true;
    return row.environment !== was.environment || (row.replacing && row.apiKey.trim() !== '');
  });
}

// ---- Authentications -------------------------------------------------------------------------

export const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  'tiger-tms': 'Tiger TMS',
  'assa-abloy': 'Assa Abloy',
};
export const PROVIDERS: readonly IntegrationProvider[] = ['tiger-tms', 'assa-abloy'];

/** An authentication being edited. The saved password is never loaded: `password` is only what was typed. */
export interface AuthDraft {
  provider: IntegrationProvider;
  enabled: boolean;
  baseUrl: string;
  userName: string;
  /** Typed this session; empty keeps the saved one. */
  password: string;
  hasPassword: boolean;
  accessId: string;
  uuid: string;
}

export const AUTH_URL_MAX = 500;
export const AUTH_FIELD_MAX = 36;

/** An absolute http(s) URL. Legacy accepted any URL the browser could parse; a scheme-less or other scheme is refused here. */
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname !== '';
  } catch {
    return false;
  }
}

export type AuthErrors = Partial<Record<'baseUrl' | 'accessId' | 'password', string>>;

/**
 * A saved password is only ever used for the URL and username it was saved with. When either was
 * changed, the password must be typed again, so a saved secret can never be sent to a new address.
 * Used by the form, and enforced by the mock and the backend (`password` 422 / failed test).
 */
export function needsPasswordRetype(draft: AuthDraft, saved: AuthDraft | undefined): boolean {
  if (!saved || !saved.hasPassword || draft.password !== '') return false;
  return (
    draft.baseUrl.trim() !== saved.baseUrl.trim() || draft.userName.trim() !== saved.userName.trim()
  );
}

export const PASSWORD_RETYPE_MESSAGE =
  'Type the password again: the URL or username changed, and a saved password is not sent to a new address.';

/**
 * Field messages. Only an enabled integration must be complete when saving (legacy); a Test
 * Connection always needs a valid URL, and Assa Abloy an Access ID.
 */
export function validateAuth(
  draft: AuthDraft,
  { forTest = false, saved }: { forTest?: boolean; saved?: AuthDraft } = {},
): AuthErrors {
  const errors: AuthErrors = {};
  if (!draft.enabled && !forTest) return errors;
  if (!isValidUrl(draft.baseUrl))
    errors.baseUrl = 'Enter a valid URL, for example https://example.com.';
  if (draft.provider === 'assa-abloy' && draft.accessId.trim() === '') {
    errors.accessId = 'Access ID is required for Assa Abloy.';
  }
  if (needsPasswordRetype(draft, saved)) errors.password = PASSWORD_RETYPE_MESSAGE;
  return errors;
}

/** The request for one authentication: the password is sent only when it was typed. */
export function authInput(draft: AuthDraft, makeUuid: () => string): IntegrationAuthInput {
  const input: IntegrationAuthInput = {
    provider: draft.provider,
    enabled: draft.enabled,
    baseUrl: draft.baseUrl.trim(),
    userName: draft.userName.trim(),
  };
  if (draft.password !== '') input.password = draft.password;
  if (draft.provider === 'assa-abloy') {
    input.accessId = draft.accessId.trim();
    // Legacy generates the UUID the first time an Assa Abloy integration is saved or tested.
    input.uuid = draft.uuid.trim() === '' ? makeUuid() : draft.uuid.trim();
  }
  return input;
}

export function authChanged(saved: readonly AuthDraft[], now: readonly AuthDraft[]): boolean {
  return now.some((draft) => {
    const was = saved.find((s) => s.provider === draft.provider);
    if (!was) return true;
    return (
      draft.password !== '' ||
      draft.enabled !== was.enabled ||
      draft.baseUrl.trim() !== was.baseUrl.trim() ||
      draft.userName.trim() !== was.userName.trim() ||
      draft.accessId.trim() !== was.accessId.trim() ||
      draft.uuid.trim() !== was.uuid.trim()
    );
  });
}

export interface Outcome {
  severity: 'success' | 'warning' | 'error';
  message: string;
}

/** The toast after Save: what the connection tests of the enabled integrations said (legacy wording). */
export function saveOutcome(tests: readonly ConnectionTestResult[]): Outcome {
  if (tests.length === 0) {
    return { severity: 'success', message: 'Authentications saved successfully.' };
  }
  const failed = tests.filter((t) => !t.success).map((t) => PROVIDER_LABELS[t.provider]);
  if (failed.length === 0) {
    return { severity: 'success', message: 'Connection has been made successfully.' };
  }
  if (failed.length === tests.length && tests.length > 1) {
    return {
      severity: 'error',
      message: `Credentials saved, but connection tests failed for ${failed.join(' and ')}.`,
    };
  }
  return {
    severity: 'error',
    message: `Credentials saved, but connection test failed for ${failed.join(' and ')}.`,
  };
}

export function testOutcome(result: ConnectionTestResult): Outcome {
  const name = PROVIDER_LABELS[result.provider];
  return result.success
    ? { severity: 'success', message: `Successful connection to ${name}.` }
    : { severity: 'error', message: `Connection to ${name} failed.` };
}

/**
 * PLACEHOLDER for the mock only (no integration exists yet): a connection works when the URL is
 * valid, a password is saved or typed, and the host does not start with "offline" or "fail".
 * Lets a tester reach both outcomes (for example https://offline.example.com).
 */
export function mockConnectionWorks(baseUrl: string, hasPassword: boolean): boolean {
  if (!isValidUrl(baseUrl) || !hasPassword) return false;
  const host = new URL(baseUrl.trim()).hostname.toLowerCase();
  return !(host.startsWith('offline') || host.startsWith('fail'));
}
