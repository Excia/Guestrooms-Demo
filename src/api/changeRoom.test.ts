import { addDays, nightsOverlap } from '../lib/dates';
import { createHttpClient } from './http';
import { createMockClient } from './mock';
import type { ApiClient, ChangeRoomRequest, ScheduleBlock } from './types';

const T = '2026-10-16';
const mk = (o = {}) => createMockClient({ today: T, ...o });
const window = { startDate: '2026-10-06', days: 30 } as const;

// Victor Almeida (GR-50271, rr-14): rm-301 Suite (349.00), 10/15 to 10/20, checked in; today is
// 10/16, so the remaining nights are 10/16 to 10/19. rm-110 is a free Suite (same rate), rm-107 and
// rm-108 are free Queen Standard rooms (199.00), rm-302 is booked 10/17 to 10/19, rm-208 is closed
// 10/17 to 10/20.
// Daniel Whitfield (GR-50240, rr-2): rm-201 King Deluxe, 10/15 to 10/18; remaining 10/16 and 10/17.
const VICTOR = {
  id: 'rr-14',
  room: 'rm-301',
  nights: ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'],
};
const DANIEL = { id: 'rr-2', room: 'rm-201', nights: ['2026-10-16', '2026-10-17'] };
type Stay = typeof VICTOR;

let serial = 0;
/** A request made from the block's current state, as the UI builds it. `rooms` overrides nights by date. */
async function request(
  c: ApiClient,
  stay: Stay,
  rooms: Record<string, string>,
  over: Partial<ChangeRoomRequest> = {},
): Promise<ChangeRoomRequest> {
  const b = (await c.schedule.get(window)).blocks.find((x) => x.id === stay.id)!;
  return {
    requestId: `chg-${++serial}-test`,
    reservationRoomId: stay.id,
    fromRoomId: b.roomId,
    version: b.version,
    nights: stay.nights.map((date) => ({ date, roomId: rooms[date] ?? stay.room })),
    rateChoice: 'update',
    ...over,
  };
}
const stayBlocks = async (c: ApiClient, reservationId: string) =>
  (await c.schedule.get(window)).blocks
    .filter((b) => b.reservationId === reservationId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
const shape = (blocks: ScheduleBlock[]) =>
  blocks.map((b) =>
    [b.roomChange?.part, b.roomId, b.startDate.slice(5), b.endDate.slice(5)].join(' '),
  );

describe('mock reservations.changeRoomDuringStay (per night)', () => {
  it('change only the last night: the stay becomes two blocks (the stayed night shares the current room)', async () => {
    const c = mk();
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, VICTOR, { '2026-10-19': 'rm-107' }),
    );
    expect(shape(await stayBlocks(c, 'rs-11'))).toEqual([
      'current rm-301 10-15 10-19',
      'next rm-107 10-19 10-20',
    ]);
    const current = result.blocks.find((b) => b.id === 'rr-14')!;
    expect(current).toMatchObject({
      status: 'checked-in',
      roomChange: { part: 'current', index: 1, count: 2, stayId: 'rr-14' },
    });
    // The stayed night is not a separate block when it is in the same room: both stay checked in.
    expect(result.blocks.map((b) => b.status)).toEqual(['checked-in', 'checked-in']);
    expect(result.blocks.every((b) => b.confirmationNumber === 'GR-50271')).toBe(true);
    expect(result.blocks.every((b) => b.roomCount === 1)).toBe(true);
    expect(result.vacatedRoom).toBeNull();
  });

  it('change a middle night: the remaining stay is three runs', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(await request(c, VICTOR, { '2026-10-17': 'rm-107' }));
    expect(shape(await stayBlocks(c, 'rs-11'))).toEqual([
      'current rm-301 10-15 10-17',
      'next rm-107 10-17 10-18',
      'next rm-301 10-18 10-20',
    ]);
  });

  it('change all remaining nights: the stayed night stays behind in the old room, tonight’s old room is vacated (dirty)', async () => {
    const c = mk();
    const all = Object.fromEntries(VICTOR.nights.map((d) => [d, 'rm-110']));
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, VICTOR, all, { rateChoice: null }),
    );
    expect(shape(await stayBlocks(c, 'rs-11'))).toEqual([
      'previous rm-301 10-15 10-16',
      'current rm-110 10-16 10-20',
    ]);
    expect(result.vacatedRoom).toEqual({ roomId: 'rm-301', housekeeping: 'dirty', since: T });
    const rooms = (await c.schedule.get(window)).rooms;
    expect(rooms.find((r) => r.id === 'rm-301')!.housekeeping).toBe('dirty');
    expect(rooms.find((r) => r.id === 'rm-110')!.housekeeping).toBeUndefined();
  });

  it('changing tonight and later nights splits at tonight: stayed nights never move', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(
      await request(
        c,
        VICTOR,
        { '2026-10-16': 'rm-110', '2026-10-17': 'rm-110' },
        { rateChoice: null },
      ),
    );
    expect(shape(await stayBlocks(c, 'rs-11'))).toEqual([
      'previous rm-301 10-15 10-16',
      'current rm-110 10-16 10-18',
      'next rm-301 10-18 10-20',
    ]);
  });

  it('a night reverted to its original room merges back into ONE block with no link', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(await request(c, VICTOR, { '2026-10-19': 'rm-107' }));
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, VICTOR, {}, { rateChoice: 'update' }),
    );
    expect(shape(await stayBlocks(c, 'rs-11'))).toEqual([' rm-301 10-15 10-20']);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].roomChange).toBeUndefined();
    expect(result.blocks[0].status).toBe('checked-in');
    expect(result.removedBlockIds).toHaveLength(1);
    // Unsplit again: no earlier or later rooms in the detail, and it can be dragged like any stay.
    const detail = await c.reservations.getDetail('rs-11');
    expect(detail.rooms[0].previousStays).toBeUndefined();
    expect(detail.rooms[0].upcomingStays).toBeUndefined();
  });

  it('sending every remaining night back to the first room joins the stayed night too', async () => {
    const c = mk();
    const all = Object.fromEntries(VICTOR.nights.map((d) => [d, 'rm-110']));
    await c.reservations.changeRoomDuringStay(await request(c, VICTOR, all, { rateChoice: null }));
    expect(shape(await stayBlocks(c, 'rs-11')).length).toBe(2);
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, VICTOR, {}, { rateChoice: null }),
    );
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      roomId: 'rm-301',
      startDate: '2026-10-15',
      endDate: '2026-10-20',
    });
    expect(result.blocks[0].roomChange).toBeUndefined();
  });

  it('a plan with no change is refused', async () => {
    const c = mk();
    await expect(
      c.reservations.changeRoomDuringStay(await request(c, VICTOR, {})),
    ).rejects.toMatchObject({
      status: 400,
      code: 'invalid-query',
      details: { nights: expect.any(Array) },
    });
  });

  it('the nights must be exactly the remaining ones (no stayed night, none missing, none extra)', async () => {
    const c = mk();
    const base = await request(c, VICTOR, { '2026-10-19': 'rm-107' });
    const bad = [
      { ...base, nights: base.nights.slice(0, 3) },
      { ...base, nights: [...base.nights, { date: '2026-10-20', roomId: 'rm-107' }] },
    ];
    for (const b of bad) {
      await expect(
        c.reservations.changeRoomDuringStay({ ...b, requestId: `bad-${++serial}-test` }),
      ).rejects.toMatchObject({ status: 400 });
    }
    // A plan that starts on another night than the server's today is a stale effective date.
    for (const nights of [
      [{ date: '2026-10-15', roomId: 'rm-107' }, ...base.nights],
      base.nights.slice(1),
    ]) {
      await expect(
        c.reservations.changeRoomDuringStay({ ...base, nights, requestId: `bad-${++serial}-test` }),
      ).rejects.toMatchObject({
        status: 409,
        code: 'stale',
        details: { reason: ['effective-date'], today: [T] },
      });
    }
    expect(shape(await stayBlocks(c, 'rs-11'))).toEqual([' rm-301 10-15 10-20']);
  });

  describe('rates', () => {
    const prices = async (c: ApiClient) =>
      (await c.reservations.getDetail('rs-11')).stay.lines.map((l) => l.amountCents);

    it('update: only the nights whose room changed take the new rate; stayed nights keep theirs', async () => {
      const c = mk();
      const result = await c.reservations.changeRoomDuringStay(
        await request(c, VICTOR, { '2026-10-17': 'rm-107', '2026-10-18': 'rm-107' }),
      );
      expect(result.folio).toEqual({
        deltaCents: -2 * 15000,
        repricedNights: 2,
        roomChargesCents: 3 * 34900 + 2 * 19900,
      });
      expect(await prices(c)).toEqual([34900, 34900, 19900, 19900, 34900]);
    });

    it('retain: the changed nights keep their price and the delta is zero', async () => {
      const c = mk();
      const result = await c.reservations.changeRoomDuringStay(
        await request(c, VICTOR, { '2026-10-17': 'rm-107' }, { rateChoice: 'retain' }),
      );
      expect(result.folio).toMatchObject({
        deltaCents: 0,
        repricedNights: 0,
        roomChargesCents: 5 * 34900,
      });
      expect(await prices(c)).toEqual([34900, 34900, 34900, 34900, 34900]);
      // A later change keeps the retained price of the night it does not touch.
      await c.reservations.changeRoomDuringStay(
        await request(c, VICTOR, { '2026-10-17': 'rm-107', '2026-10-19': 'rm-108' }),
      );
      expect(await prices(c)).toEqual([34900, 34900, 34900, 34900, 19900]);
    });

    it('same rates need no choice; a missing choice is refused when the setting is on and the rates differ', async () => {
      const c = mk();
      const same = await c.reservations.changeRoomDuringStay(
        await request(c, VICTOR, { '2026-10-19': 'rm-110' }, { rateChoice: null }),
      );
      expect(same.folio.deltaCents).toBe(0);
      const before = await stayBlocks(c, 'rs-11');
      await expect(
        c.reservations.changeRoomDuringStay(
          await request(c, VICTOR, { '2026-10-18': 'rm-107' }, { rateChoice: null }),
        ),
      ).rejects.toMatchObject({ status: 400, details: { rateChoice: expect.any(Array) } });
      expect(await stayBlocks(c, 'rs-11')).toEqual(before);
    });

    it('with the setting off, no choice is needed and the new rates apply', async () => {
      const c = mk({ roomChangeRule: { askRateOnRoomChange: false } });
      expect(await c.settings.getRoomChangeRule()).toEqual({ askRateOnRoomChange: false });
      const result = await c.reservations.changeRoomDuringStay(
        await request(c, VICTOR, { '2026-10-19': 'rm-107' }, { rateChoice: null }),
      );
      expect(result.folio.deltaCents).toBe(-15000);
    });

    it('the rule defaults to asking', async () => {
      expect(await mk().settings.getRoomChangeRule()).toEqual({ askRateOnRoomChange: true });
    });
  });

  it('the detail shows the current room with the whole stay, and lists earlier and later rooms', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(
      await request(c, VICTOR, { '2026-10-16': 'rm-110', '2026-10-19': 'rm-107' }),
    );
    const detail = await c.reservations.getDetail('rs-11');
    expect(detail.status).toBe('checked-in');
    expect(detail.rooms).toHaveLength(1);
    expect(detail.rooms[0]).toMatchObject({
      id: 'rr-14',
      roomNumber: '110',
      status: 'checked-in',
      arrival: T,
      departure: '2026-10-20',
      previousStays: [{ roomNumber: '301', arrival: '2026-10-15', departure: T }],
      upcomingStays: [
        { roomNumber: '301', arrival: '2026-10-17', departure: '2026-10-19' },
        { roomNumber: '107', arrival: '2026-10-19', departure: '2026-10-20' },
      ],
    });
    expect(detail.arrival).toBe('2026-10-15');
    expect(detail.nights).toBe(5);
  });

  it('keeps the room order of a multi-room reservation when one of its rooms is split', async () => {
    const c = mk();
    // Robert and Elaine Cho (GR-50290): rm-210 (rr-10) and rm-206 (rr-11), checked in until 10/17.
    const before = (await c.reservations.getDetail('rs-8')).rooms.map((r) => r.id);
    expect(before).toEqual(['rr-10', 'rr-11']);
    const b = (await c.schedule.get(window)).blocks.find((x) => x.id === 'rr-10')!;
    await c.reservations.changeRoomDuringStay({
      requestId: 'multi-room-1',
      reservationRoomId: 'rr-10',
      fromRoomId: b.roomId,
      version: b.version,
      nights: [{ date: '2026-10-16', roomId: 'rm-204' }],
      rateChoice: 'update',
    });
    const detail = await c.reservations.getDetail('rs-8');
    expect(detail.rooms.map((r) => r.id)).toEqual(before);
    expect(detail.rooms[0]).toMatchObject({ id: 'rr-10', roomNumber: '204' });
  });

  it('early check in stays on the first part and late check out on the last', async () => {
    const c = mk();
    // rs-2 is seeded with early check in.
    const result = await c.reservations.changeRoomDuringStay(
      await request(c, DANIEL, { '2026-10-17': 'rm-205' }),
    );
    expect(result.blocks.map((b) => b.earlyCheckIn)).toEqual([true, undefined]);
    const saved = await c.reservations.getDetail('rs-2');
    await c.reservations.setEarlyLate({
      requestId: 'late-after-change-1',
      reservationId: 'rs-2',
      version: saved.version,
      lateCheckOut: true,
    });
    const grid = await stayBlocks(c, 'rs-2');
    expect(grid.map((b) => b.earlyCheckIn)).toEqual([true, undefined]);
    expect(grid.map((b) => b.lateCheckOut)).toEqual([undefined, true]);
  });

  describe('refusals apply nothing', () => {
    it('409 stale: version or room out of date', async () => {
      const c = mk();
      const base = await request(c, VICTOR, { '2026-10-19': 'rm-107' });
      const before = await stayBlocks(c, 'rs-11');
      for (const over of [{ version: 'v99' }, { fromRoomId: 'rm-302' }]) {
        await expect(
          c.reservations.changeRoomDuringStay({
            ...base,
            ...over,
            requestId: `stale-${++serial}-test`,
          }),
        ).rejects.toMatchObject({ status: 409, code: 'stale' });
      }
      expect(await stayBlocks(c, 'rs-11')).toEqual(before);
    });

    it('409 not-movable: only a checked-in room can change during the stay', async () => {
      const c = mk();
      for (const id of ['rr-5', 'rr-1', 'rr-3']) {
        await expect(
          c.reservations.changeRoomDuringStay(
            await request(
              c,
              { id, room: 'rm-209', nights: ['2026-10-20'] },
              { '2026-10-20': 'rm-110' },
              { rateChoice: null },
            ),
          ),
        ).rejects.toMatchObject({ status: 409, code: 'not-movable' });
      }
    });

    it('409 conflict: a changed night in a room that is booked or closed that night', async () => {
      const c = mk();
      // rm-302 is booked 10/17 to 10/19, rm-208 is closed 10/17 to 10/20.
      for (const [date, roomId] of [
        ['2026-10-17', 'rm-302'],
        ['2026-10-18', 'rm-302'],
        ['2026-10-17', 'rm-208'],
      ]) {
        await expect(
          c.reservations.changeRoomDuringStay(await request(c, VICTOR, { [date]: roomId })),
        ).rejects.toMatchObject({ status: 409, code: 'conflict', details: { roomId: [roomId] } });
      }
    });

    it('the same room is free on the nights around its booking (same-day turnover, half-open nights)', async () => {
      const c = mk();
      // rm-302: free on 10/16 (booked from 10/17) and on 10/19 (booked until 10/19).
      for (const date of ['2026-10-16', '2026-10-19']) {
        const result = await c.reservations.changeRoomDuringStay(
          await request(c, VICTOR, { [date]: 'rm-302' }, { rateChoice: 'retain' }),
        );
        expect(result.blocks.some((b) => b.roomId === 'rm-302')).toBe(true);
      }
    });

    it('a night keeps its own room even if the room is otherwise booked (only changed nights are checked)', async () => {
      const c = mk();
      const result = await c.reservations.changeRoomDuringStay(
        await request(c, VICTOR, { '2026-10-19': 'rm-107' }),
      );
      expect(result.blocks.length).toBe(2);
    });

    it('400: malformed requests', async () => {
      const c = mk();
      const base = await request(c, VICTOR, { '2026-10-19': 'rm-107' });
      for (const bad of [
        { ...base, requestId: 'x' },
        { ...base, version: '' },
        { ...base, nights: [] },
        { ...base, nights: [{ date: '2026-02-30', roomId: 'rm-107' }] },
        { ...base, nights: [base.nights[0], base.nights[2]] },
        { ...base, nights: [{ date: base.nights[0].date, roomId: '' }] },
        { ...base, rateChoice: 'both' as never },
        { ...base, rateChoice: undefined as never },
      ]) {
        await expect(c.reservations.changeRoomDuringStay(bad)).rejects.toMatchObject({
          status: 400,
        });
      }
    });

    it('404: unknown reservation room, or a room that does not exist', async () => {
      const c = mk();
      const base = await request(c, VICTOR, { '2026-10-19': 'rm-107' });
      await expect(
        c.reservations.changeRoomDuringStay({ ...base, reservationRoomId: 'rr-nope' }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        c.reservations.changeRoomDuringStay({
          ...base,
          nights: [...base.nights.slice(0, 3), { date: '2026-10-19', roomId: 'rm-nope' }],
        }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('idempotency', () => {
    it('the same request replays the first answer without applying again', async () => {
      const c = mk();
      const req = await request(c, VICTOR, { '2026-10-19': 'rm-107' });
      const first = await c.reservations.changeRoomDuringStay(req);
      const again = await c.reservations.changeRoomDuringStay(req);
      expect(again).toEqual(first);
      expect(await stayBlocks(c, 'rs-11')).toHaveLength(2);
    });

    it('the same id with another body is 409 idempotency-conflict', async () => {
      const c = mk();
      const req = await request(c, VICTOR, { '2026-10-19': 'rm-107' });
      await c.reservations.changeRoomDuringStay(req);
      await expect(
        c.reservations.changeRoomDuringStay({
          ...req,
          nights: req.nights.map((n) => ({ ...n, roomId: 'rm-110' })),
        }),
      ).rejects.toMatchObject({ status: 409, code: 'idempotency-conflict' });
    });

    it('a second change made from the old version is stale', async () => {
      const c = mk();
      const req = await request(c, VICTOR, { '2026-10-19': 'rm-107' });
      await c.reservations.changeRoomDuringStay(req);
      await expect(
        c.reservations.changeRoomDuringStay({
          ...req,
          requestId: 'another-request-1',
          nights: req.nights.map((n) => ({ ...n, roomId: 'rm-110' })),
        }),
      ).rejects.toMatchObject({ status: 409, code: 'stale' });
    });
  });

  describe('a stay with several parts', () => {
    it('cannot be dragged: moves of any of its parts are not movable', async () => {
      const c = mk();
      await c.reservations.changeRoomDuringStay(
        await request(c, VICTOR, { '2026-10-19': 'rm-107' }),
      );
      for (const b of await stayBlocks(c, 'rs-11')) {
        await expect(
          c.schedule.moveRoom({
            requestId: `drag-${++serial}-test`,
            reservationRoomId: b.id,
            toRoomId: 'rm-110',
            fromRoomId: b.roomId,
            version: b.version,
          }),
        ).rejects.toMatchObject({ status: 409, code: 'not-movable' });
      }
    });

    it('a later change counts from today: nights stayed meanwhile become stayed parts', async () => {
      // Two days later the first remaining nights have been stayed: the plan covers only what is left.
      const c = mk({ today: '2026-10-18' });
      const win = { startDate: '2026-10-08', days: 30 } as const;
      const b = (await c.schedule.get(win)).blocks.find((x) => x.id === 'rr-14')!; // 10/17 to 10/22 here
      expect(b.status).toBe('checked-in');
      const nights = Array.from({ length: 4 }, (_, i) => addDays('2026-10-18', i));
      await c.reservations.changeRoomDuringStay({
        requestId: 'later-change-1',
        reservationRoomId: 'rr-14',
        fromRoomId: b.roomId,
        version: b.version,
        nights: nights.map((date, i) => ({ date, roomId: i === 3 ? 'rm-107' : 'rm-301' })),
        rateChoice: 'update',
      });
      const blocks = (await c.schedule.get(win)).blocks
        .filter((x) => x.reservationId === 'rs-11')
        .sort((p, q) => p.startDate.localeCompare(q.startDate));
      expect(shape(blocks)).toEqual(['current rm-301 10-17 10-21', 'next rm-107 10-21 10-22']);
    });
  });

  it('never leaves two stays overlapping in a room', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(
      await request(c, VICTOR, { '2026-10-17': 'rm-107', '2026-10-19': 'rm-108' }),
    );
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

  it('403 without reservation.edit, nothing applied', async () => {
    const c = mk({ grant: { role: 'Viewer', permissions: [] } });
    const req = await request(mk(), VICTOR, { '2026-10-19': 'rm-107' });
    await expect(c.reservations.changeRoomDuringStay(req)).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
    });
    expect(shape(await stayBlocks(c, 'rs-11'))).toEqual([' rm-301 10-15 10-20']);
  });

  it('error scenario rejects; empty scenario answers 404', async () => {
    const req = await request(mk(), VICTOR, { '2026-10-19': 'rm-107' });
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

async function realAnswer(rooms: Record<string, string> = { '2026-10-18': 'rm-107' }) {
  const c = mk();
  const req = await request(c, VICTOR, rooms);
  return { req, answer: await c.reservations.changeRoomDuringStay(req) };
}

describe('http reservations.changeRoomDuringStay', () => {
  it('posts the request with its idempotency key and accepts a matching answer', async () => {
    const { req, answer } = await realAnswer();
    const fetchMock = vi.fn().mockResolvedValue(json(answer));
    const result = await http(fetchMock).reservations.changeRoomDuringStay(req);
    expect(result.blocks).toHaveLength(3);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v1/reservation-rooms/rr-14/change-room');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(req.requestId);
    expect(JSON.parse(init.body as string)).toEqual(req);
  });

  it('accepts a merge-back answer (fewer parts, removed blocks)', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(await request(c, VICTOR, { '2026-10-19': 'rm-107' }));
    const req = await request(c, VICTOR, {});
    const answer = await c.reservations.changeRoomDuringStay(req);
    const got = await http(
      vi.fn().mockResolvedValue(json(answer)),
    ).reservations.changeRoomDuringStay(req);
    expect(got.removedBlockIds).toHaveLength(1);
  });

  it('rejects a malformed request before fetching', async () => {
    const { req } = await realAnswer();
    const fetchMock = vi.fn();
    await expect(
      http(fetchMock).reservations.changeRoomDuringStay({ ...req, nights: [] }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an answer whose segments are not the normalized plan', async () => {
    // Plan: 10/18 in rm-107. Answer: current rm-301 10/15-10/18, next rm-107 10/18-10/19, next rm-301 10/19-10/20.
    const { req, answer } = await realAnswer();
    type Answer = typeof answer;
    const edit = (f: (a: Answer) => void) => {
      const a = structuredClone(answer);
      f(a);
      return a;
    };
    const find = (a: Answer, id: string) => a.blocks.find((b) => b.id === id)!;
    const next = (a: Answer) => a.blocks.filter((b) => b.roomChange?.part === 'next');
    const bad: unknown[] = [
      {},
      edit((a) => (a.blocks = [])),
      // a run in another room than planned, or other dates
      edit((a) => (next(a)[0].roomId = 'rm-108')),
      edit((a) => (next(a)[0].startDate = '2026-10-17')),
      edit((a) => (next(a)[1].endDate = '2026-10-21')),
      // a run missing, or two runs that should have been merged
      edit((a) => (a.blocks = a.blocks.filter((b) => b.id !== next(a)[1].id))),
      edit((a) => (next(a)[1].roomId = next(a)[0].roomId)),
      // the first block starts after the plan does, or the request's block is not the first run
      edit((a) => (find(a, 'rr-14').startDate = '2026-10-17')),
      edit((a) => (find(a, 'rr-14').roomChange!.part = 'next')),
      edit((a) => (find(a, 'rr-14').status = 'nyci')),
      // a stayed part in the same room as the current one (it should have been merged)
      edit((a) => {
        const cur = find(a, 'rr-14');
        a.blocks.unshift({
          ...cur,
          id: 'rr-14~9',
          startDate: '2026-10-15',
          endDate: '2026-10-16',
          status: 'checked-out',
          roomChange: { part: 'previous', index: 1, count: 4, stayId: 'rr-14' },
        });
        cur.startDate = '2026-10-16';
        a.blocks.forEach((b, i) => (b.roomChange = { ...b.roomChange!, index: i + 1, count: 4 }));
      }),
      // numbering, stay link and foreign blocks
      edit((a) => (a.blocks[1].roomChange!.index = 9)),
      edit((a) => (a.blocks[1].roomChange!.count = 9)),
      edit((a) => (a.blocks[1].roomChange!.stayId = 'rr-1')),
      edit((a) => delete a.blocks[1].roomChange),
      edit((a) => a.blocks.push({ ...a.blocks[0], id: 'rr-9', reservationId: 'rs-9' })),
      edit((a) => (a.blocks[1].id = a.blocks[0].id)),
      edit((a) => (a.removedBlockIds = ['rr-14'])),
      edit((a) => ((a as { removedBlockIds: unknown }).removedBlockIds = 'x')),
      // vacated room
      edit((a) => (a.vacatedRoom = { roomId: 'rm-301', housekeeping: 'dirty', since: T })),
      // money is integer cents
      edit((a) => (a.folio.deltaCents = 12.5)),
      edit((a) => (a.folio.repricedNights = -1)),
      edit((a) => ((a as { folio: unknown }).folio = undefined)),
      edit(
        (a) =>
          ((a.blocks[0] as { roomChange: unknown }).roomChange = {
            part: 'sideways',
            index: 1,
            count: 3,
            stayId: 'rr-14',
          }),
      ),
    ];
    for (const body of bad) {
      await expect(
        http(vi.fn().mockResolvedValue(json(body))).reservations.changeRoomDuringStay(req),
      ).rejects.toMatchObject({ status: 200, code: 'invalid-response' });
    }
  });

  it('a single block without a link is the right answer when every night is in one room; one WITH a link is not', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(await request(c, VICTOR, { '2026-10-19': 'rm-107' }));
    const req = await request(c, VICTOR, {});
    const answer = await c.reservations.changeRoomDuringStay(req);
    expect(answer.blocks).toHaveLength(1);
    const bad = structuredClone(answer);
    bad.blocks[0].roomChange = { part: 'current', index: 1, count: 1, stayId: 'rr-14' };
    await expect(
      http(vi.fn().mockResolvedValue(json(bad))).reservations.changeRoomDuringStay(req),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('a vacated room must be the old room of the first night and dated like it', async () => {
    const all = Object.fromEntries(VICTOR.nights.map((d) => [d, 'rm-110']));
    const { req, answer } = await realAnswer(all);
    expect(answer.vacatedRoom).not.toBeNull();
    await http(vi.fn().mockResolvedValue(json(answer))).reservations.changeRoomDuringStay({
      ...req,
      rateChoice: req.rateChoice,
    });
    for (const vacatedRoom of [
      { ...answer.vacatedRoom!, roomId: 'rm-110' },
      { ...answer.vacatedRoom!, since: '2026-10-17' },
      { ...answer.vacatedRoom!, housekeeping: 'spotless' },
    ]) {
      await expect(
        http(
          vi.fn().mockResolvedValue(json({ ...answer, vacatedRoom })),
        ).reservations.changeRoomDuringStay(req),
      ).rejects.toMatchObject({ code: 'invalid-response' });
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
    await c.reservations.changeRoomDuringStay(
      await request(c, VICTOR, Object.fromEntries(VICTOR.nights.map((d) => [d, 'rm-110'])), {
        rateChoice: null,
      }),
    );
    const data = await c.schedule.get(window);
    expect(
      (await http(vi.fn().mockResolvedValue(json(data))).schedule.get(window)).blocks.some(
        (b) => b.roomChange,
      ),
    ).toBe(true);
    const badRoom = { ...data, rooms: data.rooms.map((r) => ({ ...r, housekeeping: 'haunted' })) };
    await expect(
      http(vi.fn().mockResolvedValue(json(badRoom))).schedule.get(window),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    const badLink = {
      ...data,
      blocks: data.blocks.map((b) =>
        b.roomChange ? { ...b, roomChange: { ...b.roomChange, index: 0 } } : b,
      ),
    };
    await expect(
      http(vi.fn().mockResolvedValue(json(badLink))).schedule.get(window),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('the detail guard accepts earlier and later stays and rejects bad ones', async () => {
    const c = mk();
    await c.reservations.changeRoomDuringStay(
      await request(c, VICTOR, { '2026-10-16': 'rm-110', '2026-10-19': 'rm-107' }),
    );
    const detail = await c.reservations.getDetail('rs-11');
    const got = await http(vi.fn().mockResolvedValue(json(detail))).reservations.getDetail('rs-11');
    expect(got.rooms[0].previousStays).toHaveLength(1);
    expect(got.rooms[0].upcomingStays).toHaveLength(2);
    const noRoom = structuredClone(detail);
    delete (noRoom.stay.lines[0] as { reservationRoomId?: string }).reservationRoomId;
    await expect(
      http(vi.fn().mockResolvedValue(json(noRoom))).reservations.getDetail('rs-11'),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    for (const key of ['previousStays', 'upcomingStays']) {
      const bad = structuredClone(detail);
      (bad.rooms[0] as unknown as Record<string, unknown>)[key] = [{ roomId: 1 }];
      await expect(
        http(vi.fn().mockResolvedValue(json(bad))).reservations.getDetail('rs-11'),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
  });
});
