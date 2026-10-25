import { blankRateCategory } from '../app/rateCategories';
import { createMockClient } from './mock';
import { RATE_CATEGORY_IDS } from './rateCategoryData';

const sku = { id: 'sku-package', label: 'Stay and play package' };
const fresh = (name: string, roomTypeIds = ['rt-king']) => ({
  ...blankRateCategory('2026-10-20', roomTypeIds),
  name,
  sku,
});

describe('mock rate category API', () => {
  it('seeds the four categories of the designs', async () => {
    const list = await createMockClient().rateCategories.list();
    expect(list.map((c) => c.name)).toEqual([
      'Comp Rate',
      'Member Rate',
      'Non-Member Rate',
      'Owner Rate',
    ]);
  });

  it('offers SKUs and the room types of the room setup', async () => {
    const options = await createMockClient().rateCategories.getOptions();
    expect(options.skus.length).toBeGreaterThan(0);
    expect(options.roomTypes.map((t) => t.label)).toContain('King Room');
  });

  it('creates, edits and deletes a category', async () => {
    const api = createMockClient().rateCategories;
    const created = await api.save(fresh('Trade Rate'));
    expect(created.id).toBeTruthy();
    expect(created.reservationCount).toBe(0);
    await api.save({ ...fresh('Trade Rate 2'), id: created.id });
    expect((await api.list()).find((c) => c.id === created.id)?.name).toBe('Trade Rate 2');
    await api.delete(created.id);
    expect((await api.list()).some((c) => c.id === created.id)).toBe(false);
  });

  it('stores rates only for the associated room types', async () => {
    const api = createMockClient().rateCategories;
    const saved = await api.save(fresh('Trade Rate', ['rt-king']));
    expect(Object.keys(saved.seasons[0].rates)).toEqual(['rt-king']);
  });

  it('a retried create with the same request id returns the first category', async () => {
    const api = createMockClient().rateCategories;
    const input = { ...fresh('Trade Rate'), requestId: 'req-1' };
    const first = await api.save(input);
    const second = await api.save(input);
    expect(second.id).toBe(first.id);
    expect((await api.list()).filter((c) => c.name === 'Trade Rate')).toHaveLength(1);
  });

  it('rejects an invalid category with 422, a taken name with 409 and a missing one with 404', async () => {
    const api = createMockClient().rateCategories;
    await expect(api.save({ ...fresh('x'), sku: null })).rejects.toMatchObject({ status: 422 });
    await expect(api.save(fresh('member rate'))).rejects.toMatchObject({
      status: 409,
      code: 'duplicate-name',
    });
    await expect(api.save({ ...fresh('Other'), id: 'nope' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(api.save({ ...fresh('Other'), roomTypeIds: ['rt-nope'] })).rejects.toMatchObject({
      status: 422,
    });
    await expect(api.delete('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('refuses to delete a category that reservations or settings use', async () => {
    const api = createMockClient().rateCategories;
    await expect(api.delete(RATE_CATEGORY_IDS.member)).rejects.toMatchObject({
      status: 409,
      code: 'in-use',
    });
    await expect(api.delete(RATE_CATEGORY_IDS.nonMember)).rejects.toMatchObject({ status: 409 });
    await api.delete(RATE_CATEGORY_IDS.owner);
    expect((await api.list()).some((c) => c.id === RATE_CATEGORY_IDS.owner)).toBe(false);
  });

  it('duplicates a category under a new name, with its own season ids and no usage', async () => {
    const api = createMockClient().rateCategories;
    const copy = await api.duplicate({
      sourceId: RATE_CATEGORY_IDS.member,
      name: 'Member Rate (Copy)',
      requestId: 'dup-1',
    });
    expect(copy.reservationCount).toBe(0);
    expect(copy.settingNames).toEqual([]);
    expect(copy.seasons).toHaveLength(3);
    const source = (await api.list()).find((c) => c.id === RATE_CATEGORY_IDS.member);
    expect(copy.seasons.map((s) => s.id)).not.toEqual(source?.seasons.map((s) => s.id));
    expect(copy.seasons[1].rates).toEqual(source?.seasons[1].rates);
    // Retried with the same key: no second copy.
    const again = await api.duplicate({
      sourceId: RATE_CATEGORY_IDS.member,
      name: 'Member Rate (Copy)',
      requestId: 'dup-1',
    });
    expect(again.id).toBe(copy.id);
    expect((await api.list()).filter((c) => c.name === 'Member Rate (Copy)')).toHaveLength(1);
  });

  it('refuses a duplicate under a taken or empty name, or from a missing source', async () => {
    const api = createMockClient().rateCategories;
    await expect(
      api.duplicate({ sourceId: RATE_CATEGORY_IDS.member, name: 'Comp Rate', requestId: 'a' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      api.duplicate({ sourceId: RATE_CATEGORY_IDS.member, name: ' ', requestId: 'b' }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      api.duplicate({ sourceId: 'nope', name: 'Zed', requestId: 'c' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('Quick Stats revenue rows follow the category list', async () => {
    const client = createMockClient();
    await client.rateCategories.save({ ...fresh('Trade Rate') });
    const stats = await client.dashboard.getQuickStats({ view: 'day', date: '2026-10-20' });
    expect(stats.revenue.rows.map((r) => r.name)).toContain('Trade Rate');
    expect(stats.revenue.rows.find((r) => r.name === 'Comp Rate')?.revenue).toBe(0);
  });
});
