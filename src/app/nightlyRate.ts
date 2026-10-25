// The price of a night and of a stay from a rate category (pure). PARTIAL port of the legacy
// ReservationService.getRateForDate: per-room rate overrides are not built (see
// docs/requirements/entries/184-rate-categories.md). Amounts are integer cents, per night, without
// tax or service charge. Unlike legacy, an unset amount is 0, never null, so an alternative base of
// 0 prices at 0 (it does not fall back to the standard base; Q-184-9).
import type {
  AlternativeBaseRate,
  Cents,
  RateAmounts,
  RateColumnKey,
  RateSeason,
} from '../api/types';
import { addDays, daysBetween, parseIsoDate, type IsoDate } from '../lib/dates';
import { blankAmounts } from './rateCategories';

/** Columns of the weekday add-ons, indexed by `Date.getUTCDay()` (0 = Sunday). */
const WEEKDAY_COLUMNS: Record<0 | 1 | 2 | 3 | 4 | 5 | 6, RateColumnKey> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/** A stay longer than this is not priced (a guard against absurd input, not a booking rule). */
export const MAX_PRICED_NIGHTS = 366;

/** Whole non-negative count; NaN, infinity and negatives read as 0. */
const count = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** The club's alternative base rate settings (System Settings). */
export interface AlternativeBaseRates {
  alternativeBaseRate1: AlternativeBaseRate;
  alternativeBaseRate2: AlternativeBaseRate;
}

export interface StayGuests {
  /** At least 1; guests 2, 3 and 4+ add their amounts. */
  adults: number;
  children: number;
}

export interface NightlyRateInput {
  seasons: readonly RateSeason[];
  roomTypeId: string;
  /** The night (yyyy-mm-dd): the evening of this date. */
  date: IsoDate;
  /** Length of the whole stay; decides the alternative base rate. */
  stayNights: number;
  guests: StayGuests;
  alternativeBaseRates: AlternativeBaseRates | null;
}

export type BaseRateKind = 'standardBase' | 'altBase1' | 'altBase2';

export interface NightlyRate {
  date: IsoDate;
  /** The season used, or null when the category has none for this night. */
  seasonId: string | null;
  /** The base column that applied (an alternative base replaces the standard base). */
  baseKind: BaseRateKind;
  base: Cents;
  /** Add-on of the night's weekday (0 = no extra charge). */
  weekday: Cents;
  guest2: Cents;
  guest3: Cents;
  guest4Plus: Cents;
  child: Cents;
  total: Cents;
}

const ZERO_NIGHT = (date: IsoDate): NightlyRate => ({
  date,
  seasonId: null,
  baseKind: 'standardBase',
  base: 0,
  weekday: 0,
  guest2: 0,
  guest3: 0,
  guest4Plus: 0,
  child: 0,
  total: 0,
});

/**
 * The season whose rates price a night: a dated season strictly containing it, else the default.
 * LEGACY PARITY: legacy `getRateForDate` compares with isAfter(start) and isBefore(end), so a night
 * ON the start or end date of a season is priced by the default season. That looks like an
 * off-by-one (Q-184-8, owner to decide); it is kept on purpose. `seasonFor` (rateCategories.ts) is
 * inclusive and is not used for pricing.
 */
export function pricingSeasonFor(
  seasons: readonly RateSeason[],
  date: IsoDate,
): RateSeason | undefined {
  return (
    seasons.find((s) => !s.isDefault && s.startDate < date && date < s.endDate) ??
    seasons.find((s) => s.isDefault)
  );
}

/**
 * Which base column a stay of `stayNights` uses: alternative base rate 2 when enabled and the stay
 * has at least its night count, else alternative base rate 1 likewise, else the standard base.
 */
export function baseKindFor(stayNights: number, alt: AlternativeBaseRates | null): BaseRateKind {
  if (alt?.alternativeBaseRate2.enabled && stayNights >= alt.alternativeBaseRate2.minNights) {
    return 'altBase2';
  }
  if (alt?.alternativeBaseRate1.enabled && stayNights >= alt.alternativeBaseRate1.minNights) {
    return 'altBase1';
  }
  return 'standardBase';
}

/**
 * The room type's row for a night: the season's own row, or the default season's row when the
 * season has none for the room type (the fallback is per row, not per field, so a season row of
 * zeros stays zeros).
 */
function rowFor(
  seasons: readonly RateSeason[],
  season: RateSeason,
  roomTypeId: string,
): RateAmounts | undefined {
  const own = season.rates[roomTypeId];
  if (own) return { ...blankAmounts(), ...own };
  const fallback = seasons.find((s) => s.isDefault)?.rates[roomTypeId];
  return fallback ? { ...blankAmounts(), ...fallback } : undefined;
}

/**
 * Price of one night. Base (standard, or the alternative base that replaces it) plus the weekday
 * add-on, plus Guest 2 when there is more than 1 adult, Guest 3 for more than 2, Guest 4+ for each
 * adult past the third, and Child for each child. A night with no season or no row for the room
 * type costs 0.
 */
export function nightlyRate(input: NightlyRateInput): NightlyRate {
  const { seasons, roomTypeId, date, stayNights, guests, alternativeBaseRates } = input;
  const night = ZERO_NIGHT(date);
  const day = parseIsoDate(date);
  const season = day ? pricingSeasonFor(seasons, date) : undefined;
  const row = season ? rowFor(seasons, season, roomTypeId) : undefined;
  if (!day || !season || !row) return night;

  const adults = count(guests.adults);
  const children = count(guests.children);
  const baseKind = baseKindFor(stayNights, alternativeBaseRates);
  const weekday = row[WEEKDAY_COLUMNS[day.getUTCDay() as keyof typeof WEEKDAY_COLUMNS]];
  const guest2 = adults > 1 ? row.guest2 : 0;
  const guest3 = adults > 2 ? row.guest3 : 0;
  const guest4Plus = adults > 3 ? row.guest4Plus * (adults - 3) : 0;
  const child = row.child * children;
  const base = row[baseKind];
  return {
    date,
    seasonId: season.id,
    baseKind,
    base,
    weekday,
    guest2,
    guest3,
    guest4Plus,
    child,
    total: base + weekday + guest2 + guest3 + guest4Plus + child,
  };
}

export interface StayRateInput extends Omit<NightlyRateInput, 'date' | 'stayNights'> {
  arrival: IsoDate;
  departure: IsoDate;
}

export interface StayRate {
  nights: NightlyRate[];
  total: Cents;
}

/**
 * Price of a stay: one night per date from arrival up to (not including) departure. A stay of no
 * nights, invalid dates or more than MAX_PRICED_NIGHTS prices as empty (0).
 */
export function stayRate(input: StayRateInput): StayRate {
  const length = daysBetween(input.arrival, input.departure);
  if (!Number.isFinite(length) || length < 1 || length > MAX_PRICED_NIGHTS)
    return { nights: [], total: 0 };
  const nights = Array.from({ length }, (_, i) =>
    nightlyRate({ ...input, date: addDays(input.arrival, i), stayNights: length }),
  );
  return { nights, total: nights.reduce((sum, n) => sum + n.total, 0) };
}
