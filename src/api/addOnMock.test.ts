import { ApiError } from './types';
import { createMockClient } from './mock';
import { blankAddOn } from '../app/addOns';

const sku = { id: 'sku-crib', label: 'Crib' };

describe('mock add-on API', () => {
  it('offers SKUs, locations and the room types of the room setup', async () => {
    const options = await createMockClient().addOns.getOptions();
    expect(options.skus.length).toBeGreaterThan(0);
    expect(options.locations.map((l) => l.id)).toContain('main-clubhouse');
    expect(options.roomTypes.map((t) => t.label)).toContain('King Room');
  });

  it('creates, edits and deletes an add-on', async () => {
    const api = createMockClient().addOns;
    const created = await api.save({ ...blankAddOn('2026-10-20'), name: 'Fan', sku });
    expect(created.id).toBeTruthy();
    await api.save({ ...created, name: 'Big fan' });
    expect((await api.list()).find((a) => a.id === created.id)?.name).toBe('Big fan');
    await api.delete(created.id);
    expect((await api.list()).some((a) => a.id === created.id)).toBe(false);
  });

  it('stores the quantity as 1 while tracking is off', async () => {
    const api = createMockClient().addOns;
    const saved = await api.save({
      ...blankAddOn('2026-10-20'),
      name: 'Fan',
      sku,
      trackNightly: false,
      nightlyQty: 9,
    });
    expect(saved.nightlyQty).toBe(1);
  });

  it('rejects an invalid add-on with 422 and a missing one with 404', async () => {
    const api = createMockClient().addOns;
    await expect(api.save(blankAddOn('2026-10-20'))).rejects.toMatchObject({ status: 422 });
    await expect(
      api.save({ ...blankAddOn('2026-10-20'), id: 'nope', name: 'x', sku }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(api.delete('nope')).rejects.toMatchObject({ status: 404 });
  });
});
