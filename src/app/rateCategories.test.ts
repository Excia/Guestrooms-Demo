import type { RateCategoryInput, RateSeason } from '../api/types';
import {
  addSeason,
  amountsFor,
  blankDefaultSeason,
  blankRateCategory,
  checkDeleteRateCategory,
  copyName,
  duplicateNameError,
  duplicateSeason,
  formatDollars,
  hasErrors,
  isNameTaken,
  normalizeRateCategory,
  overlappingSeasonIds,
  parseDollars,
  removeSeason,
  seasonFor,
  setAmount,
  validateRateCategory,
  visibleRateColumns,
} from './rateCategories';

const sku = { id: 'sku-a', label: 'A' };
const season = (id: string, name: string, startDate: string, endDate: string): RateSeason => ({
  id,
  name,
  isDefault: false,
  startDate,
  endDate,
  rates: {},
});
const valid = (patch: Partial<RateCategoryInput> = {}): RateCategoryInput => ({
  ...blankRateCategory('2026-10-20', ['rt-a', 'rt-b']),
  name: 'Member Rate',
  sku,
  ...patch,
});

describe('money text', () => {
  it('parses dollars to cents', () => {
    expect(parseDollars('125')).toBe(12500);
    expect(parseDollars('125.5')).toBe(12550);
    expect(parseDollars('$1,250.05')).toBe(125005);
    expect(parseDollars('.5')).toBe(50);
    expect(parseDollars('')).toBeNull();
    expect(parseDollars('-1')).toBeNull();
    expect(parseDollars('1.234')).toBeNull();
    expect(parseDollars('abc')).toBeNull();
  });
  it('formats cents', () => {
    expect(formatDollars(0)).toBe('0.00');
    expect(formatDollars(125005)).toBe('1,250.05');
  });
});

describe('visibleRateColumns', () => {
  it('hides the alternative base rates unless enabled, and names their nights', () => {
    expect(visibleRateColumns(null).map((c) => c.key)).not.toContain('altBase1');
    const columns = visibleRateColumns({
      alternativeBaseRate1: { enabled: true, minNights: 7 },
      alternativeBaseRate2: { enabled: false, minNights: 14 },
    });
    expect(columns.map((c) => c.label)).toContain('Alt Base (7+ nights)');
    expect(columns.map((c) => c.key)).not.toContain('altBase2');
    expect(columns[0].key).toBe('standardBase');
  });
});

describe('names', () => {
  const list = [{ id: '1', name: 'Member Rate' }];
  it('treats names as unique ignoring case and spaces', () => {
    expect(isNameTaken(' member rate ', list)).toBe(true);
    expect(isNameTaken('Member Rate', list, '1')).toBe(false);
    expect(isNameTaken('', list)).toBe(false);
  });
  it('suggests "Name (Copy)" within the limit', () => {
    expect(copyName('Member Rate')).toBe('Member Rate (Copy)');
    expect(copyName('A very long rate category name')).toHaveLength(25);
    expect(copyName('A very long rate category name').endsWith(' (Copy)')).toBe(true);
  });
  it('explains why a duplicate name cannot be used', () => {
    expect(duplicateNameError('', list)).toMatch(/Enter a name/);
    expect(duplicateNameError('Member Rate', list)).toMatch(/already in use/);
    expect(duplicateNameError('x'.repeat(26), list)).toMatch(/at most 25/);
    expect(duplicateNameError('Member Rate (Copy)', list)).toBeUndefined();
  });
});

describe('season overlap', () => {
  it('counts a shared day as overlapping (inclusive ranges)', () => {
    const found = overlappingSeasonIds([
      season('a', 'Summer', '2026-06-01', '2026-08-31'),
      season('b', 'Late', '2026-08-31', '2026-09-30'),
      season('c', 'Fall', '2026-10-01', '2026-10-31'),
    ]);
    expect([...found.keys()]).toEqual(['b']);
    expect(found.get('b')).toBe('Summer');
  });
  it('ignores the default season and incomplete ranges', () => {
    const found = overlappingSeasonIds([
      { ...blankDefaultSeason(['rt-a']) },
      season('a', 'A', '2026-06-01', ''),
      season('b', 'B', '2026-06-01', '2026-06-30'),
    ]);
    expect(found.size).toBe(0);
  });
});

describe('validateRateCategory', () => {
  it('accepts a complete category', () => {
    expect(hasErrors(validateRateCategory(valid()))).toBe(false);
  });
  it('needs a name, a SKU and a room type', () => {
    const e = validateRateCategory(valid({ name: ' ', sku: null, roomTypeIds: [] }));
    expect(e.name).toBeDefined();
    expect(e.sku).toBeDefined();
    expect(e.roomTypes).toBeDefined();
  });
  it('limits the name to 25 and requires it to be unique', () => {
    expect(validateRateCategory(valid({ name: 'x'.repeat(26) })).name).toMatch(/at most 25/);
    const taken = validateRateCategory(valid({ id: 'new' }), [
      { id: 'other', name: 'member rate' },
    ]);
    expect(taken.name).toMatch(/already in use/);
    expect(
      validateRateCategory(valid({ id: 'other' }), [{ id: 'other', name: 'Member Rate' }]).name,
    ).toBeUndefined();
  });
  it('checks the active dates', () => {
    expect(validateRateCategory(valid({ startDate: '' })).startDate).toBeDefined();
    expect(validateRateCategory(valid({ endDate: '' })).endDate).toBeDefined();
    expect(validateRateCategory(valid({ endDate: '2026-10-20' })).endDate).toMatch(/after/);
    expect(hasErrors(validateRateCategory(valid({ endDate: '2026-10-21' })))).toBe(false);
  });
  it('requires every non-default season to have a name and dates', () => {
    const input = valid();
    input.seasons = addSeason(input.seasons, 's1');
    const e = validateRateCategory(input).seasons.s1;
    expect(e).toMatchObject({
      name: expect.any(String),
      startDate: expect.any(String),
      endDate: expect.any(String),
    });
  });
  it('rejects an end date before the start and overlapping seasons', () => {
    const input = valid();
    input.seasons = [
      ...input.seasons,
      season('s1', 'Summer', '2026-06-01', '2026-08-31'),
      season('s2', 'Back', '2026-09-01', '2026-08-01'),
      season('s3', 'Mid', '2026-08-15', '2026-09-15'),
    ];
    const e = validateRateCategory(input).seasons;
    expect(e.s1).toBeUndefined();
    expect(e.s2?.endDate).toMatch(/before the start/);
    expect(e.s3?.endDate).toMatch(/overlap Summer/);
  });
  it('rejects an amount that is not money', () => {
    const input = valid();
    input.seasons = setAmount(input.seasons, input.seasons[0].id, 'rt-a', 'monday', -5);
    expect(validateRateCategory(input).seasons[input.seasons[0].id]?.amount).toMatch(/Mon/);
  });
});

describe('seasons', () => {
  it('Add Season starts from the default rates, with no name or dates', () => {
    let seasons = [blankDefaultSeason(['rt-a'])];
    seasons = setAmount(seasons, seasons[0].id, 'rt-a', 'standardBase', 15000);
    const added = addSeason(seasons, 's1');
    expect(added[1]).toMatchObject({
      id: 's1',
      name: '',
      isDefault: false,
      startDate: '',
      endDate: '',
    });
    expect(added[1].rates['rt-a'].standardBase).toBe(15000);
    // The copy is independent of the default.
    const changed = setAmount(added, 's1', 'rt-a', 'standardBase', 1);
    expect(changed[0].rates['rt-a'].standardBase).toBe(15000);
  });
  it('duplicates a season with its dates and rates, but never the default', () => {
    const base = [blankDefaultSeason(['rt-a']), season('s1', 'Summer', '2026-06-01', '2026-08-31')];
    const copied = duplicateSeason(base, 's1', 's2');
    expect(copied[2]).toMatchObject({ id: 's2', name: 'Summer (Copy)', startDate: '2026-06-01' });
    expect(duplicateSeason(base, base[0].id, 'x')).toHaveLength(2);
  });
  it('removes a season but never the default', () => {
    const base = [blankDefaultSeason(['rt-a']), season('s1', 'Summer', '2026-06-01', '2026-08-31')];
    expect(removeSeason(base, 's1')).toHaveLength(1);
    expect(removeSeason(base, base[0].id)).toHaveLength(2);
  });
  it('picks the dated season that contains a night, else the default', () => {
    const base = [blankDefaultSeason(['rt-a']), season('s1', 'Summer', '2026-06-01', '2026-08-31')];
    expect(seasonFor(base, '2026-08-31')?.id).toBe('s1');
    expect(seasonFor(base, '2026-09-01')?.isDefault).toBe(true);
  });
  it('reads a missing room type row as zero', () => {
    expect(amountsFor(season('s', 'S', '', ''), 'rt-x').standardBase).toBe(0);
  });
});

describe('normalizeRateCategory', () => {
  it('keeps exactly the associated room types and one default season first', () => {
    const input = valid({ name: '  Member Rate ', roomTypeIds: ['rt-a', 'rt-a', 'rt-c'] });
    input.seasons = [
      season('s1', ' Summer ', '2026-06-01', '2026-08-31'),
      { ...blankDefaultSeason(['rt-a', 'rt-b']), name: 'ignored', startDate: '2026-01-01' },
    ];
    const n = normalizeRateCategory({ ...input, requestId: 'r' });
    expect(n.name).toBe('Member Rate');
    expect(n.roomTypeIds).toEqual(['rt-a', 'rt-c']);
    expect(n.seasons.map((s) => s.isDefault)).toEqual([true, false]);
    expect(n.seasons[0]).toMatchObject({ name: '', startDate: '', endDate: '' });
    expect(Object.keys(n.seasons[1].rates)).toEqual(['rt-a', 'rt-c']);
    expect(n.seasons[1].name).toBe('Summer');
    expect('requestId' in n).toBe(false);
  });
  it('adds a default season when the input has none', () => {
    const n = normalizeRateCategory({ ...valid(), seasons: [] });
    expect(n.seasons).toHaveLength(1);
    expect(n.seasons[0].isDefault).toBe(true);
  });
});

describe('checkDeleteRateCategory', () => {
  it('blocks a category that reservations or settings use', () => {
    const byReservations = checkDeleteRateCategory({
      name: 'A',
      reservationCount: 2,
      settingNames: [],
    });
    expect(byReservations.kind).toBe('blocked');
    expect(byReservations.message).toMatch(/2 reservations use it/);
    const bySetting = checkDeleteRateCategory({
      name: 'A',
      reservationCount: 1,
      settingNames: ['Members default rate category'],
    });
    expect(bySetting.message).toMatch(/1 reservation uses it and it is the Members default/);
  });
  it('asks for confirmation when nothing uses it', () => {
    expect(checkDeleteRateCategory({ name: 'A', reservationCount: 0, settingNames: [] }).kind).toBe(
      'ok',
    );
  });
});
