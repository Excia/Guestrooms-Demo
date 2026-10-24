import {
  firstRepricedNight,
  needsRateChoice,
  rateChoiceToSend,
  rateOutcome,
  remainingNights,
  type NightRate,
} from './roomChangeRates';

const nights = (...amounts: number[]): NightRate[] =>
  amounts.map((amountCents, i) => ({
    date: `2026-10-${String(18 + i).padStart(2, '0')}`,
    amountCents,
  }));

describe('firstRepricedNight', () => {
  it('is the effective date, never a night before today', () => {
    expect(firstRepricedNight('2026-10-20', '2026-10-20')).toBe('2026-10-20');
    expect(firstRepricedNight('2026-10-22', '2026-10-20')).toBe('2026-10-22');
    expect(firstRepricedNight('2026-10-18', '2026-10-20')).toBe('2026-10-20');
  });
});

describe('remainingNights', () => {
  it('lists the nights from today (tonight included) up to the departure night', () => {
    expect(remainingNights('2026-10-18', '2026-10-22', '2026-10-20')).toEqual([
      '2026-10-20',
      '2026-10-21',
    ]);
  });
  it('arrival today: every night remains', () => {
    expect(remainingNights('2026-10-20', '2026-10-22', '2026-10-20')).toEqual([
      '2026-10-20',
      '2026-10-21',
    ]);
  });
  it('departure tomorrow: only tonight remains (the last night)', () => {
    expect(remainingNights('2026-10-18', '2026-10-21', '2026-10-20')).toEqual(['2026-10-20']);
  });
  it('departure today: nothing remains', () => {
    expect(remainingNights('2026-10-18', '2026-10-20', '2026-10-20')).toEqual([]);
  });
});

describe('rateOutcome', () => {
  // Nights 10/18 and 10/19 are stayed (today is 10/20), 10/20 and 10/21 are not.
  const base = {
    nights: nights(20000, 20000, 20000, 20000),
    effectiveDate: '2026-10-20',
    today: '2026-10-20',
  };

  it('update: nights already stayed keep their price, the rest take the new rate', () => {
    const out = rateOutcome({ ...base, newRateCents: 25000, choice: 'update' });
    expect(out.nights.map((n) => n.amountCents)).toEqual([20000, 20000, 25000, 25000]);
    expect(out.deltaCents).toBe(10000);
    expect(out.repricedNights).toBe(2);
    expect(out.ratesDiffer).toBe(true);
  });

  it('retain: nothing changes, but the rates are reported as different', () => {
    const out = rateOutcome({ ...base, newRateCents: 25000, choice: 'retain' });
    expect(out.nights.map((n) => n.amountCents)).toEqual([20000, 20000, 20000, 20000]);
    expect(out.deltaCents).toBe(0);
    expect(out.repricedNights).toBe(0);
    expect(out.ratesDiffer).toBe(true);
  });

  it('no choice (setting off) behaves like update', () => {
    const out = rateOutcome({ ...base, newRateCents: 15000, choice: null });
    expect(out.nights.map((n) => n.amountCents)).toEqual([20000, 20000, 15000, 15000]);
    expect(out.deltaCents).toBe(-10000);
  });

  it('same rates: no question applies and nothing is repriced', () => {
    const out = rateOutcome({ ...base, newRateCents: 20000, choice: 'update' });
    expect(out.ratesDiffer).toBe(false);
    expect(out.deltaCents).toBe(0);
    expect(out.repricedNights).toBe(0);
  });

  it('never reprices a night before today, even when the effective date is earlier', () => {
    const out = rateOutcome({
      ...base,
      effectiveDate: '2026-10-18',
      newRateCents: 25000,
      choice: 'update',
    });
    expect(out.nights.map((n) => n.amountCents)).toEqual([20000, 20000, 25000, 25000]);
  });

  it('a later effective date keeps the nights in between at their price', () => {
    const out = rateOutcome({
      ...base,
      effectiveDate: '2026-10-21',
      newRateCents: 25000,
      choice: 'update',
    });
    expect(out.nights.map((n) => n.amountCents)).toEqual([20000, 20000, 20000, 25000]);
    expect(out.repricedNights).toBe(1);
  });

  it('arrival today: every night is repriced', () => {
    const out = rateOutcome({
      nights: [
        { date: '2026-10-20', amountCents: 20000 },
        { date: '2026-10-21', amountCents: 20000 },
      ],
      effectiveDate: '2026-10-20',
      today: '2026-10-20',
      newRateCents: 30000,
      choice: 'update',
    });
    expect(out.deltaCents).toBe(20000);
    expect(out.repricedNights).toBe(2);
  });

  it('last night only', () => {
    const out = rateOutcome({
      nights: nights(20000, 20000, 20000),
      effectiveDate: '2026-10-20',
      today: '2026-10-20',
      newRateCents: 10000,
      choice: 'update',
    });
    expect(out.nights.map((n) => n.amountCents)).toEqual([20000, 20000, 10000]);
    expect(out.deltaCents).toBe(-10000);
  });

  it('prices per night from a function, and only counts nights whose price differs', () => {
    const out = rateOutcome({
      ...base,
      newRateCents: (date) => (date === '2026-10-21' ? 22000 : 20000),
      choice: 'update',
    });
    expect(out.repricedNights).toBe(1);
    expect(out.deltaCents).toBe(2000);
  });

  it('per night: only nights whose room changed are repriced', () => {
    const changed = new Set(['2026-10-21']);
    const out = rateOutcome({
      ...base,
      newRateCents: 25000,
      choice: 'update',
      changed: (d) => changed.has(d),
    });
    expect(out.nights.map((n) => n.amountCents)).toEqual([20000, 20000, 20000, 25000]);
    expect(out.repricedNights).toBe(1);
    expect(out.deltaCents).toBe(5000);
  });

  it('per night: a changed night with the same price needs no question', () => {
    const out = rateOutcome({
      ...base,
      newRateCents: 20000,
      choice: null,
      changed: (d) => d === '2026-10-21',
    });
    expect(out.ratesDiffer).toBe(false);
  });

  it('per night: a changed night that is already stayed is never repriced', () => {
    const out = rateOutcome({
      ...base,
      newRateCents: 25000,
      choice: 'update',
      changed: () => true,
    });
    expect(out.nights.slice(0, 2).map((n) => n.amountCents)).toEqual([20000, 20000]);
  });

  it('does not touch its input', () => {
    const input = nights(20000, 20000);
    rateOutcome({
      nights: input,
      effectiveDate: '2026-10-18',
      today: '2026-10-18',
      newRateCents: 1,
      choice: 'update',
    });
    expect(input.map((n) => n.amountCents)).toEqual([20000, 20000]);
  });
});

describe('the rate question', () => {
  it('is asked only when the setting is on and the rates differ', () => {
    expect(needsRateChoice(true, true)).toBe(true);
    expect(needsRateChoice(true, false)).toBe(false);
    expect(needsRateChoice(false, true)).toBe(false);
    expect(needsRateChoice(false, false)).toBe(false);
  });
  it('sends the answer only when it was asked', () => {
    expect(rateChoiceToSend(true, 'retain')).toBe('retain');
    expect(rateChoiceToSend(true, null)).toBeNull();
    expect(rateChoiceToSend(false, 'retain')).toBeNull();
  });
});
