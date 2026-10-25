import {
  activeFilterColumns,
  ariaSortFor,
  changeLogTitle,
  changeTypeLabel,
  isRealIsoDate,
  formatLogDate,
  formatLogTime,
  isWithinRetention,
  rangeProblem,
  retentionCutoff,
  toggleSort,
} from './changeLog';

describe('formats', () => {
  it('formats the date as "Day, MM/DD/YY"', () => {
    expect(formatLogDate('2026-10-21')).toBe('Wed, 10/21/26');
    expect(formatLogDate('2027-01-03')).toBe('Sun, 01/03/27');
  });
  it('formats the time as "HH:MM XM"', () => {
    expect(formatLogTime('16:05')).toBe('04:05 PM');
    expect(formatLogTime('00:30')).toBe('12:30 AM');
    expect(formatLogTime('12:00')).toBe('12:00 PM');
    expect(formatLogTime('09:07')).toBe('09:07 AM');
  });
  it('returns invalid input unchanged', () => {
    expect(formatLogDate('2026-02-30')).toBe('2026-02-30');
    expect(formatLogDate('soon')).toBe('soon');
    expect(formatLogTime('25:00')).toBe('25:00');
    expect(formatLogTime('4pm')).toBe('4pm');
  });
});

describe('retention', () => {
  it('keeps one year', () => {
    expect(retentionCutoff('2026-10-16')).toBe('2025-10-16');
    expect(isWithinRetention('2025-10-16', '2026-10-16')).toBe(true);
    expect(isWithinRetention('2025-10-15', '2026-10-16')).toBe(false);
  });
  it('maps 29 February to 28 February', () => {
    expect(retentionCutoff('2028-02-29')).toBe('2027-02-28');
  });
});

describe('sorting', () => {
  it('flips the direction of the sorted column', () => {
    expect(toggleSort({ field: 'date', direction: 'desc' }, 'date')).toEqual({
      field: 'date',
      direction: 'asc',
    });
  });
  it('starts a new column newest first for date and time, ascending otherwise', () => {
    const cur = { field: 'date', direction: 'desc' } as const;
    expect(toggleSort(cur, 'time')).toEqual({ field: 'time', direction: 'desc' });
    expect(toggleSort(cur, 'actionBy')).toEqual({ field: 'actionBy', direction: 'asc' });
  });
  it('reports aria-sort', () => {
    const s = { field: 'time', direction: 'asc' } as const;
    expect(ariaSortFor(s, 'time')).toBe('ascending');
    expect(ariaSortFor({ ...s, direction: 'desc' }, 'time')).toBe('descending');
    expect(ariaSortFor(s, 'date')).toBe('none');
  });
});

describe('filters', () => {
  it('names the columns with an active filter', () => {
    expect([...activeFilterColumns({})]).toEqual([]);
    const on = activeFilterColumns({
      dateFrom: '2026-01-01',
      timeTo: '12:00',
      changeTypes: ['created'],
      actionBy: ' Sam ',
      search: ' ',
    });
    expect([...on].sort()).toEqual(['actionBy', 'changeType', 'date', 'time']);
  });
  it('flags a back to front range', () => {
    expect(rangeProblem('2026-02-01', '2026-01-01', 'date')).toMatch(/must not be before/);
    expect(rangeProblem('2026-01-01', '2026-01-01', 'date')).toBeNull();
    expect(rangeProblem(undefined, '10:00', 'time')).toBeNull();
  });
});

it('titles the overlay after the page', () => {
  expect(changeLogTitle('system-settings')).toBe('System Settings: Change Log');
  expect(changeLogTitle('add-on-items')).toBe('Add-On Items: Change Log');
});

it('labels an event type, never showing the raw id', () => {
  const labels = new Map([['updated', 'Updated']]);
  expect(changeTypeLabel('updated', labels)).toBe('Updated');
  expect(changeTypeLabel('mystery', labels)).toBe('Unknown type');
  expect(changeTypeLabel('updated', null)).toBeNull();
});

it('accepts only real calendar dates', () => {
  expect(isRealIsoDate('2026-02-28')).toBe(true);
  expect(isRealIsoDate('2026-02-30')).toBe(false);
  expect(isRealIsoDate('2026-13-45')).toBe(false);
});
