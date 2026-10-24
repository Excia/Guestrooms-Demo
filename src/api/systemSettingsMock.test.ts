import { createMockClient } from './mock';
import { mockSystemSettings } from './systemSettingsData';
import { ApiError } from './types';

describe('mock system settings', () => {
  it('returns the settings and options, as copies', async () => {
    const client = createMockClient();
    const settings = await client.systemSettings.get();
    settings.serviceChargeLabel = 'changed';
    expect((await client.systemSettings.get()).serviceChargeLabel).toBe('Service Charge');
    const options = await client.systemSettings.getOptions();
    expect(options.timeZones.map((z) => z.label)).toContain('Eastern Standard Time');
  });

  it('stores a valid save and returns it', async () => {
    const client = createMockClient();
    const next = { ...mockSystemSettings(), nightAudit: 'automatic' as const };
    expect((await client.systemSettings.save(next)).nightAudit).toBe('automatic');
    expect((await client.systemSettings.get()).nightAudit).toBe('automatic');
  });

  it('refuses settings that break a rule with a 422', async () => {
    const client = createMockClient();
    const bad = {
      ...mockSystemSettings(),
      closeSettledFolios: { amount: 1, unit: 'hours' as const },
    };
    await expect(client.systemSettings.save(bad)).rejects.toMatchObject({
      status: 422,
      code: 'validation',
    });
    await expect(client.systemSettings.save(bad)).rejects.toBeInstanceOf(ApiError);
    expect((await client.systemSettings.get()).closeSettledFolios.amount).toBe(8);
  });

  it('refuses an Online Booking policy link that is not a web address', async () => {
    const client = createMockClient();
    const base = mockSystemSettings();
    const bad = { ...base, onlineBooking: { ...base.onlineBooking, policyUrl: 'nope' } };
    await expect(client.systemSettings.save(bad)).rejects.toMatchObject({ status: 422 });
  });

  it('stores the policy link without surrounding spaces', async () => {
    const client = createMockClient();
    const base = mockSystemSettings();
    const next = {
      ...base,
      onlineBooking: { ...base.onlineBooking, policyUrl: ' https://a.com/p ' },
    };
    expect((await client.systemSettings.save(next)).onlineBooking.policyUrl).toBe(
      'https://a.com/p',
    );
  });

  it('fails in the error scenario', async () => {
    const client = createMockClient({ scenario: 'error' });
    await expect(client.systemSettings.get()).rejects.toMatchObject({ status: 500 });
  });
});
