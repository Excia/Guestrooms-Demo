import {
  API_KEY_PREFIX,
  authChanged,
  authInput,
  generateApiKeySecret,
  isValidUrl,
  maskSecret,
  mockConnectionWorks,
  needsPasswordRetype,
  normalizeKeyName,
  payCloudChanged,
  saveOutcome,
  testOutcome,
  validateAuth,
  validateKeyName,
  validatePayCloudKey,
  validatePayCloudRows,
  type AuthDraft,
  type PayCloudRow,
} from './apiIntegrations';

const draft = (patch: Partial<AuthDraft> = {}): AuthDraft => ({
  provider: 'tiger-tms',
  enabled: true,
  baseUrl: 'https://tms.example.com',
  userName: 'svc',
  password: '',
  hasPassword: true,
  accessId: '',
  uuid: '',
  ...patch,
});

describe('maskSecret', () => {
  it('keeps only the last four characters of a long secret', () => {
    const masked = maskSecret('grk_abcdefghijklmnop1234');
    expect(masked.endsWith('1234')).toBe(true);
    expect(masked).not.toContain('abcdefgh');
  });
  it('shows bullets only for a short secret', () => {
    expect(maskSecret('abcd1234')).toBe('•'.repeat(8));
    expect(maskSecret('')).toBe('•'.repeat(8));
  });
});

describe('API key names', () => {
  it('trims and collapses spaces', () => {
    expect(normalizeKeyName('  Web   widget ')).toBe('Web widget');
  });
  it('asks for a name, limits the length and refuses a duplicate ignoring case', () => {
    expect(validateKeyName('   ', [])).toBe('Enter a key name.');
    expect(validateKeyName('x'.repeat(51), [])).toMatch(/50 characters/);
    expect(validateKeyName('web WIDGET', ['Web widget'])).toBe(
      'A key with this name already exists.',
    );
    expect(validateKeyName('Accounting', ['Web widget'])).toBeNull();
  });
});

describe('generateApiKeySecret', () => {
  it('is the prefix and 40 characters of the alphabet', () => {
    const secret = generateApiKeySecret((n) => Uint8Array.from({ length: n }, (_, i) => i * 7));
    expect(secret.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(secret).toHaveLength(API_KEY_PREFIX.length + 40);
    expect(secret.slice(API_KEY_PREFIX.length)).toMatch(/^[a-z0-9]{40}$/);
  });
});

describe('PayCloud rows', () => {
  const row = (patch: Partial<PayCloudRow> = {}): PayCloudRow => ({
    id: 'a',
    apiKey: '',
    environment: 'test',
    replacing: false,
    ...patch,
  });
  it('requires a key for a new row, at most 36 characters, no spaces', () => {
    expect(validatePayCloudKey(row())).toBe('Enter the API key.');
    expect(validatePayCloudKey(row({ apiKey: 'x'.repeat(37) }))).toMatch(/36 characters/);
    expect(validatePayCloudKey(row({ apiKey: 'a b' }))).toBe('The API key has no spaces.');
    expect(validatePayCloudKey(row({ apiKey: ' good-key ' }))).toBeNull();
  });
  it('checks a saved row only when its key is being replaced', () => {
    const saved = { maskedKey: 'x', environment: 'test' as const };
    expect(validatePayCloudKey(row({ saved }))).toBeNull();
    expect(validatePayCloudKey(row({ saved, replacing: true }))).toBe('Enter the API key.');
    expect(validatePayCloudRows([row({ saved, replacing: true })])).toEqual({
      a: 'Enter the API key.',
    });
  });
  it('detects added, removed, re-environmented and replaced rows', () => {
    const saved = [{ id: 'a', environment: 'test' as const }];
    const same = row({ saved: { maskedKey: 'x', environment: 'test' } });
    expect(payCloudChanged(saved, [same])).toBe(false);
    expect(payCloudChanged(saved, [])).toBe(true);
    expect(payCloudChanged(saved, [same, row({ id: 'n' })])).toBe(true);
    expect(payCloudChanged(saved, [{ ...same, environment: 'production' }])).toBe(true);
    expect(payCloudChanged(saved, [{ ...same, replacing: true, apiKey: 'new' }])).toBe(true);
    // Opening Replace Key without typing is not a change.
    expect(payCloudChanged(saved, [{ ...same, replacing: true }])).toBe(false);
  });
});

describe('authentications', () => {
  it('accepts only absolute http(s) URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://10.0.0.1:8080/x')).toBe(true);
    for (const bad of ['', 'example.com', 'ftp://example.com', 'javascript:alert(1)']) {
      expect(isValidUrl(bad)).toBe(false);
    }
  });
  it('checks only an enabled integration when saving, always when testing', () => {
    expect(validateAuth(draft({ enabled: false, baseUrl: '' }))).toEqual({});
    expect(validateAuth(draft({ enabled: false, baseUrl: '' }), { forTest: true })).toHaveProperty(
      'baseUrl',
    );
    expect(validateAuth(draft({ baseUrl: 'nope' }))).toHaveProperty('baseUrl');
  });
  it('requires an Access ID for Assa Abloy', () => {
    expect(validateAuth(draft({ provider: 'assa-abloy' }))).toEqual({
      accessId: 'Access ID is required for Assa Abloy.',
    });
    expect(validateAuth(draft({ provider: 'assa-abloy', accessId: 'A1' }))).toEqual({});
  });
  it('sends the password only when typed, and creates the UUID once for Assa Abloy', () => {
    expect(authInput(draft(), () => 'u')).not.toHaveProperty('password');
    expect(authInput(draft({ password: 'pw' }), () => 'u')).toHaveProperty('password', 'pw');
    expect(authInput(draft(), () => 'u')).not.toHaveProperty('uuid');
    const assa = draft({ provider: 'assa-abloy', accessId: ' A1 ' });
    expect(authInput(assa, () => 'new-uuid')).toMatchObject({ accessId: 'A1', uuid: 'new-uuid' });
    expect(authInput({ ...assa, uuid: 'kept' }, () => 'new-uuid').uuid).toBe('kept');
  });
  it('asks for the password again when the URL or username changed', () => {
    const saved = draft();
    expect(needsPasswordRetype(draft(), saved)).toBe(false);
    expect(needsPasswordRetype(draft({ baseUrl: 'https://other.example.com' }), saved)).toBe(true);
    expect(needsPasswordRetype(draft({ userName: 'x' }), saved)).toBe(true);
    expect(
      needsPasswordRetype(draft({ baseUrl: 'https://other.example.com', password: 'p' }), saved),
    ).toBe(false);
    expect(needsPasswordRetype(draft({ baseUrl: 'x' }), draft({ hasPassword: false }))).toBe(false);
    expect(validateAuth(draft({ baseUrl: 'https://other.example.com' }), { saved })).toHaveProperty(
      'password',
    );
  });
  it('counts a changed UUID as a change', () => {
    const saved = [draft({ provider: 'assa-abloy', accessId: 'A1', uuid: 'u1' })];
    expect(authChanged(saved, [{ ...saved[0], uuid: 'u2' }])).toBe(true);
  });
  it('detects a change, and a typed password counts', () => {
    const saved = [draft(), draft({ provider: 'assa-abloy', accessId: 'A1' })];
    expect(authChanged(saved, saved)).toBe(false);
    expect(authChanged(saved, [draft({ enabled: false }), saved[1]])).toBe(true);
    expect(authChanged(saved, [draft({ password: 'x' }), saved[1]])).toBe(true);
    expect(authChanged(saved, [draft({ baseUrl: ' https://tms.example.com ' }), saved[1]])).toBe(
      false,
    );
  });
});

describe('connection outcomes', () => {
  it('words the save result like the legacy toast', () => {
    expect(saveOutcome([])).toEqual({
      severity: 'success',
      message: 'Authentications saved successfully.',
    });
    expect(saveOutcome([{ provider: 'tiger-tms', success: true }]).message).toBe(
      'Connection has been made successfully.',
    );
    expect(saveOutcome([{ provider: 'assa-abloy', success: false }])).toEqual({
      severity: 'error',
      message: 'Credentials saved, but connection test failed for Assa Abloy.',
    });
    expect(
      saveOutcome([
        { provider: 'tiger-tms', success: false },
        { provider: 'assa-abloy', success: false },
      ]).message,
    ).toBe('Credentials saved, but connection tests failed for Tiger TMS and Assa Abloy.');
    expect(
      saveOutcome([
        { provider: 'tiger-tms', success: true },
        { provider: 'assa-abloy', success: false },
      ]).message,
    ).toBe('Credentials saved, but connection test failed for Assa Abloy.');
  });
  it('words a single test', () => {
    expect(testOutcome({ provider: 'tiger-tms', success: true }).message).toBe(
      'Successful connection to Tiger TMS.',
    );
    expect(testOutcome({ provider: 'assa-abloy', success: false })).toEqual({
      severity: 'error',
      message: 'Connection to Assa Abloy failed.',
    });
  });
  it('mock connection needs a URL, a password and a host that is not offline', () => {
    expect(mockConnectionWorks('https://tms.example.com', true)).toBe(true);
    expect(mockConnectionWorks('https://tms.example.com', false)).toBe(false);
    expect(mockConnectionWorks('nope', true)).toBe(false);
    expect(mockConnectionWorks('https://offline.example.com', true)).toBe(false);
  });
});
