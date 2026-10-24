// Business rules of Keycard Integration (ticket 7.6): the format of an Encoder Key, duplicates, the
// rows of the list and the merge of keys retrieved from Visionline. Pure functions; the page, the
// mock API and the keycard flows (ticket 3.6) only call them.

/**
 * PLACEHOLDER (Q-75-1): Figma writes "Enter X digit Encoder Key" and shows the mask XXXX-XXXX-XXXXXX,
 * so the key is assumed to be 14 digits. Change it here when the owner answers.
 */
export const ENCODER_KEY_LENGTH = 14;

/** One row of the list; `id` only identifies the row while editing, it is not saved. */
export interface EncoderRow {
  id: string;
  value: string;
}

export type EncoderErrors = Record<string, string>;

/** Spaces and hyphens are separators, so "1234-5678-901234" and "12345678901234" are one key. */
export const normalizeEncoderKey = (value: string): string => value.replace(/[\s-]/g, '');

export const isBlankRow = (row: EncoderRow): boolean => normalizeEncoderKey(row.value) === '';

/** The message for one key, or null when it is valid. A blank key is not checked here. */
export function validateEncoderKey(value: string): string | null {
  const key = normalizeEncoderKey(value);
  if (!/^\d*$/.test(key)) return 'Use digits only.';
  if (key.length !== ENCODER_KEY_LENGTH) {
    return `Enter a ${ENCODER_KEY_LENGTH} digit Encoder Key.`;
  }
  return null;
}

/**
 * Errors by row id. Blank rows are ignored (they are dropped when saving). The first of two equal
 * keys is fine; every later one is flagged as a duplicate.
 */
export function validateEncoderRows(rows: readonly EncoderRow[]): EncoderErrors {
  const errors: EncoderErrors = {};
  const seen = new Set<string>();
  for (const row of rows) {
    if (isBlankRow(row)) continue;
    const invalid = validateEncoderKey(row.value);
    if (invalid) {
      errors[row.id] = invalid;
      continue;
    }
    const key = normalizeEncoderKey(row.value);
    if (seen.has(key)) errors[row.id] = 'This Encoder Key is already in the list.';
    seen.add(key);
  }
  return errors;
}

/** Same rules for a list of keys (the mock and the backend validate what the page sent). */
export function validateEncoderKeys(keys: readonly string[]): boolean {
  const rows = keys.map((value, i) => ({ id: String(i), value }));
  return rows.every((r) => !isBlankRow(r)) && Object.keys(validateEncoderRows(rows)).length === 0;
}

/** The keys to save: blank rows dropped, separators removed. */
export const encoderKeysToSave = (rows: readonly EncoderRow[]): string[] =>
  rows.filter((r) => !isBlankRow(r)).map((r) => normalizeEncoderKey(r.value));

/** Whether the rows differ from the saved keys (blank rows do not count). */
export function encodersChanged(saved: readonly string[], rows: readonly EncoderRow[]): boolean {
  const now = encoderKeysToSave(rows);
  return now.length !== saved.length || now.some((key, i) => key !== saved[i]);
}

export interface MergeResult {
  rows: EncoderRow[];
  /** Keys that were not in the list yet. */
  added: number;
}

/**
 * Fills the list with the retrieved keys: keys already listed are skipped, blank rows are used up
 * first, and the rest are appended.
 */
export function mergeRetrieved(
  rows: readonly EncoderRow[],
  retrieved: readonly string[],
  makeId: () => string,
): MergeResult {
  const listed = new Set(
    rows.filter((r) => !isBlankRow(r)).map((r) => normalizeEncoderKey(r.value)),
  );
  const fresh: string[] = [];
  for (const raw of retrieved) {
    const key = normalizeEncoderKey(raw);
    if (key === '' || listed.has(key)) continue;
    listed.add(key);
    fresh.push(key);
  }
  const queue = [...fresh];
  const filled = rows.map((r) =>
    isBlankRow(r) && queue.length > 0 ? { ...r, value: queue.shift() as string } : r,
  );
  return {
    rows: [...filled, ...queue.map((value) => ({ id: makeId(), value }))],
    added: fresh.length,
  };
}

export const retrievedMessage = (count: number): string =>
  `${count} Encoder${count === 1 ? '' : 's'} Successfully Retrieved`;
