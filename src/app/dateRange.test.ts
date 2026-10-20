import {
  isRangeDayDisabled,
  nextRangeSelection,
  rangeBounds,
  rangeShade,
  stayLimits,
} from './dateRange';

const limits = stayLimits('2026-10-20', 730, 365);

describe('nextRangeSelection', () => {
  it('the first click sets the start', () => {
    expect(nextRangeSelection({ from: '', to: '' }, '2026-10-22', limits)).toEqual({
      from: '2026-10-22',
      to: '',
    });
  });
  it('the second click sets the end', () => {
    expect(nextRangeSelection({ from: '2026-10-22', to: '' }, '2026-10-25', limits)).toEqual({
      from: '2026-10-22',
      to: '2026-10-25',
    });
  });
  it('a second click before the start restarts with that date', () => {
    expect(nextRangeSelection({ from: '2026-10-22', to: '' }, '2026-10-21', limits)).toEqual({
      from: '2026-10-21',
      to: '',
    });
  });
  it('the same day restarts when a stay needs a night, and is a 0-night range otherwise', () => {
    expect(nextRangeSelection({ from: '2026-10-22', to: '' }, '2026-10-22', limits).to).toBe('');
    expect(
      nextRangeSelection({ from: '2026-10-22', to: '' }, '2026-10-22', { minNights: 0 }),
    ).toEqual({ from: '2026-10-22', to: '2026-10-22' });
  });
  it('a click on a complete range starts fresh', () => {
    expect(
      nextRangeSelection({ from: '2026-10-22', to: '2026-10-25' }, '2026-10-30', limits),
    ).toEqual({ from: '2026-10-30', to: '' });
  });
});

describe('isRangeDayDisabled', () => {
  it('disables the past and days beyond the advance window', () => {
    const none = { from: '', to: '' } as const;
    expect(isRangeDayDisabled('2026-10-19', none, limits)).toBe(true);
    expect(isRangeDayDisabled('2026-10-20', none, limits)).toBe(false);
    expect(isRangeDayDisabled('2028-10-19', none, limits)).toBe(false);
    expect(isRangeDayDisabled('2028-10-20', none, limits)).toBe(true);
  });
  it('limits the end to 1..365 nights after the start but allows restarting earlier', () => {
    const pending = { from: '2026-10-22', to: '' } as const;
    expect(isRangeDayDisabled('2026-10-23', pending, limits)).toBe(false);
    expect(isRangeDayDisabled('2026-10-21', pending, limits)).toBe(false);
    expect(isRangeDayDisabled('2026-10-19', pending, limits)).toBe(true);
    expect(isRangeDayDisabled('2027-10-22', pending, limits)).toBe(false);
    expect(isRangeDayDisabled('2027-10-23', pending, limits)).toBe(true);
  });
  it('bounds cover the last possible check-out', () => {
    expect(rangeBounds(limits).min).toBe('2026-10-20');
    expect(rangeBounds({ minNights: 0 })).toEqual({ min: undefined, max: undefined });
  });
});

describe('rangeShade', () => {
  it('marks ends and the days between, with a hover preview while pending', () => {
    const r = { from: '2026-10-22', to: '2026-10-25' };
    expect(rangeShade('2026-10-22', r, null)).toBe('start');
    expect(rangeShade('2026-10-25', r, null)).toBe('end');
    expect(rangeShade('2026-10-23', r, null)).toBe('between');
    expect(rangeShade('2026-10-26', r, null)).toBeNull();
    const p = { from: '2026-10-22', to: '' };
    expect(rangeShade('2026-10-23', p, '2026-10-25')).toBe('between');
    expect(rangeShade('2026-10-25', p, '2026-10-25')).toBe('end');
    expect(rangeShade('2026-10-23', p, '2026-10-21')).toBeNull();
  });
});
