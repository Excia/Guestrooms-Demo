import { mockAddOns } from '../api/addOnData';
import {
  ADD_ON_DESCRIPTION_MAX,
  blankAddOn,
  checkDeleteAddOn,
  clampNightlyQty,
  isSelectableOn,
  normalizeAddOn,
  NIGHTLY_QTY,
  pruneAssociations,
  validateAddOn,
} from './addOns';

const valid = () => ({
  ...blankAddOn('2026-10-20'),
  name: 'Crib',
  sku: { id: 'sku-crib', label: 'Crib' },
});

describe('blankAddOn', () => {
  it('starts as an untracked item, active from today, with no associations', () => {
    expect(blankAddOn('2026-10-20')).toMatchObject({
      kind: 'item',
      startDate: '2026-10-20',
      endDate: null,
      trackNightly: false,
      nightlyQty: 1,
      locationIds: [],
      roomTypeIds: [],
    });
  });
});

describe('validateAddOn', () => {
  it('accepts a complete add-on', () => {
    expect(validateAddOn(valid())).toEqual({});
  });

  it('requires a name of at most 50 characters', () => {
    expect(validateAddOn({ ...valid(), name: '  ' }).name).toBe('Enter an add-on name.');
    expect(validateAddOn({ ...valid(), name: 'x'.repeat(51) }).name).toBe(
      'Use at most 50 characters.',
    );
    expect(validateAddOn({ ...valid(), name: 'x'.repeat(50) }).name).toBeUndefined();
  });

  it('requires a SKU, because the reservation shows its price', () => {
    expect(validateAddOn({ ...valid(), sku: null }).sku).toBe('Select a SKU.');
  });

  it('requires an end date after the start date when one is configured', () => {
    expect(validateAddOn({ ...valid(), endDate: '2026-10-20' }).endDate).toMatch(/after the start/);
    expect(validateAddOn({ ...valid(), endDate: '2026-10-19' }).endDate).toMatch(/after the start/);
    expect(validateAddOn({ ...valid(), endDate: '' }).endDate).toBe('Enter an active end date.');
    expect(validateAddOn({ ...valid(), endDate: '2026-10-21' }).endDate).toBeUndefined();
    expect(validateAddOn({ ...valid(), startDate: '' }).startDate).toBe(
      'Enter an active start date.',
    );
  });

  it('accepts any whole nightly quantity of 0 or more, with no maximum, while tracking is on', () => {
    const msg = /whole number, 0 or more/;
    expect(validateAddOn({ ...valid(), trackNightly: true, nightlyQty: -1 }).nightlyQty).toMatch(
      msg,
    );
    expect(validateAddOn({ ...valid(), trackNightly: true, nightlyQty: 1.5 }).nightlyQty).toMatch(
      msg,
    );
    expect(
      validateAddOn({ ...valid(), trackNightly: true, nightlyQty: Number.NaN }).nightlyQty,
    ).toMatch(msg);
    for (const nightlyQty of [0, 1, 99, 100, 5000]) {
      expect(validateAddOn({ ...valid(), trackNightly: true, nightlyQty })).toEqual({});
    }
    expect(validateAddOn({ ...valid(), trackNightly: false, nightlyQty: -3 })).toEqual({});
  });

  it('limits the description to 400 characters', () => {
    expect(ADD_ON_DESCRIPTION_MAX).toBe(400);
    expect(validateAddOn({ ...valid(), description: 'x'.repeat(400) }).description).toBeUndefined();
    expect(validateAddOn({ ...valid(), description: 'x'.repeat(401) }).description).toBe(
      'Use at most 400 characters.',
    );
  });

  it('limits photos to 50 but does not require one', () => {
    const photo = (i: number) => ({ id: `p${i}`, name: `${i}.jpg`, url: '' });
    expect(validateAddOn(valid()).photos).toBeUndefined();
    expect(
      validateAddOn({ ...valid(), photos: Array.from({ length: 51 }, (_, i) => photo(i)) }).photos,
    ).toBe('Use at most 50 photos.');
  });
});

describe('clampNightlyQty', () => {
  it('keeps the stepper whole and at 0 or more, with no maximum', () => {
    expect(NIGHTLY_QTY.min).toBe(0);
    expect(clampNightlyQty(-4)).toBe(0);
    expect(clampNightlyQty(0)).toBe(0);
    expect(clampNightlyQty(150)).toBe(150);
    expect(clampNightlyQty(4.6)).toBe(5);
    expect(clampNightlyQty(Number.NaN)).toBe(0);
  });
});

describe('normalizeAddOn', () => {
  it('trims the name, resets the quantity when not tracking and drops duplicate ids', () => {
    const out = normalizeAddOn({
      ...valid(),
      name: '  Crib ',
      nightlyQty: 7,
      locationIds: ['a', 'a', 'b'],
      roomTypeIds: ['x', 'x'],
    });
    expect(out).toMatchObject({
      name: 'Crib',
      nightlyQty: 1,
      locationIds: ['a', 'b'],
      roomTypeIds: ['x'],
    });
  });

  it('keeps the quantity while tracking', () => {
    expect(normalizeAddOn({ ...valid(), trackNightly: true, nightlyQty: 7 }).nightlyQty).toBe(7);
  });
});

describe('isSelectableOn', () => {
  const addOn = { startDate: '2026-10-10', endDate: '2026-10-20' };
  it('is true from the start date through the end date', () => {
    expect(isSelectableOn(addOn, '2026-10-09')).toBe(false);
    expect(isSelectableOn(addOn, '2026-10-10')).toBe(true);
    expect(isSelectableOn(addOn, '2026-10-20')).toBe(true);
    expect(isSelectableOn(addOn, '2026-10-21')).toBe(false);
    expect(isSelectableOn({ startDate: '2026-10-10', endDate: null }, '2030-01-01')).toBe(true);
  });
});

describe('pruneAssociations', () => {
  it('drops ids that no longer exist', () => {
    expect(
      pruneAssociations(
        { locationIds: ['l1', 'gone'], roomTypeIds: ['gone', 't1'] },
        { locations: [{ id: 'l1', label: 'L' }], roomTypes: [{ id: 't1', label: 'T' }] },
      ),
    ).toEqual({ locationIds: ['l1'], roomTypeIds: ['t1'] });
  });
});

describe('checkDeleteAddOn and the sample data', () => {
  it('asks for confirmation naming the add-on', () => {
    expect(checkDeleteAddOn({ name: 'Crib' })).toEqual({
      kind: 'ok',
      message: 'Delete Crib? This cannot be undone.',
    });
  });

  it('has valid sample add-ons', () => {
    for (const addOn of mockAddOns()) expect(validateAddOn(addOn)).toEqual({});
  });
});
