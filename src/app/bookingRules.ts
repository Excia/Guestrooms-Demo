// Business rules of Booking Rules (ticket 7.5): column toggles, validation and the lookup the
// online booking and the admin New Reservation search use. Pure functions; the page only calls them.
import { MAX_RATE_CENTS } from './rateCategories';
import type {
  AudienceRules,
  BookingHold,
  BookingRules,
  Cents,
  DepositType,
  MemberTypeRule,
  TimePeriod,
  TimeUnit,
} from '../api/types';

// FLAG: Figma does not list the units (Q-74-1); months, weeks and days are offered meanwhile.
export const TIME_UNITS: readonly TimeUnit[] = ['days', 'weeks', 'months'];
export const PERIOD_AMOUNT = { min: 1, max: 99 } as const;
export const HOLD_MINUTES = { min: 1, max: 99 } as const;
export const MAX_ROOMS = { min: 1, max: 99 } as const;

export type Audience = 'employee' | 'member' | 'nonMember';

const DAYS_PER_UNIT: Record<TimeUnit, number> = { days: 1, weeks: 7, months: 30 };

/** Length of a period in days (a month counts 30 days; only used to compare two periods). */
export const periodDays = ({ amount, unit }: TimePeriod): number => amount * DAYS_PER_UNIT[unit];

export const DEFAULT_ONLINE_RULES: AudienceRules = {
  requireMemberReserver: false,
  namedOccupants: 'lead',
  contactInfo: 'email-and-phone',
  opens: { amount: 6, unit: 'months' },
  closes: { amount: 1, unit: 'days' },
  cancellation: { amount: 2, unit: 'days' },
  holdMinutes: 10,
  payment: 'on-file',
  depositType: null,
  depositValue: null,
  roomSelection: 'room-optional',
  excludedRoomTypeIds: [],
  maxRoomsPerReservation: 6,
  addOnPopup: false,
};

/** Rules of a column that has just been switched on (the non-member column has no reserver rule). */
export const defaultOnlineRules = (audience: 'member' | 'nonMember'): AudienceRules => ({
  ...structuredClone(DEFAULT_ONLINE_RULES),
  requireMemberReserver: audience === 'member' ? false : null,
});

export type BookingRulesToggle = 'memberOnline' | 'nonMemberOnline';

/**
 * Applies a column toggle. Turning Member Online Booking off clears both online columns and the
 * member type rules (online booking is then not an option); turning Non-Member Online Booking off
 * clears only its column. Turning one on gives the column its defaults. Non-member online booking
 * needs member online booking, so it cannot be switched on while the member column is off.
 */
export function toggleColumn(
  rules: BookingRules,
  toggle: BookingRulesToggle,
  on: boolean,
): BookingRules {
  if (toggle === 'memberOnline') {
    if (on) return rules.member ? rules : { ...rules, member: defaultOnlineRules('member') };
    return {
      ...rules,
      member: null,
      nonMember: null,
      uniqueMemberTypeRules: false,
      memberTypeRules: [],
    };
  }
  if (on) {
    if (!rules.member || rules.nonMember) return rules;
    return { ...rules, nonMember: defaultOnlineRules('nonMember') };
  }
  return { ...rules, nonMember: null };
}

/** Ticks or clears "Unique Member Type Rules" (only while member online booking is on). */
export function setUniqueMemberTypeRules(rules: BookingRules, on: boolean): BookingRules {
  if (!rules.member) return rules;
  return { ...rules, uniqueMemberTypeRules: on, memberTypeRules: on ? rules.memberTypeRules : [] };
}

export const PAYMENTS: readonly AudienceRules['payment'][] = [
  'optional',
  'on-file',
  'deposit',
  'prepayment',
];
export const DEPOSIT_PERCENT = { min: 0.01, max: 100 } as const;
/** A dollar deposit is at least one cent and at most the largest money value used elsewhere. */
export const DEPOSIT_MIN_DOLLARS = 0.01;
export const DEPOSIT_MAX_CENTS: Cents = MAX_RATE_CENTS;

/** Payment method changes clear the deposit unless it is a deposit (which starts as a dollar amount). */
export function withPayment(
  column: AudienceRules,
  payment: AudienceRules['payment'],
): AudienceRules {
  if (payment !== 'deposit') return { ...column, payment, depositType: null, depositValue: null };
  return {
    ...column,
    payment,
    depositType: column.depositType ?? 'amount',
    depositValue: column.depositValue ?? null,
  };
}

/** Switches a deposit between dollars and percent; the value is cleared because the units differ. */
export const withDepositType = (column: AudienceRules, depositType: DepositType): AudienceRules =>
  column.depositType === depositType ? column : { ...column, depositType, depositValue: null };

const hasAtMostTwoDecimals = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;

/** Error message for a deposit, or null when it is valid (or not a deposit). */
export function depositError(c: AudienceRules): string | null {
  if (c.payment !== 'deposit') return null;
  const v = c.depositValue;
  if (c.depositType === 'percent') {
    return v !== null &&
      v >= DEPOSIT_PERCENT.min &&
      v <= DEPOSIT_PERCENT.max &&
      hasAtMostTwoDecimals(v)
      ? null
      : `Enter a percentage from ${DEPOSIT_PERCENT.min} to ${DEPOSIT_PERCENT.max}, up to 2 decimals.`;
  }
  return c.depositType === 'amount' &&
    v !== null &&
    Number.isInteger(v) &&
    v >= Math.round(DEPOSIT_MIN_DOLLARS * 100) &&
    v <= DEPOSIT_MAX_CENTS
    ? null
    : `Enter a deposit from $${DEPOSIT_MIN_DOLLARS} to $${(DEPOSIT_MAX_CENTS / 100).toLocaleString('en-US')}.`;
}

/**
 * The deposit due at booking for a stay total, in cents. A dollar amount is capped at the total; a
 * percentage is rounded to the nearest cent (halves up). No deposit rule means nothing is due.
 */
export function depositDueCents(
  rule: Pick<AudienceRules, 'payment' | 'depositType' | 'depositValue'>,
  totalCents: Cents,
): Cents {
  const v = rule.depositValue;
  if (
    rule.payment !== 'deposit' ||
    v === null ||
    !Number.isFinite(v) ||
    !Number.isFinite(totalCents)
  )
    return 0;
  if (totalCents <= 0) return 0;
  const due =
    rule.depositType === 'percent'
      ? Math.round((totalCents * Math.round(v * 100)) / 10_000)
      : rule.depositType === 'amount'
        ? v
        : 0;
  return Math.min(Math.max(due, 0), totalCents);
}

/**
 * Brings a stored column up to date: older data has `depositCents` instead of the deposit type and
 * value, and means a dollar amount.
 */
export function normalizeAudienceRules(raw: AudienceRules): AudienceRules {
  const { depositCents, ...rest } = raw as AudienceRules & { depositCents?: Cents | null };
  // An unknown payment value is treated as the safe default instead of blocking the page.
  const payment = PAYMENTS.includes(raw.payment) ? raw.payment : 'on-file';
  if (payment !== 'deposit') return { ...rest, payment, depositType: null, depositValue: null };
  if (raw.depositType === undefined || raw.depositType === null) {
    const legacy = raw.depositValue ?? depositCents ?? null;
    return { ...rest, payment, depositType: 'amount', depositValue: legacy };
  }
  return { ...rest, payment, depositType: raw.depositType, depositValue: raw.depositValue ?? null };
}

export const newMemberTypeRule = (id: string): MemberTypeRule => ({
  id,
  memberTypeId: null,
  excludeFromOnlineBooking: false,
  excludedRoomTypeIds: [],
  opens: { amount: 6, unit: 'months' },
  closes: null,
});

export type BookingRulesErrorKey =
  | `${Audience}.${'opens' | 'closes' | 'holdMinutes' | 'deposit' | 'maxRoomsPerReservation'}`
  | `memberType.${string}.${'memberTypeId' | 'opens' | 'closes'}`;

/** Messages by field; the page shows them beside the cell. */
export type BookingRulesErrors = Partial<Record<BookingRulesErrorKey, string>>;

const validPeriod = (p: TimePeriod) =>
  Number.isInteger(p.amount) &&
  p.amount >= PERIOD_AMOUNT.min &&
  p.amount <= PERIOD_AMOUNT.max &&
  TIME_UNITS.includes(p.unit);

const OPENS_AFTER_CLOSES =
  'Booking Opens must be earlier than Booking Closes (more time before check in).';

/** Every rule that stops a save. */
export function validateBookingRules(rules: BookingRules): BookingRulesErrors {
  const errors: BookingRulesErrors = {};
  const columns: [Audience, AudienceRules | null][] = [
    ['employee', rules.employee],
    ['member', rules.member],
    ['nonMember', rules.nonMember],
  ];
  for (const [audience, c] of columns) {
    if (!c) continue;
    if (!validPeriod(c.opens)) errors[`${audience}.opens`] = 'Choose a number and a unit.';
    if (c.closes && !validPeriod(c.closes))
      errors[`${audience}.closes`] = 'Choose a number and a unit.';
    if (
      !errors[`${audience}.opens`] &&
      c.closes &&
      !errors[`${audience}.closes`] &&
      periodDays(c.opens) <= periodDays(c.closes)
    ) {
      errors[`${audience}.closes`] = OPENS_AFTER_CLOSES;
    }
    if (
      !Number.isInteger(c.holdMinutes) ||
      c.holdMinutes < HOLD_MINUTES.min ||
      c.holdMinutes > HOLD_MINUTES.max
    ) {
      errors[`${audience}.holdMinutes`] =
        `Enter ${HOLD_MINUTES.min} to ${HOLD_MINUTES.max} minutes.`;
    }
    const deposit = depositError(c);
    if (deposit) errors[`${audience}.deposit`] = deposit;
    if (
      !Number.isInteger(c.maxRoomsPerReservation) ||
      c.maxRoomsPerReservation < MAX_ROOMS.min ||
      c.maxRoomsPerReservation > MAX_ROOMS.max
    ) {
      errors[`${audience}.maxRoomsPerReservation`] =
        `Enter ${MAX_ROOMS.min} to ${MAX_ROOMS.max} rooms.`;
    }
  }
  if (rules.member && rules.uniqueMemberTypeRules) {
    const seen = new Set<string>();
    for (const row of rules.memberTypeRules) {
      const key = (field: 'memberTypeId' | 'opens' | 'closes') =>
        `memberType.${row.id}.${field}` as const;
      if (row.memberTypeId === null) errors[key('memberTypeId')] = 'Choose a member type.';
      else if (seen.has(row.memberTypeId))
        errors[key('memberTypeId')] = 'This member type already has a rule.';
      else seen.add(row.memberTypeId);
      if (!validPeriod(row.opens)) errors[key('opens')] = 'Choose a number and a unit.';
      if (row.closes && !validPeriod(row.closes))
        errors[key('closes')] = 'Choose a number and a unit.';
      if (
        !errors[key('opens')] &&
        row.closes &&
        !errors[key('closes')] &&
        periodDays(row.opens) <= periodDays(row.closes)
      ) {
        errors[key('closes')] = OPENS_AFTER_CLOSES;
      }
    }
  }
  return errors;
}

/** True when the draft differs from what was last saved. */
export const rulesDirty = (saved: BookingRules, draft: BookingRules): boolean =>
  JSON.stringify(saved) !== JSON.stringify(draft);

export interface EffectiveBookingRules extends AudienceRules {
  /** Online booking is not possible for this person (column off, or the member type is excluded). */
  onlineBookingAllowed: boolean;
}

/**
 * The rules that apply to one booking. Employees get their column. A member gets the member
 * column, with their member type's rule (opens, closes, excluded room types) taking precedence
 * when "Unique Member Type Rules" is on; a non-member gets the non-member column. A column that is
 * off, or an excluded member type, means no online booking.
 */
export function effectiveRules(
  rules: BookingRules,
  who:
    | { audience: 'employee' }
    | { audience: 'member'; memberTypeId?: string }
    | { audience: 'nonMember' },
): EffectiveBookingRules {
  if (who.audience === 'employee')
    return { ...structuredClone(rules.employee), onlineBookingAllowed: true };
  if (who.audience === 'nonMember') {
    const column = rules.nonMember;
    // Without a non-member column only logged-in members book online; the member column is the default.
    return column
      ? { ...structuredClone(column), onlineBookingAllowed: true }
      : { ...structuredClone(rules.member ?? DEFAULT_ONLINE_RULES), onlineBookingAllowed: false };
  }
  const column = rules.member;
  if (!column) return { ...structuredClone(DEFAULT_ONLINE_RULES), onlineBookingAllowed: false };
  const override =
    rules.uniqueMemberTypeRules && who.memberTypeId
      ? rules.memberTypeRules.find((r) => r.memberTypeId === who.memberTypeId)
      : undefined;
  if (!override) return { ...structuredClone(column), onlineBookingAllowed: true };
  return {
    ...structuredClone(column),
    opens: { ...override.opens },
    closes: override.closes ? { ...override.closes } : null,
    excludedRoomTypeIds: [...override.excludedRoomTypeIds],
    onlineBookingAllowed: !override.excludeFromOnlineBooking,
  };
}

/** "Reservation Hold" minutes per audience, as the hold timer reads them. */
export const holdFromRules = (rules: BookingRules): BookingHold => ({
  employee: rules.employee.holdMinutes,
  member: rules.member?.holdMinutes ?? DEFAULT_ONLINE_RULES.holdMinutes,
  nonMember: rules.nonMember?.holdMinutes ?? DEFAULT_ONLINE_RULES.holdMinutes,
});
