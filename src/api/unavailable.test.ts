import { createUnavailableClient } from './unavailable';
import { ApiError } from './types';

describe('createUnavailableClient', () => {
  it('rejects every call with the given error', async () => {
    const error = new ApiError(0, 'not configured', { code: 'unconfigured' });
    const client = createUnavailableClient(error);
    await expect(client.dashboard.getStats()).rejects.toBe(error);
    await expect(client.schedule.moveRoom({} as never)).rejects.toBe(error);
  });
});
