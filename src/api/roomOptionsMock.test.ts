import { createMockClient } from './mock';
import { MOCK_ROOM_OPTIONS } from './roomOptionsData';
import { toRequest, draftFromOptions } from '../app/featureBedOptions';

const base = () => ({
  features: MOCK_ROOM_OPTIONS.features.map(({ id, label }) => ({ id, label })),
  bedSizes: MOCK_ROOM_OPTIONS.bedSizes.map(({ id, label }) => ({ id, label })),
});

describe('mock room options API', () => {
  it('lists the seeded lists with stable ids', async () => {
    const options = await createMockClient().roomOptions.get();
    expect(options.features.map((f) => f.id)).toContain('feature-fridge');
    expect(options.bedSizes.map((b) => b.id)).toEqual([
      'bed-king',
      'bed-queen',
      'bed-double',
      'bed-twin',
    ]);
  });

  it('adds, renames and removes unused items, keeping order and old ids', async () => {
    const api = createMockClient().roomOptions;
    const saved = await api.save({
      requestId: 'r1',
      features: [
        ...base().features.filter((f) => f.id !== 'feature-tub'),
        { label: '  Fireplace  ' },
      ],
      bedSizes: base().bedSizes.map((b) => (b.id === 'bed-twin' ? { ...b, label: 'Twin XL' } : b)),
    });
    expect(saved.features.map((f) => f.label)).toEqual([
      'Mini fridge',
      'Coffee maker',
      'Balcony',
      'Golf course view',
      'Fireplace',
    ]);
    expect(saved.features.at(-1)?.id).toMatch(/^feature-new-/);
    expect(saved.bedSizes[3]).toEqual({ id: 'bed-twin', label: 'Twin XL' });
    expect(await api.get()).toEqual(saved);
  });

  it('is idempotent on requestId and refuses a different body under the same id', async () => {
    const api = createMockClient().roomOptions;
    const request = {
      requestId: 'same',
      ...base(),
      features: [...base().features, { label: 'Sauna' }],
    };
    const first = await api.save(request);
    const second = await api.save(request);
    expect(second).toEqual(first);
    expect(second.features.filter((f) => f.label === 'Sauna')).toHaveLength(1);
    await expect(
      api.save({ ...request, features: [...base().features, { label: 'Other' }] }),
    ).rejects.toMatchObject({ status: 409, code: 'idempotency-conflict' });
  });

  it('rejects empty, too long and duplicate names with 422', async () => {
    const api = createMockClient().roomOptions;
    for (const label of ['', 'x'.repeat(51), 'mini FRIDGE']) {
      await expect(
        api.save({
          requestId: `v-${label.length}`,
          ...base(),
          features: [...base().features, { label }],
        }),
      ).rejects.toMatchObject({ status: 422, code: 'validation' });
    }
  });

  it('refuses removing an item a room type or room uses, and saves nothing', async () => {
    const api = createMockClient().roomOptions;
    await expect(
      api.save({
        requestId: 'inuse',
        features: base().features.filter((f) => f.id !== 'feature-fridge'),
        bedSizes: base().bedSizes.filter((b) => b.id !== 'bed-twin'),
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'in-use',
      details: { features: ['feature-fridge'] },
    });
    expect((await api.get()).bedSizes).toHaveLength(4);
  });

  it('refuses an unknown id with 404', async () => {
    await expect(
      createMockClient().roomOptions.save({
        requestId: 'x',
        ...base(),
        features: [{ id: 'nope', label: 'Nope' }],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('one source of truth', () => {
  it('feeds Room Types, Rooms (room setup options) and the Schedule filter', async () => {
    const client = createMockClient();
    const features = base().features.filter((f) => f.id !== 'feature-tub');
    await client.roomOptions.save({
      requestId: 's',
      features: [...features, { label: 'Fireplace' }],
      bedSizes: [...base().bedSizes, { label: 'Cot' }],
    });
    const setup = await client.roomSetup.getOptions();
    const schedule = await client.schedule.get({ startDate: '2026-10-20', days: 7 });
    const names = (await client.roomOptions.get()).features.map((f) => f.label);
    expect(setup.features.map((f) => f.label)).toEqual(names);
    expect(setup.bedSizes.map((b) => b.label)).toContain('Cot');
    expect(schedule.features?.map((f) => f.name)).toEqual(names);
    // No room of the schedule still lists the removed feature.
    expect(schedule.rooms.some((r) => r.featureIds?.includes('feature-tub'))).toBe(false);
  });

  it('lets a removed bed size go once nothing uses it, and drops its counts', async () => {
    const client = createMockClient();
    await client.roomOptions.save({
      requestId: 'b',
      features: base().features,
      bedSizes: base().bedSizes.filter((b) => b.id !== 'bed-twin'),
    });
    const types = await client.roomSetup.listRoomTypes();
    expect(types.every((t) => !('bed-twin' in t.details.bedTypes))).toBe(true);
  });

  it('round-trips a draft through toRequest', () => {
    const draft = draftFromOptions(MOCK_ROOM_OPTIONS);
    expect(toRequest(draft, 'q').features).toEqual(base().features);
  });
});
