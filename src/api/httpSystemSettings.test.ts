import { createHttpClient } from './http';
import { mockSystemSettings } from './systemSettingsData';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

describe('system settings response validation', () => {
  it('accepts a response with the Online Booking object', async () => {
    const body = mockSystemSettings();
    const result = await make(vi.fn().mockResolvedValue(json(body))).systemSettings.get();
    expect(result.onlineBooking.globalMessage).toBe(body.onlineBooking.globalMessage);
  });

  it('rejects a response without onlineBooking or with a malformed one', async () => {
    const { onlineBooking, ...without } = mockSystemSettings();
    const broken = { ...mockSystemSettings(), onlineBooking: { ...onlineBooking, policyUrl: 5 } };
    for (const body of [without, broken]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(body))).systemSettings.get(),
      ).rejects.toMatchObject({ status: 200 });
    }
  });
});
