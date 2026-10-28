import { describe, expect, it } from 'vitest';
import { createMockClient } from './mock';

const png = (name: string, size = 1000, type = 'image/png') => ({ name, type, size });
const request = (files: ReturnType<typeof png>[], existingCount = 0) => ({
  owner: 'room' as const,
  entityId: null,
  existingCount,
  files,
});

describe('mock photo upload', () => {
  const client = () => createMockClient({ latencyMs: 0 });

  it('answers one stored photo per file, in order, with distinct ids', async () => {
    const stored = await client().photos.upload(request([png('a.png'), png('b.png')]));
    expect(stored.map((p) => p.name)).toEqual(['a.png', 'b.png']);
    expect(new Set(stored.map((p) => p.id)).size).toBe(2);
  });

  it('refuses files outside the rules with a 422 that names each file', async () => {
    await expect(
      client().photos.upload(request([png('a.gif', 1000, 'image/gif')])),
    ).rejects.toMatchObject({
      status: 422,
      code: 'validation',
      details: { photos: ['a.gif is not a JPG or PNG image.'] },
    });
    await expect(client().photos.upload(request([png('big.png', 2e6)]))).rejects.toMatchObject({
      status: 422,
    });
    await expect(client().photos.upload(request([]))).rejects.toMatchObject({ status: 422 });
  });

  it('counts the photos the record already has', async () => {
    await expect(client().photos.upload(request([png('a.png')], 50))).rejects.toMatchObject({
      status: 422,
    });
  });
});
