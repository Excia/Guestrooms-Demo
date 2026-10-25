import { mockBookingRules } from '../api/bookingRulesData';
import type { BookingRules } from '../api/types';
import {
  depositDueCents,
  effectiveRules,
  holdFromRules,
  newMemberTypeRule,
  normalizeAudienceRules,
  periodDays,
  rulesDirty,
  setUniqueMemberTypeRules,
  toggleColumn,
  validateBookingRules,
  withDepositType,
  withPayment,
} from './bookingRules';

const rules = (over: Partial<BookingRules> = {}): BookingRules => ({
  ...mockBookingRules(),
  ...over,
});

describe('column toggles', () => {
  it('clears both online columns and the member type rules when member online booking is off', () => {
    const next = toggleColumn(rules(), 'memberOnline', false);
    expect(next.member).toBeNull();
    expect(next.nonMember).toBeNull();
    expect(next.uniqueMemberTypeRules).toBe(false);
    expect(next.memberTypeRules).toEqual([]);
    expect(next.employee).toEqual(rules().employee);
  });

  it('clears only the non-member column when non-member online booking is off', () => {
    const before = rules();
    const next = toggleColumn(before, 'nonMemberOnline', false);
    expect(next.nonMember).toBeNull();
    expect(next.member).toEqual(before.member);
    expect(next.memberTypeRules).toEqual(before.memberTypeRules);
  });

  it('gives a column that is switched on its defaults', () => {
    const off = toggleColumn(rules(), 'memberOnline', false);
    const on = toggleColumn(off, 'memberOnline', true);
    expect(on.member?.requireMemberReserver).toBe(false);
    expect(on.nonMember).toBeNull();
    const both = toggleColumn(on, 'nonMemberOnline', true);
    // Non-members never need a member reserver once non-member online booking is enabled: N/A.
    expect(both.nonMember?.requireMemberReserver).toBeNull();
  });

  it('cannot switch non-member online booking on while member online booking is off', () => {
    const off = toggleColumn(rules(), 'memberOnline', false);
    expect(toggleColumn(off, 'nonMemberOnline', true)).toBe(off);
  });

  it('keeps the settings of a column that is already on', () => {
    const r = rules();
    expect(toggleColumn(r, 'memberOnline', true)).toBe(r);
    expect(toggleColumn(r, 'nonMemberOnline', true)).toBe(r);
  });

  it('unticking Unique Member Type Rules drops the rows; it needs member online booking', () => {
    const next = setUniqueMemberTypeRules(rules(), false);
    expect(next.uniqueMemberTypeRules).toBe(false);
    expect(next.memberTypeRules).toEqual([]);
    const off = toggleColumn(rules(), 'memberOnline', false);
    expect(setUniqueMemberTypeRules(off, true)).toBe(off);
  });

  it('keeps the deposit only for a deposit; a new deposit starts as dollars', () => {
    const col = {
      ...rules().member!,
      payment: 'deposit' as const,
      depositType: 'percent' as const,
      depositValue: 20,
    };
    expect(withPayment(col, 'on-file')).toMatchObject({ depositType: null, depositValue: null });
    expect(withPayment(col, 'optional')).toMatchObject({ payment: 'optional', depositValue: null });
    expect(withPayment(col, 'deposit')).toMatchObject({ depositType: 'percent', depositValue: 20 });
    const fresh = withPayment(rules().nonMember!, 'deposit');
    expect(fresh).toMatchObject({ depositType: 'amount', depositValue: null });
  });

  it('clears the value when the deposit type changes', () => {
    const col = {
      ...rules().member!,
      payment: 'deposit' as const,
      depositType: 'amount' as const,
      depositValue: 5000,
    };
    expect(withDepositType(col, 'percent')).toMatchObject({
      depositType: 'percent',
      depositValue: null,
    });
    expect(withDepositType(col, 'amount')).toBe(col);
  });
});

describe('validateBookingRules', () => {
  it('accepts the sample rules', () => {
    expect(validateBookingRules(rules())).toEqual({});
  });

  it('requires hold minutes from 1 to 99', () => {
    const r = rules();
    expect(
      validateBookingRules({ ...r, employee: { ...r.employee, holdMinutes: 0 } })[
        'employee.holdMinutes'
      ],
    ).toBeDefined();
    expect(
      validateBookingRules({ ...r, employee: { ...r.employee, holdMinutes: 100 } })[
        'employee.holdMinutes'
      ],
    ).toBeDefined();
    expect(validateBookingRules({ ...r, employee: { ...r.employee, holdMinutes: 99 } })).toEqual(
      {},
    );
  });

  it('requires booking to open earlier than it closes', () => {
    const r = rules();
    const bad = {
      ...r,
      member: {
        ...r.member!,
        opens: { amount: 2, unit: 'weeks' as const },
        closes: { amount: 15, unit: 'days' as const },
      },
    };
    expect(validateBookingRules(bad)['member.closes']).toMatch(/earlier/);
    const same = {
      ...r,
      member: {
        ...r.member!,
        opens: { amount: 1, unit: 'weeks' as const },
        closes: { amount: 7, unit: 'days' as const },
      },
    };
    expect(validateBookingRules(same)['member.closes']).toBeDefined();
    const ok = {
      ...r,
      member: {
        ...r.member!,
        opens: { amount: 1, unit: 'months' as const },
        closes: { amount: 29, unit: 'days' as const },
      },
    };
    expect(validateBookingRules(ok)).toEqual({});
  });

  it('allows "N/A" closes', () => {
    const r = rules();
    expect(validateBookingRules({ ...r, member: { ...r.member!, closes: null } })).toEqual({});
  });

  const withDeposit = (depositType: 'amount' | 'percent' | null, depositValue: number | null) => {
    const r = rules();
    return {
      ...r,
      member: { ...r.member!, payment: 'deposit' as const, depositType, depositValue },
    };
  };

  it('requires a deposit amount in cents above zero when a dollar deposit is required', () => {
    expect(validateBookingRules(withDeposit('amount', null))['member.deposit']).toBeDefined();
    expect(validateBookingRules(withDeposit('amount', 0))['member.deposit']).toBeDefined();
    expect(validateBookingRules(withDeposit('amount', 12.5))['member.deposit']).toBeDefined();
    expect(validateBookingRules(withDeposit('amount', 1))).toEqual({});
    expect(validateBookingRules(withDeposit(null, 100))['member.deposit']).toBeDefined();
  });

  it('accepts a percentage from 0.01 to 100 with at most two decimals', () => {
    for (const ok of [0.01, 12.5, 33.33, 100])
      expect(validateBookingRules(withDeposit('percent', ok))).toEqual({});
    for (const bad of [null, 0, 0.001, 100.01, 12.345, -5])
      expect(validateBookingRules(withDeposit('percent', bad))['member.deposit']).toBeDefined();
  });

  it('ignores the deposit for other payment methods', () => {
    const r = rules();
    for (const payment of ['optional', 'on-file', 'prepayment'] as const) {
      const next = {
        ...r,
        member: { ...r.member!, payment, depositType: null, depositValue: null },
      };
      expect(validateBookingRules(next)).toEqual({});
    }
  });

  it('computes the deposit due for a stay total', () => {
    const base = { payment: 'deposit' as const };
    expect(depositDueCents({ ...base, depositType: 'amount', depositValue: 9900 }, 50000)).toBe(
      9900,
    );
    expect(depositDueCents({ ...base, depositType: 'amount', depositValue: 9900 }, 5000)).toBe(
      5000,
    );
    expect(depositDueCents({ ...base, depositType: 'percent', depositValue: 25 }, 40000)).toBe(
      10000,
    );
    expect(depositDueCents({ ...base, depositType: 'percent', depositValue: 33.33 }, 10001)).toBe(
      3333,
    );
    expect(depositDueCents({ ...base, depositType: 'percent', depositValue: 12.5 }, 10001)).toBe(
      1250,
    );
    expect(depositDueCents({ ...base, depositType: 'percent', depositValue: 100 }, 777)).toBe(777);
    expect(
      depositDueCents({ payment: 'optional', depositType: null, depositValue: null }, 40000),
    ).toBe(0);
    expect(depositDueCents({ ...base, depositType: 'percent', depositValue: null }, 40000)).toBe(0);
    expect(depositDueCents({ ...base, depositType: 'percent', depositValue: 10 }, 0)).toBe(0);
  });

  it('reads older stored columns that have depositCents as a dollar amount', () => {
    const { depositType: _t, depositValue: _v, ...rest } = rules().member!;
    void _t;
    void _v;
    const legacy = { ...rest, payment: 'deposit', depositCents: 9900 } as never;
    expect(normalizeAudienceRules(legacy)).toMatchObject({
      depositType: 'amount',
      depositValue: 9900,
    });
    expect(normalizeAudienceRules(legacy)).not.toHaveProperty('depositCents');
    expect(
      normalizeAudienceRules({ ...rest, payment: 'on-file', depositCents: null } as never),
    ).toMatchObject({
      depositType: null,
      depositValue: null,
    });
    const current = rules().member!;
    expect(normalizeAudienceRules(current)).toEqual(current);
  });

  it('limits rooms per reservation', () => {
    const r = rules();
    expect(
      validateBookingRules({ ...r, nonMember: { ...r.nonMember!, maxRoomsPerReservation: 0 } })[
        'nonMember.maxRoomsPerReservation'
      ],
    ).toBeDefined();
  });

  it('skips switched-off columns', () => {
    const off = toggleColumn(rules(), 'memberOnline', false);
    expect(validateBookingRules(off)).toEqual({});
  });

  it('checks the member type rows: a type is required and used once, and closes follow opens', () => {
    const r = rules();
    const blank = newMemberTypeRule('new-1');
    const dup = { ...r.memberTypeRules[0], id: 'dup' };
    const errors = validateBookingRules({
      ...r,
      memberTypeRules: [...r.memberTypeRules, blank, dup],
    });
    expect(errors['memberType.new-1.memberTypeId']).toBe('Choose a member type.');
    expect(errors['memberType.dup.memberTypeId']).toMatch(/already/);
    const bad = { ...r.memberTypeRules[0], closes: { amount: 9, unit: 'months' as const } };
    expect(
      validateBookingRules({ ...r, memberTypeRules: [bad] })['memberType.rule-junior.closes'],
    ).toBeDefined();
  });

  it('ignores member type rows while Unique Member Type Rules is off', () => {
    const r = rules({ uniqueMemberTypeRules: false, memberTypeRules: [newMemberTypeRule('x')] });
    expect(validateBookingRules(r)).toEqual({});
  });
});

describe('effectiveRules', () => {
  it('gives employees their column', () => {
    const e = effectiveRules(rules(), { audience: 'employee' });
    expect(e.holdMinutes).toBe(15);
    expect(e.onlineBookingAllowed).toBe(true);
  });

  it('lets a member type rule take precedence over the member default', () => {
    const r = rules();
    const e = effectiveRules(r, { audience: 'member', memberTypeId: 'junior' });
    expect(e.opens).toEqual({ amount: 3, unit: 'months' });
    expect(e.closes).toEqual({ amount: 2, unit: 'days' });
    expect(e.excludedRoomTypeIds).toEqual(['suite']);
    expect(e.holdMinutes).toBe(r.member!.holdMinutes);
    const other = effectiveRules(r, { audience: 'member', memberTypeId: 'full' });
    expect(other.opens).toEqual(r.member!.opens);
  });

  it('ignores member type rules while Unique Member Type Rules is off', () => {
    const e = effectiveRules(rules({ uniqueMemberTypeRules: false }), {
      audience: 'member',
      memberTypeId: 'junior',
    });
    expect(e.opens).toEqual({ amount: 6, unit: 'months' });
  });

  it('refuses online booking for an excluded member type', () => {
    const r = rules();
    r.memberTypeRules[0].excludeFromOnlineBooking = true;
    expect(
      effectiveRules(r, { audience: 'member', memberTypeId: 'junior' }).onlineBookingAllowed,
    ).toBe(false);
  });

  it('refuses online booking when the column is off', () => {
    const off = toggleColumn(rules(), 'memberOnline', false);
    expect(effectiveRules(off, { audience: 'member' }).onlineBookingAllowed).toBe(false);
    expect(effectiveRules(off, { audience: 'nonMember' }).onlineBookingAllowed).toBe(false);
    const noNonMember = toggleColumn(rules(), 'nonMemberOnline', false);
    expect(effectiveRules(noNonMember, { audience: 'nonMember' }).onlineBookingAllowed).toBe(false);
    expect(effectiveRules(noNonMember, { audience: 'member' }).onlineBookingAllowed).toBe(true);
  });
});

describe('helpers', () => {
  it('reads the hold minutes per audience', () => {
    expect(holdFromRules(rules())).toEqual({ employee: 15, member: 10, nonMember: 10 });
  });

  it('converts periods to days and detects edits', () => {
    expect(periodDays({ amount: 2, unit: 'weeks' })).toBe(14);
    expect(periodDays({ amount: 1, unit: 'months' })).toBe(30);
    const saved = rules();
    expect(rulesDirty(saved, structuredClone(saved))).toBe(false);
    expect(rulesDirty(saved, toggleColumn(saved, 'nonMemberOnline', false))).toBe(true);
  });
});
