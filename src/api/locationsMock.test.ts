import { createMockClient } from './mock';
import { ApiError, type LocationInput } from './types';

const input = (l: LocationInput): LocationInput => ({ id: l.id, name: l.name, area: l.area });

describe('mock locations API', () => {
  it('lists the seeded locations with their areas and usage, and the areas', async () => {
    const api = createMockClient().locations;
    const list = await api.list();
    expect(list.map((l) => l.name)).toEqual(['Main Clubhouse', 'North Lodge', 'Lakeside Cottages']);
    expect(list.every((l) => l.area !== null)).toBe(true);
    expect(list[0].usage.roomCount).toBeGreaterThan(0);
    expect((await api.listAreas()).length).toBeGreaterThan(2);
  });

  it('saves a rename and a new location, keeping the usage of existing ones', async () => {
    const api = createMockClient().locations;
    const [main, north, lake] = await api.list();
    const area = main.area;
    const saved = await api.save([
      input({ ...main, name: 'Clubhouse ' }),
      input(north),
      input(lake),
      input({ id: 'new-1', name: 'Annex', area }),
    ]);
    expect(saved.map((l) => l.name)).toEqual([
      'Clubhouse',
      'North Lodge',
      'Lakeside Cottages',
      'Annex',
    ]);
    expect(saved[0].usage).toEqual(main.usage);
    expect(saved[3].usage).toEqual({ roomTypes: [], roomCount: 0 });
    expect(await api.list()).toEqual(saved);
  });

  it('is idempotent: saving the same list twice stores it once', async () => {
    const api = createMockClient().locations;
    const rows = (await api.list()).map(input);
    const body = [...rows, input({ id: 'new-1', name: 'Annex', area: rows[0].area })];
    const first = await api.save(body);
    const second = await api.save(body);
    expect(second).toEqual(first);
    expect(await api.list()).toHaveLength(4);
  });

  it('rejects an invalid list with 422', async () => {
    const api = createMockClient().locations;
    const [main] = await api.list();
    for (const rows of [
      [],
      [input({ id: 'x', name: '', area: main.area })],
      [input({ id: 'x', name: 'A', area: null })],
      [input({ id: 'x', name: 'y'.repeat(51), area: main.area })],
    ]) {
      await expect(api.save(rows)).rejects.toMatchObject({ status: 422, code: 'validation' });
    }
    await expect(api.save([])).rejects.toBeInstanceOf(ApiError);
  });

  it('refuses to drop a location that is in use, and allows dropping a free one', async () => {
    const api = createMockClient().locations;
    const [main, north, lake] = await api.list();
    await expect(api.save([input(north), input(lake)])).rejects.toMatchObject({
      status: 409,
      code: 'location-in-use',
    });
    const saved = await api.save([input(main), input(lake)]);
    expect(saved.map((l) => l.id)).toEqual([main.id, lake.id]);
  });
});
