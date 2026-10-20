import { createHttpClient } from './http';
import { createScheduleState } from './scheduleData';
import { queryScheduleData } from './scheduleQuery';
import type { ScheduleQuery } from './types';

const T = '2026-10-16';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });
const query: ScheduleQuery = { startDate: T, days: 7 };
const good = () => queryScheduleData(createScheduleState(T), query);

describe('http schedule.get', () => {
  it('sends the query as parameters and accepts a well-formed answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(good()));
    const data = await make(fetchMock).schedule.get({
      ...query,
      locationIds: ['lakeside', 'north-lodge'],
      roomTypeIds: ['suite'],
      availability: 'booked',
    });
    expect(data.rooms.length).toBeGreaterThan(0);
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.pathname).toBe('/v1/schedule');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      startDate: T,
      days: '7',
      locationIds: 'lakeside,north-lodge',
      roomTypeIds: 'suite',
      availability: 'booked',
    });
  });
  it('rejects a malformed query before fetching', async () => {
    const fetchMock = vi.fn();
    await expect(
      make(fetchMock).schedule.get({ ...query, days: 5 as never }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'invalid-query',
    });
    await expect(make(fetchMock).schedule.get({ ...query, locationIds: [] })).rejects.toMatchObject(
      {
        code: 'invalid-query',
      },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects a malformed response', async () => {
    for (const body of [{}, { ...good(), rooms: 'x' }, { ...good(), blocks: [{ id: 'a' }] }]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(body))).schedule.get(query),
      ).rejects.toMatchObject({
        code: 'invalid-response',
      });
    }
  });
  it('rejects an answer for another period or view', async () => {
    for (const other of [
      { ...good(), startDate: '2026-10-17' },
      { ...good(), days: 14 },
    ]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(other))).schedule.get(query),
      ).rejects.toMatchObject({
        code: 'invalid-response',
      });
    }
  });
  it('rejects blocks and closures in rooms that are not listed, and unknown statuses', async () => {
    const d = good();
    const orphan = { ...d, blocks: [{ ...d.blocks[0], roomId: 'ghost' }] };
    const orphanClosure = { ...d, closures: [{ ...d.closures[0], roomId: 'ghost' }] };
    const status = { ...d, blocks: [{ ...d.blocks[0], status: 'pending' }] };
    const backwards = { ...d, blocks: [{ ...d.blocks[0], endDate: d.blocks[0].startDate }] };
    for (const body of [orphan, orphanClosure, status, backwards]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(body))).schedule.get(query),
      ).rejects.toMatchObject({
        code: 'invalid-response',
      });
    }
  });
  it('passes server errors through', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ message: 'boom' }, 500));
    await expect(make(fetchMock).schedule.get(query)).rejects.toMatchObject({
      status: 500,
      message: 'boom',
    });
  });
});

describe('http schedule moves', () => {
  const block = good().blocks[0];

  it('POSTs moveRoom as JSON and checks the moved block', async () => {
    const moved = { blocks: [{ ...block, roomId: 'rm-203' }] };
    const fetchMock = vi.fn().mockResolvedValue(json(moved));
    const res = await make(fetchMock).schedule.moveRoom({
      reservationRoomId: block.id,
      toRoomId: 'rm-203',
    });
    expect(res.blocks[0].roomId).toBe('rm-203');
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v1/schedule/move-room');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      reservationRoomId: block.id,
      toRoomId: 'rm-203',
    });
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
  it('rejects an answer where the block is not where it was sent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ blocks: [block] }));
    await expect(
      make(fetchMock).schedule.moveRoom({ reservationRoomId: block.id, toRoomId: 'rm-203' }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(
      make(vi.fn().mockResolvedValue(json({ blocks: [] }))).schedule.moveRoom({
        reservationRoomId: block.id,
        toRoomId: block.roomId,
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
  it('POSTs moveDates with scope and optional room', async () => {
    const moved = {
      blocks: [{ ...block, startDate: '2026-10-30', endDate: '2026-11-02', roomId: 'rm-203' }],
    };
    const fetchMock = vi.fn().mockResolvedValue(json(moved));
    const request = {
      reservationRoomId: block.id,
      toStartDate: '2026-10-30',
      scope: 'this-room',
      toRoomId: 'rm-203',
    } as const;
    await make(fetchMock).schedule.moveDates(request);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v1/schedule/move-dates');
    expect(JSON.parse(init.body as string)).toEqual(request);
    await expect(
      make(vi.fn().mockResolvedValue(json({ blocks: [block] }))).schedule.moveDates(request),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
  it('surfaces a 409 conflict with its code and details', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({ message: 'Room taken', code: 'conflict', details: { roomId: ['rm-203'] } }, 409),
      );
    await expect(
      make(fetchMock).schedule.moveRoom({ reservationRoomId: block.id, toRoomId: 'rm-203' }),
    ).rejects.toMatchObject({ status: 409, code: 'conflict', details: { roomId: ['rm-203'] } });
  });
  it('validates requests before fetching', async () => {
    const fetchMock = vi.fn();
    const c = make(fetchMock);
    await expect(
      c.schedule.moveRoom({ reservationRoomId: '..', toRoomId: 'a' }),
    ).rejects.toMatchObject({ code: 'invalid-id' });
    await expect(
      c.schedule.moveDates({ reservationRoomId: 'a', toStartDate: 'x', scope: 'all-rooms' }),
    ).rejects.toMatchObject({ code: 'invalid-query' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('aborts a move', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')));
        }),
    );
    const p = make(fetchMock as never).schedule.moveRoom(
      { reservationRoomId: 'a', toRoomId: 'b' },
      { signal: controller.signal },
    );
    await Promise.resolve();
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});
