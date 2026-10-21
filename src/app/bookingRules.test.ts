import { mockBookingRules } from '../api/bookingRulesData';
import type { BookingRules } from '../api/types';
import {
  effectiveRules,
  holdFromRules,
  newMemberTypeRule,
  periodDays,
  rulesDirty,
  setUniqueMemberTypeRules,
  toggleColumn,
  validateBookingRules,
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

  it('keeps the deposit amount only for a deposit', () => {
    const col = { ...rules().member!, payment: 'deposit' as const, depositCents: 5000 };
    expect(withPayment(col, 'on-file').depositCents).toBeNull();
    expect(withPayment(col, 'deposit').depositCents).toBe(5000);
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

  it('requires a deposit amount when a deposit is required', () => {
    const r = rules();
    const noAmount = {
      ...r,
      member: { ...r.member!, payment: 'deposit' as const, depositCents: null },
    };
    expect(validateBookingRules(noAmount)['member.depositCents']).toBeDefined();
    const zero = { ...r, member: { ...r.member!, payment: 'deposit' as const, depositCents: 0 } };
    expect(validateBookingRules(zero)['member.depositCents']).toBeDefined();
    const prepay = {
      ...r,
      member: { ...r.member!, payment: 'prepayment' as const, depositCents: null },
    };
    expect(validateBookingRules(prepay)).toEqual({});
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
