import { createMockClient } from './mock';

describe('mock keycards API', () => {
  it('lists, saves and re-lists the encoder keys', async () => {
    const client = createMockClient();
    expect(await client.keycards.listEncoders()).toHaveLength(2);
    expect(await client.keycards.saveEncoders(['48001937465209'])).toEqual(['48001937465209']);
    expect(await client.keycards.listEncoders()).toEqual(['48001937465209']);
    await client.keycards.saveEncoders([]);
    expect(await client.keycards.listEncoders()).toEqual([]);
  });

  it('rejects bad, blank and duplicate keys with 422', async () => {
    const client = createMockClient();
    for (const keys of [['12'], [''], ['48001937465209', '48001937465209']]) {
      await expect(client.keycards.saveEncoders(keys)).rejects.toMatchObject({ status: 422 });
    }
    expect(await client.keycards.listEncoders()).toHaveLength(2);
  });

  it('retrieves a fixed success response without saving it', async () => {
    const client = createMockClient();
    expect(await client.keycards.retrieveEncoders()).toEqual(['48001937465203']);
    expect(await client.keycards.listEncoders()).toHaveLength(2);
  });

  it('returns nothing to retrieve in the empty scenario and fails in the error scenario', async () => {
    expect(await createMockClient({ scenario: 'empty' }).keycards.retrieveEncoders()).toEqual([]);
    await expect(
      createMockClient({ scenario: 'error' }).keycards.retrieveEncoders(),
    ).rejects.toMatchObject({
      status: 500,
    });
  });
});
