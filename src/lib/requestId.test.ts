import { newRequestId } from './requestId';

describe('newRequestId', () => {
  it('is unique and passes the API id format', () => {
    const ids = new Set(Array.from({ length: 50 }, newRequestId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  });
  it('falls back when randomUUID is missing', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(7) });
    expect(newRequestId()).toBe('07'.repeat(16));
    vi.stubGlobal('crypto', undefined);
    expect(newRequestId()).toMatch(/^[0-9a-f]{32}$/);
    vi.unstubAllGlobals();
  });
});
