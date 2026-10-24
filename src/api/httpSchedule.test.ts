import { createHttpClient } from './http';
import { createScheduleState } from './scheduleData';
import { queryScheduleData } from './scheduleQuery';
import type { ScheduleBlock, ScheduleQuery } from './types';

const T = '2026-10-16';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });
const query: ScheduleQuery = { startDate: T, days: 7 };
const good = () => queryScheduleData(createScheduleState(T), query);

describe('http schedule.get', () => {
  it('sends the query as parameters and accepts a well-formed answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(good()));
    const data = await make(fetchMock).schedule.get(query);
    expect(data.rooms.length).toBeGreaterThan(0);
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.pathname).toBe('/v1/schedule');
    expect(Object.fromEntries(url.searchParams)).toEqual({ startDate: T, days: '7' });
  });
  it('rejects a malformed query before fetching', async () => {
    const fetchMock = vi.fn();
    await expect(
      make(fetchMock).schedule.get({ ...query, days: 5 as never }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'invalid-query',
    });
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
  it('accepts unassigned blocks without a listed room, and requires a valid list', async () => {
    const d = good();
    expect(d.unassigned.length).toBeGreaterThan(0);
    expect(d.unassigned.every((b) => b.roomId === '')).toBe(true);
    const ok = await make(vi.fn().mockResolvedValue(json(d))).schedule.get(query);
    expect(ok.unassigned).toHaveLength(d.unassigned.length);
    const without: Record<string, unknown> = { ...d };
    delete without.unassigned;
    const dupe = { ...d, unassigned: [...d.unassigned, d.unassigned[0]] };
    const bad = { ...d, unassigned: [{ ...d.unassigned[0], status: 'pending' }] };
    for (const body of [without, { ...d, unassigned: 'x' }, dupe, bad]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(body))).schedule.get(query),
      ).rejects.toMatchObject({ code: 'invalid-response' });
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
  const guard = {
    requestId: 'req-12345678',
    version: block.version,
    fromRoomId: block.roomId,
  };
  const roomRequest = { ...guard, reservationRoomId: block.id, toRoomId: 'rm-203' };

  it('POSTs moveRoom as JSON with the idempotency key and checks the moved block', async () => {
    const moved = { blocks: [{ ...block, roomId: 'rm-203' }] };
    const fetchMock = vi.fn().mockResolvedValue(json(moved));
    const res = await make(fetchMock).schedule.moveRoom(roomRequest);
    expect(res.blocks[0].roomId).toBe('rm-203');
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v1/schedule/move-room');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(roomRequest);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Idempotency-Key']).toBe('req-12345678');
  });
  it('rejects an answer where the block is not where it was sent', async () => {
    await expect(
      make(vi.fn().mockResolvedValue(json({ blocks: [block] }))).schedule.moveRoom(roomRequest),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(
      make(vi.fn().mockResolvedValue(json({ blocks: [] }))).schedule.moveRoom({
        ...roomRequest,
        toRoomId: block.roomId,
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
  it('POSTs moveDates with scope, guard and optional room', async () => {
    const moved = {
      blocks: [{ ...block, startDate: '2026-10-30', endDate: '2026-11-02', roomId: 'rm-203' }],
    };
    const fetchMock = vi.fn().mockResolvedValue(json(moved));
    const request = {
      ...guard,
      reservationRoomId: block.id,
      fromStartDate: block.startDate,
      toStartDate: '2026-10-30',
      scope: 'this-room',
      toRoomId: 'rm-203',
    } as const;
    await make(fetchMock).schedule.moveDates(request);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v1/schedule/move-dates');
    expect(JSON.parse(init.body as string)).toEqual(request);
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(request.requestId);
    await expect(
      make(vi.fn().mockResolvedValue(json({ blocks: [block] }))).schedule.moveDates(request),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
  const datesRequest = (scope: 'all-rooms' | 'this-room') =>
    ({
      ...guard,
      reservationRoomId: 'a',
      fromStartDate: '2026-10-18',
      toStartDate: '2026-10-25',
      scope,
    }) as const;
  const trio = (over: Partial<ScheduleBlock> = {}) =>
    ['a', 'b', 'c'].map((id) => ({
      ...block,
      id,
      reservationId: 'rs',
      roomCount: 3,
      startDate: '2026-10-25',
      endDate: '2026-10-28',
      ...over,
    }));
  it("checks that an 'all-rooms' answer carries every room of the reservation", async () => {
    const ok = make(vi.fn().mockResolvedValue(json({ blocks: trio() })));
    await expect(ok.schedule.moveDates(datesRequest('all-rooms'))).resolves.toBeDefined();
    for (const blocks of [
      trio().slice(0, 2),
      [...trio().slice(0, 2), { ...trio()[2], roomCount: 2 }],
    ]) {
      await expect(
        make(vi.fn().mockResolvedValue(json({ blocks }))).schedule.moveDates(
          datesRequest('all-rooms'),
        ),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
  });
  it("accepts a room-only 'all-rooms' answer with just the moved block, but not a short date shift", async () => {
    const one = [{ ...trio()[0], roomId: 'rm-9', startDate: '2026-10-18', endDate: '2026-10-21' }];
    const roomOnly = { ...datesRequest('all-rooms'), toStartDate: '2026-10-18', toRoomId: 'rm-9' };
    await expect(
      make(vi.fn().mockResolvedValue(json({ blocks: one }))).schedule.moveDates(roomOnly),
    ).resolves.toBeDefined();
    await expect(
      make(vi.fn().mockResolvedValue(json({ blocks: trio().slice(0, 1) }))).schedule.moveDates(
        datesRequest('all-rooms'),
      ),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
  it('checks that a split room left the reservation', async () => {
    const split = [
      { ...trio()[0], reservationId: 'rs-split', roomCount: 1 },
      ...trio()
        .slice(1)
        .map((b) => ({ ...b, roomCount: 2 })),
    ];
    await expect(
      make(vi.fn().mockResolvedValue(json({ blocks: split }))).schedule.moveDates(
        datesRequest('this-room'),
      ),
    ).resolves.toBeDefined();
    await expect(
      make(vi.fn().mockResolvedValue(json({ blocks: trio() }))).schedule.moveDates(
        datesRequest('this-room'),
      ),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
  it('surfaces a 409 conflict with its code and details', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({ message: 'Room taken', code: 'conflict', details: { roomId: ['rm-203'] } }, 409),
      );
    await expect(make(fetchMock).schedule.moveRoom(roomRequest)).rejects.toMatchObject({
      status: 409,
      code: 'conflict',
      details: { roomId: ['rm-203'] },
    });
  });
  it('validates requests before fetching', async () => {
    const fetchMock = vi.fn();
    const c = make(fetchMock);
    await expect(
      c.schedule.moveRoom({ ...roomRequest, reservationRoomId: '..' }),
    ).rejects.toMatchObject({ code: 'invalid-id' });
    await expect(
      c.schedule.moveDates({ ...datesRequest('all-rooms'), toStartDate: 'x' }),
    ).rejects.toMatchObject({ code: 'invalid-query' });
    await expect(c.schedule.moveRoom({ ...roomRequest, requestId: 'short' })).rejects.toMatchObject(
      { code: 'invalid-query' },
    );
    await expect(c.schedule.moveRoom({ ...roomRequest, version: '' })).rejects.toMatchObject({
      code: 'invalid-query',
    });
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
    const p = make(fetchMock as never).schedule.moveRoom(roomRequest, {
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('http schedule.get rejects duplicate ids', () => {
  it('duplicate room, block or closure ids', async () => {
    const d = good();
    const bodies = [
      { ...d, rooms: [...d.rooms, d.rooms[0]] },
      { ...d, blocks: [...d.blocks, d.blocks[0]] },
      { ...d, closures: [...d.closures, d.closures[0]] },
      { ...d, closures: [{ ...d.closures[0], id: d.blocks[0].id }] },
    ];
    for (const body of bodies) {
      await expect(
        make(vi.fn().mockResolvedValue(json(body))).schedule.get(query),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
  });
});

describe('http schedule.setHousekeeping', () => {
  const block = good().blocks[0];
  const req = {
    reservationRoomId: block.id,
    status: 'cleaned' as const,
    notes: 'Spotless',
    version: block.version,
    requestId: 'req-hk-12345',
  };
  const answer = { blocks: [{ ...block, housekeeping: 'cleaned', housekeepingNotes: 'Spotless' }] };

  it('POSTs JSON with the idempotency key and returns the changed block', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(answer));
    const res = await make(fetchMock).schedule.setHousekeeping(req);
    expect(res.blocks[0]).toMatchObject({ housekeeping: 'cleaned', housekeepingNotes: 'Spotless' });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v1/schedule/housekeeping');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(req);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Idempotency-Key']).toBe('req-hk-12345');
  });
  it('accepts a status-only request whatever note the block has', async () => {
    const { notes: _notes, ...statusOnly } = req;
    void _notes;
    const res = await make(vi.fn().mockResolvedValue(json(answer))).schedule.setHousekeeping(
      statusOnly,
    );
    expect(res.blocks).toHaveLength(1);
  });
  it('rejects an answer that does not carry the requested status or note', async () => {
    for (const blocks of [
      [{ ...block, housekeeping: 'ready', housekeepingNotes: 'Spotless' }],
      [{ ...block, housekeeping: 'cleaned', housekeepingNotes: 'Other' }],
      [{ ...block, id: 'someone-else', housekeeping: 'cleaned', housekeepingNotes: 'Spotless' }],
      [],
    ]) {
      await expect(
        make(vi.fn().mockResolvedValue(json({ blocks }))).schedule.setHousekeeping(req),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
  });
  it('rejects an answer with an unknown housekeeping status', async () => {
    const bad = { blocks: [{ ...block, housekeeping: 'dusty' }] };
    await expect(
      make(vi.fn().mockResolvedValue(json(bad))).schedule.setHousekeeping({
        ...req,
        notes: undefined,
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
  it('validates the request before fetching, and never sends nyci', async () => {
    const fetchMock = vi.fn();
    const c = make(fetchMock);
    await expect(
      c.schedule.setHousekeeping({ ...req, reservationRoomId: '..' }),
    ).rejects.toMatchObject({ code: 'invalid-id' });
    for (const bad of [
      { status: 'nyci' },
      { status: 'dusty' },
      { requestId: 'short' },
      { version: '' },
      { notes: 'x'.repeat(2001) },
    ]) {
      await expect(c.schedule.setHousekeeping({ ...req, ...bad } as never)).rejects.toMatchObject({
        code: 'invalid-query',
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('surfaces a 409 stale with its code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ message: 'changed', code: 'stale' }, 409));
    await expect(make(fetchMock).schedule.setHousekeeping(req)).rejects.toMatchObject({
      status: 409,
      code: 'stale',
    });
  });
});
