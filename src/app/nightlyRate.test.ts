import { describe, expect, it } from 'vitest';
import type { RateAmounts, RateSeason } from '../api/types';
import { baseKindFor, nightlyRate, stayRate, type AlternativeBaseRates } from './nightlyRate';
import { blankAmounts } from './rateCategories';

const amounts = (a: Partial<RateAmounts>): RateAmounts => ({ ...blankAmounts(), ...a });
const season = (s: Partial<RateSeason> & { id: string }): RateSeason => ({
  name: s.id,
  isDefault: false,
  startDate: '',
  endDate: '',
  rates: {},
  ...s,
});
const defaultSeason = (rates: RateSeason['rates']) =>
  season({ id: 'default', isDefault: true, rates });

// 2026-10-26 is a Monday.
const MON = '2026-10-26';
const none: AlternativeBaseRates = {
  alternativeBaseRate1: { enabled: false, minNights: 7 },
  alternativeBaseRate2: { enabled: false, minNights: 30 },
};
const run = (seasons: RateSeason[], over: Partial<Parameters<typeof nightlyRate>[0]> = {}) =>
  nightlyRate({
    seasons,
    roomTypeId: 'rt',
    date: MON,
    stayNights: 1,
    guests: { adults: 1, children: 0 },
    alternativeBaseRates: none,
    ...over,
  });

describe('nightlyRate', () => {
  const rate = defaultSeason({
    rt: amounts({
      standardBase: 1000,
      monday: 250,
      saturday: 500,
      guest2: 300,
      guest3: 200,
      guest4Plus: 100,
      child: 50,
      altBase1: 800,
      altBase2: 600,
    }),
  });

  it('adds the weekday amount on top of the base ($10 + Monday)', () => {
    const n = run([rate]);
    expect(n).toMatchObject({ base: 1000, weekday: 250, total: 1250, baseKind: 'standardBase' });
  });

  it('treats a weekday amount of 0 as no surcharge', () => {
    expect(run([rate], { date: '2026-10-27' }).total).toBe(1000); // Tuesday
  });

  it('picks the amount of the night weekday, including Sunday and Saturday', () => {
    expect(run([rate], { date: '2026-10-31' }).weekday).toBe(500); // Saturday
    expect(
      run([defaultSeason({ rt: amounts({ sunday: 70 }) })], { date: '2026-11-01' }).weekday,
    ).toBe(70);
  });

  it('charges guests by adult count', () => {
    const total = (adults: number, children = 0) =>
      run([rate], { guests: { adults, children } }).total;
    expect(total(1)).toBe(1250);
    expect(total(2)).toBe(1250 + 300);
    expect(total(3)).toBe(1250 + 300 + 200);
    expect(total(4)).toBe(1250 + 300 + 200 + 100);
    expect(total(5)).toBe(1250 + 300 + 200 + 200);
    expect(total(2, 2)).toBe(1250 + 300 + 100);
    expect(total(1, 3)).toBe(1250 + 150);
  });

  it('reports the breakdown', () => {
    expect(run([rate], { guests: { adults: 5, children: 1 } })).toEqual({
      date: MON,
      seasonId: 'default',
      baseKind: 'standardBase',
      base: 1000,
      weekday: 250,
      guest2: 300,
      guest3: 200,
      guest4Plus: 200,
      child: 50,
      total: 2000,
    });
  });

  it('ignores negative or fractional guest counts', () => {
    expect(run([rate], { guests: { adults: -2, children: -1 } }).total).toBe(1250);
    expect(run([rate], { guests: { adults: 2.9, children: 0 } }).guest3).toBe(0);
  });

  describe('alternative base rates replace the standard base', () => {
    const alt: AlternativeBaseRates = {
      alternativeBaseRate1: { enabled: true, minNights: 7 },
      alternativeBaseRate2: { enabled: true, minNights: 30 },
    };
    it('uses alt 1 from its night count and alt 2 from its own', () => {
      expect(run([rate], { alternativeBaseRates: alt, stayNights: 6 }).base).toBe(1000);
      const seven = run([rate], { alternativeBaseRates: alt, stayNights: 7 });
      expect(seven).toMatchObject({ base: 800, baseKind: 'altBase1', total: 800 + 250 });
      expect(run([rate], { alternativeBaseRates: alt, stayNights: 29 }).baseKind).toBe('altBase1');
      expect(run([rate], { alternativeBaseRates: alt, stayNights: 30 })).toMatchObject({
        base: 600,
        baseKind: 'altBase2',
      });
    });
    it('ignores a disabled alternative and a missing setting', () => {
      const only2 = { ...alt, alternativeBaseRate1: { enabled: false, minNights: 7 } };
      expect(baseKindFor(10, only2)).toBe('standardBase');
      expect(baseKindFor(30, only2)).toBe('altBase2');
      expect(baseKindFor(99, null)).toBe('standardBase');
    });
    it('prefers alt 2 when both apply, even if its count is lower', () => {
      const odd: AlternativeBaseRates = {
        alternativeBaseRate1: { enabled: true, minNights: 10 },
        alternativeBaseRate2: { enabled: true, minNights: 5 },
      };
      expect(baseKindFor(10, odd)).toBe('altBase2');
    });
  });

  describe('seasons', () => {
    const summer = season({
      id: 'summer',
      startDate: '2026-10-26',
      endDate: '2026-10-28',
      rates: { rt: amounts({ standardBase: 2000 }) },
    });
    it('uses a dated season, with inclusive start and end', () => {
      const seasons = [rate, summer];
      expect(run(seasons, { date: '2026-10-25' }).seasonId).toBe('default');
      expect(run(seasons, { date: '2026-10-26' })).toMatchObject({
        seasonId: 'summer',
        base: 2000,
      });
      expect(run(seasons, { date: '2026-10-28' }).seasonId).toBe('summer');
      expect(run(seasons, { date: '2026-10-29' }).seasonId).toBe('default');
    });
    it('falls back to the default season row (not per field) when the season has no row', () => {
      const other = season({
        id: 'other',
        startDate: MON,
        endDate: MON,
        rates: { rt2: amounts({ standardBase: 9 }) },
      });
      expect(run([rate, other]).total).toBe(1250);
      // A row that exists keeps its zeros: no field-by-field fallback.
      const sparse = season({ id: 's', startDate: MON, endDate: MON, rates: { rt: amounts({}) } });
      expect(run([rate, sparse]).total).toBe(0);
    });
    it('costs 0 without a default season, a matching row or a valid date', () => {
      expect(run([summer], { date: '2026-12-01' }).total).toBe(0);
      expect(run([rate], { roomTypeId: 'nope' }).total).toBe(0);
      expect(run([rate], { date: 'bad' })).toMatchObject({ total: 0, seasonId: null });
    });
  });
});

describe('stayRate', () => {
  const seasons = [
    defaultSeason({ rt: amounts({ standardBase: 1000, monday: 250, altBase1: 800 }) }),
    season({
      id: 'peak',
      startDate: '2026-10-27',
      endDate: '2026-10-27',
      rates: { rt: amounts({ standardBase: 3000, altBase1: 2500 }) },
    }),
  ];
  const base = {
    seasons,
    roomTypeId: 'rt',
    guests: { adults: 1, children: 0 },
    alternativeBaseRates: none,
  };

  it('sums each night in its own season; the departure day is not charged', () => {
    const stay = stayRate({ ...base, arrival: MON, departure: '2026-10-28' });
    expect(stay.nights.map((n) => [n.date, n.seasonId, n.total])).toEqual([
      ['2026-10-26', 'default', 1250],
      ['2026-10-27', 'peak', 3000],
    ]);
    expect(stay.total).toBe(4250);
  });

  it('applies the alternative base from the length of the whole stay', () => {
    const alt: AlternativeBaseRates = {
      ...none,
      alternativeBaseRate1: { enabled: true, minNights: 2 },
    };
    const stay = stayRate({
      ...base,
      alternativeBaseRates: alt,
      arrival: MON,
      departure: '2026-10-28',
    });
    expect(stay.nights.map((n) => n.base)).toEqual([800, 2500]);
  });

  it('is empty for no nights or invalid dates', () => {
    expect(stayRate({ ...base, arrival: MON, departure: MON })).toEqual({ nights: [], total: 0 });
    expect(stayRate({ ...base, arrival: 'x', departure: MON }).total).toBe(0);
  });
});
