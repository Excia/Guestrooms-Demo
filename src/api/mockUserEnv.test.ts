import { createApiClientFromEnvironment } from './index';
import { MOCK_USER_STORAGE_KEY } from './mockUsers';

const quiet = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
const store = (value: string | null) => ({
  getItem: (key: string) => (key === MOCK_USER_STORAGE_KEY ? value : null),
});
const roleOf = async (setup: ReturnType<typeof createApiClientFromEnvironment>) =>
  (await setup.client.permissions.getGrant()).role;

describe('mock user selection by build', () => {
  it('dev honours the stored user', async () => {
    const setup = createApiClientFromEnvironment({
      env: { DEV: true },
      storage: store('partial'),
      log: quiet,
    });
    expect(setup.devMock).toBe(true);
    expect(await roleOf(setup)).toBe('Staff with some setup');
  });

  it.each([
    ['corrupt value', 'root'],
    ['missing value', null],
  ])('dev falls back to the least privileged user for a %s', async (_label, value) => {
    const setup = createApiClientFromEnvironment({
      env: { DEV: true },
      storage: store(value),
      log: quiet,
    });
    expect(await roleOf(setup)).toBe('Staff');
  });

  it('a demo build always runs as the administrator and ignores the stored user', async () => {
    const setup = createApiClientFromEnvironment({
      env: { DEV: false, VITE_API_MODE: 'mock' },
      storage: store('non-admin'),
      log: quiet,
    });
    expect(setup.demo).toBe(true);
    expect(setup.devMock).toBe(false);
    expect(await roleOf(setup)).toBe('Administrator');
  });

  it('a production build never reads the stored user', () => {
    const getItem = vi.fn();
    createApiClientFromEnvironment({ env: { DEV: false }, storage: { getItem }, log: quiet });
    expect(getItem).not.toHaveBeenCalled();
  });
});
