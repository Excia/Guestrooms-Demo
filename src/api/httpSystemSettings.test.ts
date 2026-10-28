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

describe('house account', () => {
  it('rejects settings without houseAccount or with a malformed one, accepts null', async () => {
    const { houseAccount, ...without } = mockSystemSettings();
    expect(houseAccount).not.toBeNull();
    for (const body of [without, { ...without, houseAccount: { id: 1 } }]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(body))).systemSettings.get(),
      ).rejects.toMatchObject({ status: 200 });
    }
    const none = await make(
      vi.fn().mockResolvedValue(json({ ...without, houseAccount: null })),
    ).systemSettings.get();
    expect(none.houseAccount).toBeNull();
  });

  it('asks the lookup endpoint with the typed text and checks the list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([{ id: 'h1', label: 'Club' }]));
    expect(await make(fetchMock).systemSettings.listHouseAccounts('clu')).toEqual([
      { id: 'h1', label: 'Club' },
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.example.com/v1/settings/system/house-accounts?query=clu',
    );
    await expect(
      make(vi.fn().mockResolvedValue(json([{ id: 'h1' }]))).systemSettings.listHouseAccounts(''),
    ).rejects.toMatchObject({ status: 200 });
  });
});

describe('default rate categories response validation', () => {
  it('reads a missing object as none chosen and rejects a malformed one', async () => {
    const { defaultRateCategories, ...without } = mockSystemSettings();
    expect(defaultRateCategories.member).not.toBeNull();
    const result = await make(vi.fn().mockResolvedValue(json(without))).systemSettings.get();
    expect(result.defaultRateCategories).toEqual({
      roomBlock: null,
      member: null,
      nonMember: null,
      owner: null,
      memberTypeOverrides: [],
    });
    const broken = { ...without, defaultRateCategories: { ...defaultRateCategories, member: 5 } };
    await expect(
      make(vi.fn().mockResolvedValue(json(broken))).systemSettings.get(),
    ).rejects.toMatchObject({
      status: 200,
    });
  });

  it('reads options without the new lists as empty', async () => {
    const { rateCategories, memberTypes, ...old } = (await import('./systemSettingsData'))
      .MOCK_SYSTEM_SETTINGS_OPTIONS;
    expect(rateCategories).toEqual([]);
    expect(memberTypes).toEqual([]);
    const result = await make(vi.fn().mockResolvedValue(json(old))).systemSettings.getOptions();
    expect(result.rateCategories).toEqual([]);
    expect(result.memberTypes).toEqual([]);
  });
});
