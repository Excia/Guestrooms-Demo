import { createMockClient } from './mock';
import { createHttpClient } from './http';
import type { ScheduleQuery } from './types';

const query = (startDate: string): ScheduleQuery => ({ startDate, days: 7 });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('mock room order', () => {
  it('saves the listed rooms first, in order, and keeps the others after', async () => {
    const api = createMockClient().roomSetup;
    const saved = await api.saveRoomOrder(['room-103', 'room-100']);
    expect(saved.map((r) => r.id)).toEqual([
      'room-103',
      'room-100',
      'room-101',
      'room-102',
      'room-200',
      'room-300',
    ]);
    expect((await api.listRooms()).map((r) => r.id)).toEqual(saved.map((r) => r.id));
  });

  it('rejects an unknown room (404) and a repeated one (422)', async () => {
    const api = createMockClient().roomSetup;
    await expect(api.saveRoomOrder(['nope'])).rejects.toMatchObject({ status: 404 });
    await expect(api.saveRoomOrder(['room-100', 'room-100'])).rejects.toMatchObject({
      status: 422,
      code: 'validation',
    });
  });

  it('drives the Schedule row order: matched rooms fill their rows in the saved order', async () => {
    const client = createMockClient();
    const numbers = async () =>
      (await client.schedule.get(query('2026-10-20'))).rooms.map((r) => r.number);
    const before = await numbers();
    const rows = (list: string[]) => ['101', '102', '103'].map((n) => list.indexOf(n));
    const [a, b, c] = rows(before);
    expect(a).toBeGreaterThan(-1);
    await client.roomSetup.saveRoomOrder(['room-103', 'room-102', 'room-101']);
    const after = await numbers();
    expect(after[a]).toBe('103');
    expect(after[b]).toBe('102');
    expect(after[c]).toBe('101');
    // Rooms without a setup record keep their rows.
    expect(after).toHaveLength(before.length);
    expect(after.filter((_, i) => ![a, b, c].includes(i))).toEqual(
      before.filter((_, i) => ![a, b, c].includes(i)),
    );
  });
});

describe('http room order', () => {
  const make = (fetchMock: typeof fetch) =>
    createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

  it('PUTs the ids to /rooms/order and reads the rooms', async () => {
    const rooms = await createMockClient().roomSetup.listRooms();
    const fetchMock = vi.fn().mockResolvedValue(json(rooms));
    const out = await make(fetchMock).roomSetup.saveRoomOrder(['room-100']);
    expect(out).toHaveLength(rooms.length);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/rooms/order');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ roomIds: ['room-100'] }),
    });
  });

  it('rejects a malformed order before fetching', async () => {
    const fetchMock = vi.fn();
    const api = make(fetchMock).roomSetup;
    await expect(api.saveRoomOrder(['a', 'a'])).rejects.toMatchObject({ status: 422 });
    await expect(api.saveRoomOrder([''])).rejects.toMatchObject({ code: 'invalid-id' });
    await expect(api.saveRoomOrder('x' as never)).rejects.toMatchObject({ code: 'invalid-order' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
