import { mockBookingRules } from './bookingRulesData';
import { createHttpClient } from './http';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });
const get = (body: unknown) =>
  make(vi.fn().mockResolvedValue(json(body)) as unknown as typeof fetch).bookingRules.get();

describe('http booking rules client', () => {
  it('reads the rules from /settings/booking-rules', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(mockBookingRules()));
    const rules = await make(fetchMock).bookingRules.get();
    expect(rules.member?.depositType).toBe('amount');
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.example.com/v1/settings/booking-rules',
    );
  });

  it('converts an older depositCents into a dollar amount', async () => {
    const r = mockBookingRules();
    const { depositType: _t, depositValue: _v, ...member } = r.member!;
    void _t;
    void _v;
    const rules = await get({
      ...r,
      member: { ...member, payment: 'deposit', depositCents: 7500 },
    });
    expect(rules.member).toMatchObject({ depositType: 'amount', depositValue: 7500 });
    expect(rules.member).not.toHaveProperty('depositCents');
  });

  it('treats an unknown payment value as on-file instead of blocking the page', async () => {
    const r = mockBookingRules();
    const rules = await get({ ...r, member: { ...r.member!, payment: 'bitcoin' } });
    expect(rules.member).toMatchObject({
      payment: 'on-file',
      depositType: null,
      depositValue: null,
    });
  });

  it('rejects an unknown deposit type', async () => {
    const r = mockBookingRules();
    await expect(get({ ...r, member: { ...r.member!, depositType: 'tip' } })).rejects.toThrow();
  });
});
