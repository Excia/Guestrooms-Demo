import { nightsOverlap } from '../lib/dates';
import { createHttpClient } from './http';
import { createMockClient } from './mock';
import type { ApiClient, ChangeRoomRequest, ScheduleBlock } from './types';

const T = '2026-10-16';
const mk = (o = {}) => createMockClient({ today: T, ...o });
const window = { startDate: '2026-10-06', days: 30 } as const;

let serial = 0;
/** A change request made from the block's current state, as the UI builds it. */
async function request(
  c: ApiClient,
  over: Partial<ChangeRoomRequest> & { toRoomId: string },
  id = 'rr-2',
): Promise<ChangeRoomRequest> {
  const b = (await c.schedule.get(window)).blocks.find((x) => x.id === id)!;
  return {
    requestId: `chg-${++serial}-test`,
    reservationRoomId: id,
    fromRoomId: b.roomId,
    version: b.version,
    effectiveDate: T,
    rateChoice: 'update',
    ...over,
  };
}
const blocksOf = async (c: ApiClient, reservationId: string) =>
  (await c.schedule.get(window)).blocks.filter((b) => b.reservationId === reservationId);

// Daniel Whitfield (GR-50240, rr-2): rm-201 King Deluxe, 10/15 to 10/18, checked in, today 10/16.
// rm-205 Queen Standard is free for 10/16-10/18 (rate 199.00 against 249.00); rm-209 is King Deluxe
// (same rate) and free; rm-204 is booked from 10/18 (same-day turnover).
describe('mock reservations.changeRoomDuringStay', () => {
  it('splits the stay: the nights already stayed stay in the old room, the rest move', async () => {
    const c = mk();
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, { toRoomId: 'rm-205' }),
    );
    const current = result.blocks.find((b) => b.id === 'rr-2')!;
    expect(current).toMatchObject({
      roomId: 'rm-205',
      startDate: T,
      endDate: '2026-10-18',
      status: 'checked-in',
      roomChange: { part: 'current', otherRoomId: 'rm-201' },
    });
    const previous = result.blocks.find((b) => b.id !== 'rr-2')!;
    expect(previous).toMatchObject({
      id: 'rr-2~1',
      roomId: 'rm-201',
      startDate: '2026-10-15',
      endDate: T,
      status: 'checked-out',
      reservationId: 'rs-2',
      confirmationNumber: 'GR-50240',
      roomChange: { part: 'previous', otherRoomId: 'rm-205' },
    });
    expect(current.version).not.toBe('v1');
    // The grid answers both segments, and the stay still occupies every night exactly once.
    const grid = await blocksOf(c, 'rs-2');
    expect(grid.map((b) => b.id).sort()).toEqual(['rr-2', 'rr-2~1']);
    expect(grid.find((b) => b.id === 'rr-2')!.roomCount).toBe(1);
  });

  it('update: the nights not yet stayed take the new rate, stayed nights keep theirs', async () => {
    const c = mk();
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, { toRoomId: 'rm-205', rateChoice: 'update' }),
    );
    expect(result.folio).toEqual({
      deltaCents: -10000,
      repricedNights: 2,
      roomChargesCents: 24900 + 2 * 19900,
    });
    const detail = await c.reservations.getDetail('rs-2');
    expect(detail.stay.lines.map((l) => [l.date, l.amountCents])).toEqual([
      ['2026-10-15', 24900],
      ['2026-10-16', 19900],
      ['2026-10-17', 19900],
    ]);
  });

  it('retain: every night keeps its price, and the delta is zero', async () => {
    const c = mk();
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, { toRoomId: 'rm-205', rateChoice: 'retain' }),
    );
    expect(result.folio).toEqual({
      deltaCents: 0,
      repricedNights: 0,
      roomChargesCents: 3 * 24900,
    });
    const detail = await c.reservations.getDetail('rs-2');
    expect(detail.stay.lines.map((l) => l.amountCents)).toEqual([24900, 24900, 24900]);
    expect(detail.stay.lines.map((l) => l.roomType)).toEqual([
      'King Deluxe',
      'Queen Standard',
      'Queen Standard',
    ]);
  });

  it('the detail shows the current room and lists the earlier one; the stay stays checked in', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(await request(c, { toRoomId: 'rm-205' }));
    const detail = await c.reservations.getDetail('rs-2');
    expect(detail.status).toBe('checked-in');
    expect(detail.rooms).toHaveLength(1);
    expect(detail.rooms[0]).toMatchObject({
      id: 'rr-2',
      roomNumber: '205',
      status: 'checked-in',
      arrival: T,
      departure: '2026-10-18',
      previousStays: [{ roomId: 'rm-201', roomNumber: '201', arrival: '2026-10-15', departure: T }],
    });
    expect(detail.arrival).toBe('2026-10-15');
    expect(detail.nights).toBe(3);
  });

  it('keeps the early and late flags on the stay', async () => {
    const c = mk();
    // rs-2 is seeded with early check in.
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, { toRoomId: 'rm-205' }),
    );
    expect(result.blocks.every((b) => b.earlyCheckIn === true)).toBe(true);
    expect((await c.reservations.getDetail('rs-2')).earlyCheckIn).toBe(true);
  });

  it('marks the vacated room dirty from the effective date', async () => {
    const c = mk();
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, { toRoomId: 'rm-205' }),
    );
    expect(result.vacatedRoom).toEqual({ roomId: 'rm-201', housekeeping: 'dirty', since: T });
    const rooms = (await c.schedule.get(window)).rooms;
    expect(rooms.find((r) => r.id === 'rm-201')!.housekeeping).toBe('dirty');
    expect(rooms.find((r) => r.id === 'rm-205')!.housekeeping).toBeUndefined();
  });

  it('rates that do not differ need no choice', async () => {
    const c = mk();
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, { toRoomId: 'rm-209', rateChoice: null }),
    );
    expect(result.folio.deltaCents).toBe(0);
    expect(result.blocks.find((b) => b.id === 'rr-2')!.roomId).toBe('rm-209');
  });

  it('a missing choice is refused when the setting is on and the rates differ', async () => {
    const c = mk();
    const before = await blocksOf(c, 'rs-2');
    await expect(
      c.reservations.changeRoomDuringStay(
        await request(c, { toRoomId: 'rm-205', rateChoice: null }),
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: 'invalid-query',
      details: { rateChoice: expect.any(Array) },
    });
    expect(await blocksOf(c, 'rs-2')).toEqual(before);
  });

  it('with the setting off, no choice is needed and the new rates apply', async () => {
    const c = mk({ roomChangeRule: { askRateOnRoomChange: false } });
    expect(await c.settings.getRoomChangeRule()).toEqual({ askRateOnRoomChange: false });
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, { toRoomId: 'rm-205', rateChoice: null }),
    );
    expect(result.folio.deltaCents).toBe(-10000);
  });

  it('the rule defaults to asking', async () => {
    expect(await mk().settings.getRoomChangeRule()).toEqual({ askRateOnRoomChange: true });
  });

  describe('refusals apply nothing', () => {
    it('409 stale: version or room out of date', async () => {
      const c = mk();
      const base = await request(c, { toRoomId: 'rm-205' });
      const before = await blocksOf(c, 'rs-2');
      for (const over of [{ version: 'v99' }, { fromRoomId: 'rm-202' }]) {
        await expect(
          c.reservations.changeRoomDuringStay({
            ...base,
            ...over,
            requestId: `stale-${++serial}-test`,
          }),
        ).rejects.toMatchObject({ status: 409, code: 'stale' });
      }
      expect(await blocksOf(c, 'rs-2')).toEqual(before);
    });

    it('409 not-movable: only a checked-in room can change during the stay', async () => {
      const c = mk();
      // rr-5 not yet checked in, rr-1 checked out, rr-3 confirmed.
      for (const id of ['rr-5', 'rr-1', 'rr-3']) {
        await expect(
          c.reservations.changeRoomDuringStay(
            await request(
              c,
              { toRoomId: 'rm-209', effectiveDate: '2026-10-20', rateChoice: null },
              id,
            ),
          ),
        ).rejects.toMatchObject({ status: 409, code: 'not-movable' });
      }
    });

    it('409 conflict: the room is booked or closed on the remaining nights', async () => {
      const c = mk();
      // rm-202 is booked (Thomas Okafor), rm-208 is closed (Fixed Loss).
      for (const roomId of ['rm-202', 'rm-208']) {
        await expect(
          c.reservations.changeRoomDuringStay(await request(c, { toRoomId: roomId })),
        ).rejects.toMatchObject({
          status: 409,
          code: 'conflict',
          details: { roomId: [roomId] },
        });
      }
    });

    it('same-day turnover is not a conflict (rm-204 is booked from the departure day)', async () => {
      const c = mk();
      const result = await c.reservations.changeRoomDuringStay(
        await request(c, { toRoomId: 'rm-204', rateChoice: null }),
      );
      expect(result.blocks.find((b) => b.id === 'rr-2')!.roomId).toBe('rm-204');
    });

    it('400: the effective date must be a night that is not stayed yet', async () => {
      const c = mk();
      for (const effectiveDate of ['2026-10-15', '2026-10-18', '2026-10-30']) {
        await expect(
          c.reservations.changeRoomDuringStay(
            await request(c, { toRoomId: 'rm-209', rateChoice: null, effectiveDate }),
          ),
        ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
      }
    });

    it('400: malformed requests', async () => {
      const c = mk();
      const base = await request(c, { toRoomId: 'rm-205' });
      for (const bad of [
        { ...base, requestId: 'x' },
        { ...base, version: '' },
        { ...base, toRoomId: base.fromRoomId },
        { ...base, toRoomId: '' },
        { ...base, effectiveDate: '2026-02-30' },
        { ...base, rateChoice: 'both' as never },
        { ...base, rateChoice: undefined as never },
      ]) {
        await expect(c.reservations.changeRoomDuringStay(bad)).rejects.toMatchObject({
          status: 400,
        });
      }
    });

    it('404: unknown reservation room or room', async () => {
      const c = mk();
      const base = await request(c, { toRoomId: 'rm-205' });
      await expect(
        c.reservations.changeRoomDuringStay({ ...base, reservationRoomId: 'rr-nope' }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        c.reservations.changeRoomDuringStay({ ...base, toRoomId: 'rm-nope' }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('idempotency', () => {
    it('the same request replays the first answer without applying again', async () => {
      const c = mk();
      const req = await request(c, { toRoomId: 'rm-205' });
      const first = await c.reservations.changeRoomDuringStay(req);
      const again = await c.reservations.changeRoomDuringStay(req);
      expect(again).toEqual(first);
      expect((await blocksOf(c, 'rs-2')).map((b) => b.id).sort()).toEqual(['rr-2', 'rr-2~1']);
    });

    it('the same id with another body is 409 idempotency-conflict', async () => {
      const c = mk();
      const req = await request(c, { toRoomId: 'rm-205' });
      await c.reservations.changeRoomDuringStay(req);
      await expect(
        c.reservations.changeRoomDuringStay({ ...req, toRoomId: 'rm-209' }),
      ).rejects.toMatchObject({ status: 409, code: 'idempotency-conflict' });
    });

    it('a second change after the first needs the new version', async () => {
      const c = mk();
      const req = await request(c, { toRoomId: 'rm-205' });
      await c.reservations.changeRoomDuringStay(req);
      await expect(
        c.reservations.changeRoomDuringStay({
          ...req,
          requestId: 'another-request-1',
          toRoomId: 'rm-209',
        }),
      ).rejects.toMatchObject({ status: 409, code: 'stale' });
    });
  });

  describe('changing again', () => {
    it('on the same day the whole current segment moves and the earlier one follows it', async () => {
      const c = mk();
      await c.reservations.changeRoomDuringStay(await request(c, { toRoomId: 'rm-205' }));
      const result = await c.reservations.changeRoomDuringStay(
        await request(c, { toRoomId: 'rm-209', rateChoice: 'update' }),
      );
      expect(result.blocks.map((b) => b.id).sort()).toEqual(['rr-2', 'rr-2~1']);
      const grid = await blocksOf(c, 'rs-2');
      expect(grid.find((b) => b.id === 'rr-2')).toMatchObject({
        roomId: 'rm-209',
        startDate: T,
        roomChange: { part: 'current', otherRoomId: 'rm-205' },
      });
      // The first change's earlier segment (in rm-201) now continues in rm-209.
      expect(grid.find((b) => b.id === 'rr-2~1')!.roomChange).toEqual({
        part: 'previous',
        otherRoomId: 'rm-209',
      });
      expect(grid).toHaveLength(2);
    });

    it('a drag of the current segment keeps the earlier segment linked', async () => {
      const c = mk();
      await c.reservations.changeRoomDuringStay(await request(c, { toRoomId: 'rm-205' }));
      const b = (await c.schedule.get(window)).blocks.find((x) => x.id === 'rr-2')!;
      const moved = await c.schedule.moveRoom({
        requestId: 'drag-after-change',
        reservationRoomId: 'rr-2',
        toRoomId: 'rm-209',
        fromRoomId: b.roomId,
        version: b.version,
      });
      expect(moved.blocks.map((x) => x.id).sort()).toEqual(['rr-2', 'rr-2~1']);
      expect(moved.blocks.find((x) => x.id === 'rr-2~1')!.roomChange!.otherRoomId).toBe('rm-209');
    });

    it('the stayed segment cannot be moved', async () => {
      const c = mk();
      await c.reservations.changeRoomDuringStay(await request(c, { toRoomId: 'rm-205' }));
      const prev = (await c.schedule.get(window)).blocks.find((x) => x.id === 'rr-2~1')!;
      await expect(
        c.schedule.moveRoom({
          requestId: 'move-previous-1',
          reservationRoomId: prev.id,
          toRoomId: 'rm-209',
          fromRoomId: prev.roomId,
          version: prev.version,
        }),
      ).rejects.toMatchObject({ status: 409, code: 'not-movable' });
    });
  });

  it('never leaves two stays overlapping in a room', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(await request(c, { toRoomId: 'rm-205' }));
    const { blocks, closures } = await c.schedule.get(window);
    const items: { id: string; roomId: string; startDate: string; endDate: string }[] = [
      ...blocks,
      ...closures,
    ];
    for (const a of items) {
      for (const b of items) {
        if (a.id < b.id && a.roomId === b.roomId) {
          expect(nightsOverlap(a.startDate, a.endDate, b.startDate, b.endDate)).toBe(false);
        }
      }
    }
  });

  it('error scenario rejects; empty scenario answers 404', async () => {
    const live = mk();
    const req = await request(live, { toRoomId: 'rm-205' });
    await expect(
      mk({ scenario: 'error' }).reservations.changeRoomDuringStay(req),
    ).rejects.toMatchObject({ status: 500 });
    await expect(
      mk({ scenario: 'empty' }).reservations.changeRoomDuringStay(req),
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ---- the real client ------------------------------------------------------------------------------

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const http = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

async function realAnswer() {
  const c = mk();
  const req = await request(c, { toRoomId: 'rm-205' });
  return { req, answer: await c.reservations.changeRoomDuringStay(req) };
}

describe('http reservations.changeRoomDuringStay', () => {
  it('posts the request with its idempotency key and accepts a matching answer', async () => {
    const { req, answer } = await realAnswer();
    const fetchMock = vi.fn().mockResolvedValue(json(answer));
    const result = await http(fetchMock).reservations.changeRoomDuringStay(req);
    expect(result.blocks).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v1/reservation-rooms/rr-2/change-room');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(req.requestId);
    expect(JSON.parse(init.body as string)).toEqual(req);
  });

  it('rejects a malformed request before fetching', async () => {
    const { req } = await realAnswer();
    const fetchMock = vi.fn();
    await expect(
      http(fetchMock).reservations.changeRoomDuringStay({ ...req, effectiveDate: 'soon' }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an answer that does not match the request', async () => {
    const { req, answer } = await realAnswer();
    const tweak = (f: (a: typeof answer) => unknown) => f(structuredClone(answer));
    const bad: unknown[] = [
      {},
      tweak((a) => ({ ...a, blocks: [] })),
      // moved to another room than asked
      tweak((a) => ({
        ...a,
        blocks: a.blocks.map((b: ScheduleBlock) =>
          b.id === 'rr-2' ? { ...b, roomId: 'rm-209' } : b,
        ),
      })),
      // another effective date
      tweak((a) => ({
        ...a,
        blocks: a.blocks.map((b: ScheduleBlock) =>
          b.id === 'rr-2' ? { ...b, startDate: '2026-10-17' } : b,
        ),
      })),
      // no longer checked in
      tweak((a) => ({
        ...a,
        blocks: a.blocks.map((b: ScheduleBlock) =>
          b.id === 'rr-2' ? { ...b, status: 'nyci' } : b,
        ),
      })),
      // not linked back to the old room
      tweak((a) => ({
        ...a,
        blocks: a.blocks.map((b: ScheduleBlock) =>
          b.id === 'rr-2' ? { ...b, roomChange: undefined } : b,
        ),
      })),
      // an extra block of another reservation
      tweak((a) => ({
        ...a,
        blocks: [...a.blocks, { ...a.blocks[0], id: 'rr-9', reservationId: 'rs-9' }],
      })),
      // an earlier segment that runs past the effective date
      tweak((a) => ({
        ...a,
        blocks: a.blocks.map((b: ScheduleBlock) =>
          b.id !== 'rr-2' ? { ...b, endDate: '2026-10-18' } : b,
        ),
      })),
      // duplicate ids
      tweak((a) => ({ ...a, blocks: [a.blocks[0], a.blocks[0]] })),
      // the vacated room is another room, or the date is wrong
      tweak((a) => ({ ...a, vacatedRoom: { ...a.vacatedRoom, roomId: 'rm-205' } })),
      tweak((a) => ({ ...a, vacatedRoom: { ...a.vacatedRoom, housekeeping: 'spotless' } })),
      tweak((a) => ({ ...a, vacatedRoom: { ...a.vacatedRoom, since: '2026-10-17' } })),
      // money is integer cents
      tweak((a) => ({ ...a, folio: { ...a.folio, deltaCents: 12.5 } })),
      tweak((a) => ({ ...a, folio: { ...a.folio, repricedNights: -1 } })),
      tweak((a) => ({ ...a, folio: undefined })),
      // a block with a malformed link
      tweak((a) => ({
        ...a,
        blocks: a.blocks.map((b: ScheduleBlock) =>
          b.id === 'rr-2' ? { ...b, roomChange: { part: 'sideways', otherRoomId: 'rm-201' } } : b,
        ),
      })),
    ];
    for (const body of bad) {
      await expect(
        http(vi.fn().mockResolvedValue(json(body))).reservations.changeRoomDuringStay(req),
      ).rejects.toMatchObject({ status: 200, code: 'invalid-response' });
    }
  });

  it('passes the error codes through (409 stale, conflict, not-movable)', async () => {
    const { req } = await realAnswer();
    for (const code of ['stale', 'conflict', 'not-movable', 'idempotency-conflict']) {
      await expect(
        http(
          vi.fn().mockResolvedValue(json({ code, message: 'no' }, 409)),
        ).reservations.changeRoomDuringStay(req),
      ).rejects.toMatchObject({ status: 409, code });
    }
    await expect(
      http(
        vi.fn().mockResolvedValue(json({ message: 'boom' }, 500)),
      ).reservations.changeRoomDuringStay(req),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('a network failure is status 0 (unknown outcome)', async () => {
    const { req } = await realAnswer();
    await expect(
      http(vi.fn().mockRejectedValue(new TypeError('offline'))).reservations.changeRoomDuringStay(
        req,
      ),
    ).rejects.toMatchObject({ status: 0, code: 'network' });
  });

  it('settings.getRoomChangeRule reads and guards the rule', async () => {
    const ok = vi.fn().mockResolvedValue(json({ askRateOnRoomChange: false }));
    expect(await http(ok).settings.getRoomChangeRule()).toEqual({ askRateOnRoomChange: false });
    expect((ok.mock.calls[0][0] as URL).pathname).toBe('/v1/settings/room-change-rule');
    for (const body of [{}, { askRateOnRoomChange: 'yes' }, []]) {
      await expect(
        http(vi.fn().mockResolvedValue(json(body))).settings.getRoomChangeRule(),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
  });

  it('the schedule guard accepts roomChange and housekeeping and rejects bad ones', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(await request(c, { toRoomId: 'rm-205' }));
    const data = await c.schedule.get(window);
    const ok = vi.fn().mockResolvedValue(json(data));
    expect((await http(ok).schedule.get(window)).blocks.some((b) => b.roomChange)).toBe(true);
    const badRoom = { ...data, rooms: data.rooms.map((r) => ({ ...r, housekeeping: 'haunted' })) };
    await expect(
      http(vi.fn().mockResolvedValue(json(badRoom))).schedule.get(window),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('the detail guard accepts previous stays and stay line room ids', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(await request(c, { toRoomId: 'rm-205' }));
    const detail = await c.reservations.getDetail('rs-2');
    const got = await http(vi.fn().mockResolvedValue(json(detail))).reservations.getDetail('rs-2');
    expect(got.rooms[0].previousStays).toHaveLength(1);
    const bad = structuredClone(detail);
    (bad.rooms[0] as { previousStays: unknown }).previousStays = [{ roomId: 1 }];
    await expect(
      http(vi.fn().mockResolvedValue(json(bad))).reservations.getDetail('rs-2'),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
});
