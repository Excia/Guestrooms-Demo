// Rate rules of a room change during a stay (ticket 2.3, decision D-015). Pure and shared by the
// UI (app/) and the mock backend (api/), so both price a change the same way. Money is integer
// cents and excludes taxes and service charges (reporting decision, D-005).
import { addDays, daysBetween, type IsoDate } from './dates';
import type { RateChoice } from '../api/types';

export interface NightRate {
  date: IsoDate;
  amountCents: number;
}

/**
 * The first night a room change may reprice: the effective date, but never a night before today.
 * Nights before today are "stayed" and always keep their original price; tonight is the current
 * night and has not been stayed yet (it is posted by the night audit), so it can be repriced.
 */
export const firstRepricedNight = (effectiveDate: IsoDate, today: IsoDate): IsoDate =>
  effectiveDate < today ? today : effectiveDate;

/** The nights of [start, end) that are not stayed yet and so move with a room change: from today on. */
export function remainingNights(start: IsoDate, end: IsoDate, today: IsoDate): IsoDate[] {
  const from = firstRepricedNight(start, today);
  const count = Math.max(0, daysBetween(from, end));
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

export interface RateOutcome {
  nights: NightRate[];
  /** New total minus old total over all nights (negative when the new room is cheaper). */
  deltaCents: number;
  /** Nights whose price changed. */
  repricedNights: number;
  /** Some night that could be repriced has another price in the new room (the rate question applies). */
  ratesDiffer: boolean;
}

/**
 * Prices a room change. Nights before `max(effectiveDate, today)` are untouched. From then on a
 * night keeps its current price for 'retain' and takes the new room's price for 'update'; `null`
 * (no choice was asked: the setting is off) is the default and means 'update'.
 * `newRateCents` is one nightly rate or a function of the date.
 */
export function rateOutcome(input: {
  nights: readonly NightRate[];
  newRateCents: number | ((date: IsoDate) => number);
  effectiveDate: IsoDate;
  today: IsoDate;
  choice: RateChoice | null;
}): RateOutcome {
  const from = firstRepricedNight(input.effectiveDate, input.today);
  const rateFor = (date: IsoDate) =>
    typeof input.newRateCents === 'function' ? input.newRateCents(date) : input.newRateCents;
  const apply = input.choice !== 'retain';
  let deltaCents = 0;
  let repricedNights = 0;
  let ratesDiffer = false;
  const nights = input.nights.map((night): NightRate => {
    if (night.date < from) return { ...night };
    const next = rateFor(night.date);
    if (next === night.amountCents) return { ...night };
    ratesDiffer = true;
    if (!apply) return { ...night };
    deltaCents += next - night.amountCents;
    repricedNights += 1;
    return { date: night.date, amountCents: next };
  });
  return { nights, deltaCents, repricedNights, ratesDiffer };
}

/** The question "retain or update?" is asked only when the setting is on and the rates differ. */
export const needsRateChoice = (askRateOnRoomChange: boolean, ratesDiffer: boolean): boolean =>
  askRateOnRoomChange && ratesDiffer;

/** The `rateChoice` to send: the user's answer when the question was asked, else `null`. */
export const rateChoiceToSend = (asked: boolean, answer: RateChoice | null): RateChoice | null =>
  asked ? answer : null;
