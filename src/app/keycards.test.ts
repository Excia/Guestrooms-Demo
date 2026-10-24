import {
  ENCODER_KEY_LENGTH,
  encoderKeysToSave,
  encodersChanged,
  mergeRetrieved,
  normalizeEncoderKey,
  retrievedMessage,
  validateEncoderKey,
  validateEncoderKeys,
  validateEncoderRows,
  type EncoderRow,
} from './keycards';

const key = (n: number) => String(n).padStart(ENCODER_KEY_LENGTH, '0');
const row = (id: string, value: string): EncoderRow => ({ id, value });
let n = 0;
const makeId = () => `new-${++n}`;

describe('validateEncoderKey', () => {
  it('accepts the exact length of digits, with or without separators', () => {
    expect(validateEncoderKey(key(1))).toBeNull();
    expect(validateEncoderKey('0000-0000-000001')).toBeNull();
    expect(validateEncoderKey(' 0000 0000 000001 ')).toBeNull();
  });

  it('rejects letters and symbols', () => {
    expect(validateEncoderKey('ABCD0000000001')).toBe('Use digits only.');
    expect(validateEncoderKey('0000000000000!')).toBe('Use digits only.');
  });

  it('rejects a key that is too short or too long', () => {
    const message = `Enter a ${ENCODER_KEY_LENGTH} digit Encoder Key.`;
    expect(validateEncoderKey('123')).toBe(message);
    expect(validateEncoderKey(key(1) + '0')).toBe(message);
  });
});

describe('validateEncoderRows', () => {
  it('ignores blank rows', () => {
    expect(validateEncoderRows([row('a', ''), row('b', ' - ')])).toEqual({});
  });

  it('flags each invalid row by id', () => {
    const errors = validateEncoderRows([row('a', key(1)), row('b', '12')]);
    expect(Object.keys(errors)).toEqual(['b']);
  });

  it('flags the later of two equal keys, even when one has separators', () => {
    const errors = validateEncoderRows([
      row('a', key(1)),
      row('b', '0000-0000-000001'),
      row('c', key(2)),
    ]);
    expect(errors).toEqual({ b: 'This Encoder Key is already in the list.' });
  });
});

describe('validateEncoderKeys', () => {
  it('accepts a list of valid unique keys and the empty list', () => {
    expect(validateEncoderKeys([key(1), key(2)])).toBe(true);
    expect(validateEncoderKeys([])).toBe(true);
  });

  it('rejects duplicates, bad keys and blanks', () => {
    expect(validateEncoderKeys([key(1), key(1)])).toBe(false);
    expect(validateEncoderKeys(['x'])).toBe(false);
    expect(validateEncoderKeys([''])).toBe(false);
  });
});

describe('saving', () => {
  it('drops blank rows and separators', () => {
    expect(
      encoderKeysToSave([row('a', '0000-0000-000001'), row('b', ''), row('c', key(2))]),
    ).toEqual([key(1), key(2)]);
  });

  it('is unchanged when only blank rows or separators differ', () => {
    expect(encodersChanged([key(1)], [row('a', '0000-0000-000001'), row('b', '')])).toBe(false);
    expect(encodersChanged([key(1)], [row('a', key(1)), row('b', key(2))])).toBe(true);
    expect(encodersChanged([key(1)], [])).toBe(true);
    expect(encodersChanged([], [row('a', '')])).toBe(false);
  });

  it('normalizes', () => {
    expect(normalizeEncoderKey(' 12-34 56 ')).toBe('123456');
  });
});

describe('mergeRetrieved', () => {
  it('fills blank rows first, then appends', () => {
    const result = mergeRetrieved([row('a', key(1)), row('b', '')], [key(2), key(3)], makeId);
    expect(result.added).toBe(2);
    expect(result.rows.map((r) => r.value)).toEqual([key(1), key(2), key(3)]);
    expect(result.rows[1].id).toBe('b');
  });

  it('skips keys already listed and duplicates within the retrieved list', () => {
    const result = mergeRetrieved([row('a', '0000-0000-000001')], [key(1), key(2), key(2)], makeId);
    expect(result.added).toBe(1);
    expect(result.rows.map((r) => r.value)).toEqual(['0000-0000-000001', key(2)]);
  });

  it('adds nothing when everything is listed', () => {
    const rows = [row('a', key(1))];
    expect(mergeRetrieved(rows, [key(1)], makeId)).toEqual({ rows, added: 0 });
  });
});

describe('retrievedMessage', () => {
  it('uses the Figma copy and pluralizes', () => {
    expect(retrievedMessage(1)).toBe('1 Encoder Successfully Retrieved');
    expect(retrievedMessage(3)).toBe('3 Encoders Successfully Retrieved');
  });
});
