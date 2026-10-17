import {
  addDays,
  addMonths,
  addMonthsToDate,
  changePeriodKind,
  createValue,
  dateSelectionState,
  comparisonRange,
  daysBetween,
  isValidValue,
  periodRange,
  defaultComparison,
  monthLabel,
  monthOptions,
  monthRange,
  parseIsoDate,
  PERIOD_KINDS,
  setCompare,
  setRangePreset,
  todayIso,
  updateComparison,
  updatePeriod,
  validateValue,
  weekRange,
  type DateSelectionState,
  type DateSelectionValue,
} from './dateSelection';

const TODAY = '2025-02-12'; // a Wednesday

describe('date helpers', () => {
  it('parses only real calendar dates', () => {
    expect(parseIsoDate('2025-02-28')).not.toBeNull();
    expect(parseIsoDate('2025-02-30')).toBeNull();
    expect(parseIsoDate('2025-2-3')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2025-02-01', '2025-02-08')).toBe(7);
    expect(daysBetween('2025-02-08', '2025-02-01')).toBe(-7);
    expect(daysBetween('x', '2025-02-01')).toBeNaN();
  });

  it('reads the local calendar date, not UTC', () => {
    expect(todayIso(new Date(2025, 0, 31, 23, 59))).toBe('2025-01-31');
  });

  it('finds the week containing a date for either week start', () => {
    expect(weekRange(TODAY)).toEqual({ from: '2025-02-09', to: '2025-02-15' });
    expect(weekRange(TODAY, 1)).toEqual({ from: '2025-02-10', to: '2025-02-16' });
    expect(weekRange('2025-02-09')).toEqual({ from: '2025-02-09', to: '2025-02-15' });
    expect(weekRange('2025-02-09', 1)).toEqual({ from: '2025-02-03', to: '2025-02-09' });
  });

  it('computes month ranges, including leap February', () => {
    expect(monthRange('2025-02')).toEqual({ from: '2025-02-01', to: '2025-02-28' });
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthRange('2025-12').to).toBe('2025-12-31');
  });

  it('shifts months across years and labels them', () => {
    expect(addMonths('2025-01', -1)).toBe('2024-12');
    expect(addMonths('2025-02', -12)).toBe('2024-02');
    expect(addMonths('2025-11', 3)).toBe('2026-02');
    expect(monthLabel('2025-02')).toBe('February 2025');
  });

  it('clamps the day when shifting a date by months', () => {
    expect(addMonthsToDate('2024-02-29', -12)).toBe('2023-02-28');
    expect(addMonthsToDate('2025-03-31', -1)).toBe('2025-02-28');
  });

  it('lists month options newest first and keeps an out-of-range selection', () => {
    const options = monthOptions('2025-02', '2025-02', 3);
    expect(options).toEqual(['2025-02', '2025-01', '2024-12']);
    expect(monthOptions('2025-02', '2019-05', 2)).toEqual(['2019-05', '2025-02', '2025-01']);
  });
});

describe('default values and comparison', () => {
  it('creates a value for every period kind with comparison off', () => {
    expect(createValue('custom', TODAY).period).toEqual({
      kind: 'custom',
      from: TODAY,
      to: TODAY,
    });
    expect(createValue('thisWeek', TODAY).period).toEqual({
      kind: 'thisWeek',
      from: '2025-02-09',
      to: '2025-02-15',
    });
    expect(createValue('month', TODAY).period).toEqual({ kind: 'month', month: '2025-02' });
    expect(createValue('asOf', TODAY).comparison).toBeNull();
  });

  it('compares a week to last week, same length shifted 7 days', () => {
    const v = setCompare(createValue('thisWeek', TODAY), true);
    expect(v.comparison).toEqual({
      kind: 'range',
      preset: 'lastWeek',
      from: '2025-02-02',
      to: '2025-02-08',
    });
  });

  it('compares a custom range to the previous period of equal length', () => {
    const v: DateSelectionValue = {
      period: { kind: 'custom', from: '2025-02-10', to: '2025-02-14' },
      comparison: null,
    };
    expect(setCompare(v, true).comparison).toMatchObject({
      preset: 'previousPeriod',
      from: '2025-02-05',
      to: '2025-02-09',
    });
  });

  it('compares a month to the same month a year earlier', () => {
    expect(defaultComparison({ kind: 'month', month: '2025-02' })).toEqual({
      kind: 'month',
      month: '2024-02',
      derived: true,
    });
  });

  it('compares as-of and single-day to a single date', () => {
    expect(defaultComparison({ kind: 'asOf', date: '2025-02-12' })).toEqual({
      kind: 'date',
      date: '2024-02-12',
      derived: true,
    });
    expect(defaultComparison({ kind: 'singleDay', date: '2025-02-12' })).toEqual({
      kind: 'date',
      date: '2025-02-11',
      derived: true,
    });
  });

  it('turning compare off drops the comparison; turning it on twice keeps edits', () => {
    const on = setCompare(createValue('month', TODAY), true);
    expect(setCompare(on, false).comparison).toBeNull();
    const edited = updateComparison(on, { kind: 'month', month: '2023-06', derived: true });
    expect(setCompare(edited, true)).toBe(edited);
  });

  it('switching the period kind rebuilds an active comparison to match', () => {
    const on = setCompare(createValue('thisWeek', TODAY), true);
    const toMonth = changePeriodKind(on, 'month', TODAY);
    expect(toMonth.period.kind).toBe('month');
    expect(toMonth.comparison?.kind).toBe('month');
    const off = changePeriodKind(createValue('thisWeek', TODAY), 'asOf', TODAY);
    expect(off.comparison).toBeNull();
  });

  it('keeps the value when the kind does not change', () => {
    const v = createValue('custom', TODAY);
    expect(changePeriodKind(v, 'custom', TODAY)).toBe(v);
  });

  it('preset comparisons follow the period; a custom one does not', () => {
    const on = setCompare(createValue('custom', TODAY), true);
    const moved = updatePeriod(on, { kind: 'custom', from: '2025-03-01', to: '2025-03-10' });
    expect(moved.comparison).toMatchObject({ from: '2025-02-19', to: '2025-02-28' });
    const custom = setRangePreset(on, 'custom');
    const moved2 = updatePeriod(custom, { kind: 'custom', from: '2025-03-01', to: '2025-03-10' });
    expect(moved2.comparison).toEqual(custom.comparison);
  });

  it('choosing a preset recomputes its dates', () => {
    const custom = setRangePreset(setCompare(createValue('thisWeek', TODAY), true), 'custom');
    const back = setRangePreset(custom, 'lastWeek');
    expect(back.comparison).toMatchObject({ preset: 'lastWeek', from: '2025-02-02' });
  });
});

describe('dateSelectionState', () => {
  it('covers all eight Figma states', () => {
    const states = new Set<DateSelectionState>();
    for (const kind of PERIOD_KINDS) {
      const base = createValue(kind, TODAY);
      states.add(dateSelectionState(base));
      states.add(dateSelectionState(setCompare(base, true)));
    }
    expect([...states].sort()).toEqual(
      [
        'As Of',
        'Compare',
        'Compare-AsOf',
        'Compare-Month',
        'Custom',
        'Month',
        'Single Day',
        'This Week',
      ].sort(),
    );
  });

  it('names each state', () => {
    expect(dateSelectionState(createValue('custom', TODAY))).toBe('Custom');
    expect(dateSelectionState(setCompare(createValue('thisWeek', TODAY), true))).toBe('Compare');
    expect(dateSelectionState(setCompare(createValue('month', TODAY), true))).toBe('Compare-Month');
    expect(dateSelectionState(setCompare(createValue('asOf', TODAY), true))).toBe('Compare-AsOf');
  });
});

describe('validateValue', () => {
  it('accepts every default value, compared or not', () => {
    for (const kind of PERIOD_KINDS) {
      const v = createValue(kind, TODAY);
      expect(validateValue(v)).toEqual({});
      expect(validateValue(setCompare(v, true))).toEqual({});
    }
  });

  it('rejects an inverted or incomplete range', () => {
    const inverted = updatePeriod(createValue('custom', TODAY), {
      kind: 'custom',
      from: '2025-02-20',
      to: '2025-02-10',
    });
    expect(validateValue(inverted).period).toBe('From must be on or before To.');
    const empty = updatePeriod(createValue('custom', TODAY), {
      kind: 'custom',
      from: '',
      to: TODAY,
    });
    expect(validateValue(empty).period).toBe('Enter a valid date.');
  });

  it('reports a period mistake once, at the period only', () => {
    const v = setCompare(createValue('custom', TODAY), true);
    const bad = updatePeriod(v, { kind: 'custom', from: '2025-03-01', to: '2025-02-01' });
    expect(validateValue(bad)).toEqual({ period: 'From must be on or before To.' });
    expect(isValidValue(bad)).toBe(false);
    expect(isValidValue(v)).toBe(true);
  });

  it('rejects an invalid single date and comparison date', () => {
    const v = setCompare(createValue('asOf', TODAY), true);
    const bad = updateComparison(v, { kind: 'date', date: '', derived: false });
    expect(validateValue(bad).comparison).toBe('Enter a valid date.');
  });
});

describe('derived comparisons follow the period', () => {
  const on = (kind: Parameters<typeof createValue>[0], today = TODAY) =>
    setCompare(createValue(kind, today), true);

  it('single day follows (previous day), including a month boundary', () => {
    const next = updatePeriod(on('singleDay'), { kind: 'singleDay', date: '2025-03-01' });
    expect(next.comparison).toEqual({ kind: 'date', date: '2025-02-28', derived: true });
  });

  it('as of follows (same date a year earlier), clamping Feb 29', () => {
    const next = updatePeriod(on('asOf'), { kind: 'asOf', date: '2024-02-29' });
    expect(next.comparison).toEqual({ kind: 'date', date: '2023-02-28', derived: true });
  });

  it('month follows (same month a year earlier)', () => {
    const next = updatePeriod(on('month'), { kind: 'month', month: '2024-03' });
    expect(next.comparison).toEqual({ kind: 'month', month: '2023-03', derived: true });
  });

  it('range presets follow; month-end lengths are preserved', () => {
    const next = updatePeriod(on('custom'), {
      kind: 'custom',
      from: '2025-03-01',
      to: '2025-03-31',
    });
    expect(next.comparison).toMatchObject({ from: '2025-01-29', to: '2025-02-28' });
  });

  it('an edited comparison stays independent for every kind', () => {
    for (const [kind, edited, period] of [
      [
        'singleDay',
        { kind: 'date', date: '2020-01-01', derived: false },
        { kind: 'singleDay', date: '2025-03-01' },
      ],
      [
        'asOf',
        { kind: 'date', date: '2020-01-01', derived: false },
        { kind: 'asOf', date: '2025-03-01' },
      ],
      [
        'month',
        { kind: 'month', month: '2020-01', derived: false },
        { kind: 'month', month: '2025-03' },
      ],
    ] as const) {
      const v = updateComparison(on(kind), edited);
      expect(updatePeriod(v, period).comparison).toEqual(edited);
    }
  });

  it('editing a range comparison forces the custom preset', () => {
    const v = on('thisWeek');
    const edited = updateComparison(v, {
      kind: 'range',
      preset: 'lastWeek',
      from: '2025-01-01',
      to: '2025-01-07',
    });
    expect(edited.comparison).toMatchObject({ preset: 'custom', from: '2025-01-01' });
    const moved = updatePeriod(edited, { kind: 'thisWeek', from: '2025-03-02', to: '2025-03-08' });
    expect(moved.comparison).toEqual(edited.comparison);
  });

  it('a comparison without `derived` (fixture or saved value) counts as derived', () => {
    const v = { ...on('month'), comparison: { kind: 'month', month: '2020-01' } } as const;
    const next = updatePeriod(v, { kind: 'month', month: '2025-05' });
    expect(next.comparison).toEqual({ kind: 'month', month: '2024-05', derived: true });
  });

  it('editing a month or date comparison marks it independent', () => {
    const v = updateComparison(on('month'), { kind: 'month', month: '2020-01', derived: true });
    expect(v.comparison).toMatchObject({ derived: false });
  });

  it('does not recompute while the period is invalid', () => {
    const v = on('custom');
    const bad = updatePeriod(v, { kind: 'custom', from: '', to: TODAY });
    expect(bad.comparison).toEqual(v.comparison);
    const inverted = updatePeriod(on('singleDay'), { kind: 'singleDay', date: '' });
    expect(inverted.comparison).toEqual(on('singleDay').comparison);
  });
});

describe('periodRange and comparisonRange', () => {
  it('give a concrete range for every kind', () => {
    expect(periodRange({ kind: 'custom', from: '2025-02-01', to: '2025-02-05' })).toEqual({
      from: '2025-02-01',
      to: '2025-02-05',
    });
    expect(periodRange({ kind: 'thisWeek', from: '2025-02-09', to: '2025-02-15' }).to).toBe(
      '2025-02-15',
    );
    expect(periodRange({ kind: 'month', month: '2024-02' })).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
    expect(periodRange({ kind: 'singleDay', date: TODAY })).toEqual({ from: TODAY, to: TODAY });
    expect(periodRange({ kind: 'asOf', date: TODAY })).toEqual({ from: TODAY, to: TODAY });
    expect(comparisonRange({ kind: 'range', preset: 'custom', from: 'a', to: 'b' })).toEqual({
      from: 'a',
      to: 'b',
    });
    expect(comparisonRange({ kind: 'month', month: '2025-02', derived: true })).toEqual({
      from: '2025-02-01',
      to: '2025-02-28',
    });
    expect(comparisonRange({ kind: 'date', date: TODAY, derived: true })).toEqual({
      from: TODAY,
      to: TODAY,
    });
  });
});
