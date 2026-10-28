import { createMockClient } from './mock';

describe('mock integrations API: API keys', () => {
  it('lists masked keys and never the secret', async () => {
    const keys = await createMockClient().integrations.listApiKeys();
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(JSON.stringify(key)).not.toContain('grk_');
      expect(key.maskedKey.endsWith('1111') || key.maskedKey.endsWith('2222')).toBe(true);
    }
  });

  it('shows the secret of a new key once, then only masked', async () => {
    const client = createMockClient();
    const issued = await client.integrations.createApiKey({
      name: ' Night  audit ',
      requestId: 'r1',
    });
    expect(issued.secret).toMatch(/^grk_[a-z0-9]{40}$/);
    expect(issued.key.name).toBe('Night audit');
    const listed = await client.integrations.listApiKeys();
    expect(listed).toHaveLength(3);
    expect(JSON.stringify(listed)).not.toContain(issued.secret);
  });

  it('replays a repeated create request instead of making a second key', async () => {
    const client = createMockClient();
    const a = await client.integrations.createApiKey({ name: 'Once', requestId: 'same' });
    const b = await client.integrations.createApiKey({ name: 'Once', requestId: 'same' });
    expect(b).toEqual(a);
    expect(await client.integrations.listApiKeys()).toHaveLength(3);
  });

  it('refuses a duplicate name (409) and a blank or long name (422)', async () => {
    const client = createMockClient();
    await expect(
      client.integrations.createApiKey({ name: 'accounting EXPORT', requestId: 'a' }),
    ).rejects.toMatchObject({ status: 409, code: 'duplicate' });
    await expect(
      client.integrations.createApiKey({ name: '  ', requestId: 'b' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('rotates to a different secret and keeps the key', async () => {
    const client = createMockClient();
    const first = await client.integrations.rotateApiKey({ id: 'key-1', requestId: 'x' });
    const second = await client.integrations.rotateApiKey({ id: 'key-1', requestId: 'y' });
    expect(second.secret).not.toBe(first.secret);
    expect(second.key.id).toBe('key-1');
    expect(second.key.maskedKey.endsWith(second.secret.slice(-4))).toBe(true);
    await expect(
      client.integrations.rotateApiKey({ id: 'missing', requestId: 'z' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('revokes a key, and 404s for one that is gone', async () => {
    const client = createMockClient();
    await client.integrations.revokeApiKey('key-1');
    expect((await client.integrations.listApiKeys()).map((k) => k.id)).toEqual(['key-2']);
    await expect(client.integrations.revokeApiKey('key-1')).rejects.toMatchObject({ status: 404 });
  });

  it('lists nothing in the empty scenario and fails in the error scenario', async () => {
    expect(await createMockClient({ scenario: 'empty' }).integrations.listApiKeys()).toEqual([]);
    await expect(
      createMockClient({ scenario: 'error' }).integrations.listApiKeys(),
    ).rejects.toMatchObject({ status: 500 });
  });
});

describe('mock integrations API: PayCloud tokens', () => {
  it('lists masked keys', async () => {
    const tokens = await createMockClient().integrations.listPayCloudTokens();
    expect(tokens.map((t) => t.environment)).toEqual(['production', 'test']);
    expect(JSON.stringify(tokens)).not.toContain('3f2b8c1e');
  });

  it('keeps a key that is not replaced, replaces one that is, adds and removes', async () => {
    const client = createMockClient();
    const saved = await client.integrations.savePayCloudTokens([
      { id: 'paycloud-1', environment: 'staging' },
      { apiKey: 'brand-new-key', environment: 'local' },
    ]);
    expect(saved.map((t) => t.environment)).toEqual(['staging', 'local']);
    expect(saved[0].maskedKey).toBe(
      (await createMockClient().integrations.listPayCloudTokens())[0].maskedKey,
    );
    expect(saved[1].id).toBe('paycloud-3');
    const replaced = await client.integrations.savePayCloudTokens([
      { id: 'paycloud-3', apiKey: 'another-key-0000', environment: 'local' },
    ]);
    expect(replaced).toHaveLength(1);
    expect(replaced[0].maskedKey.endsWith('0000')).toBe(true);
  });

  it('rejects a new token without a key, a long key and an unknown id', async () => {
    const client = createMockClient();
    for (const tokens of [
      [{ environment: 'test' as const }],
      [{ apiKey: 'x'.repeat(37), environment: 'test' as const }],
    ]) {
      await expect(client.integrations.savePayCloudTokens(tokens)).rejects.toMatchObject({
        status: 422,
      });
    }
    await expect(
      client.integrations.savePayCloudTokens([{ id: 'nope', environment: 'test' }]),
    ).rejects.toMatchObject({ status: 404 });
    expect(await client.integrations.listPayCloudTokens()).toHaveLength(2);
  });
});

describe('mock integrations API: authentications', () => {
  it('starts with both integrations disabled and no password', async () => {
    const list = await createMockClient().integrations.listAuthentications();
    expect(list.map((a) => [a.provider, a.enabled, a.hasPassword])).toEqual([
      ['tiger-tms', false, false],
      ['assa-abloy', false, false],
    ]);
  });

  it('saves, never returns the password, and tests only the enabled integrations', async () => {
    const client = createMockClient();
    const result = await client.integrations.saveAuthentications([
      {
        provider: 'tiger-tms',
        enabled: true,
        baseUrl: 'https://tms.example.com',
        userName: 'svc',
        password: 'secret-pw',
      },
      {
        provider: 'assa-abloy',
        enabled: false,
        baseUrl: '',
        userName: '',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('secret-pw');
    expect(result.tests).toEqual([{ provider: 'tiger-tms', success: true }]);
    expect(result.authentications[0].hasPassword).toBe(true);
    // A later save without a password keeps the saved one.
    const again = await client.integrations.saveAuthentications([
      { provider: 'tiger-tms', enabled: true, baseUrl: 'https://tms.example.com', userName: 'svc' },
    ]);
    expect(again.authentications[0].hasPassword).toBe(true);
    expect(again.tests[0].success).toBe(true);
  });

  it('reports a failed connection test after saving', async () => {
    const result = await createMockClient().integrations.saveAuthentications([
      {
        provider: 'assa-abloy',
        enabled: true,
        baseUrl: 'https://offline.example.com',
        userName: 'u',
        password: 'p',
        accessId: 'A1',
        uuid: 'u-1',
      },
    ]);
    expect(result.tests).toEqual([{ provider: 'assa-abloy', success: false }]);
  });

  it('refuses an enabled integration with a bad URL or no Access ID (422)', async () => {
    const client = createMockClient();
    await expect(
      client.integrations.saveAuthentications([
        { provider: 'tiger-tms', enabled: true, baseUrl: 'nope', userName: '' },
      ]),
    ).rejects.toMatchObject({ status: 422, details: { baseUrl: expect.any(Array) } });
    await expect(
      client.integrations.saveAuthentications([
        { provider: 'assa-abloy', enabled: true, baseUrl: 'https://a.example.com', userName: '' },
      ]),
    ).rejects.toMatchObject({ status: 422, details: { accessId: expect.any(Array) } });
  });

  it('tests a connection with the saved password when none is typed, without saving', async () => {
    const client = createMockClient();
    const input = {
      provider: 'tiger-tms' as const,
      enabled: true,
      baseUrl: 'https://tms.example.com',
      userName: 'svc',
    };
    expect(await client.integrations.testConnection(input)).toEqual({
      provider: 'tiger-tms',
      success: false,
    });
    expect(await client.integrations.testConnection({ ...input, password: 'pw' })).toEqual({
      provider: 'tiger-tms',
      success: true,
    });
    expect((await client.integrations.listAuthentications())[0].hasPassword).toBe(false);
  });
});
