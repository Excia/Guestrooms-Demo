import { createMockClient } from './mock';
import { mockBookingRules } from './bookingRulesData';

describe('mock booking rules', () => {
  it('returns copies and the options', async () => {
    const client = createMockClient();
    const rules = await client.bookingRules.get();
    rules.employee.holdMinutes = 1;
    expect((await client.bookingRules.get()).employee.holdMinutes).toBe(15);
    expect((await client.bookingRules.getOptions()).roomTypes.length).toBeGreaterThan(0);
  });

  it('stores a valid save and feeds the booking hold from it', async () => {
    const client = createMockClient();
    const next = mockBookingRules();
    next.member!.holdMinutes = 30;
    await client.bookingRules.save(next);
    expect((await client.settings.getBookingHold()).member).toBe(30);
  });

  it('refuses invalid rules with a 422', async () => {
    const client = createMockClient();
    const bad = mockBookingRules();
    bad.employee.holdMinutes = 0;
    await expect(client.bookingRules.save(bad)).rejects.toMatchObject({
      status: 422,
      code: 'validation',
    });
    expect((await client.bookingRules.get()).employee.holdMinutes).toBe(15);
  });
});
