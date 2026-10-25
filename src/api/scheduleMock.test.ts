import { createMockClient } from './mock';
import { createScheduleState } from './scheduleData';
import { queryScheduleData } from './scheduleQuery';
import type { ApiClient, MoveDatesRequest, MoveRoomRequest, ScheduleQuery } from './types';
import { nightsOverlap } from '../lib/dates';

const T = '2026-10-16';
const mk = (o = {}) => createMockClient({ today: T, ...o });
const week: ScheduleQuery = { startDate: T, days: 7 };

// A move request made from the block's current state, as the UI would build it.
let serial = 0;
async function guard(c: ApiClient, id: string) {
  const d = await c.schedule.get({ startDate: '2026-10-06', days: 30 }).catch(() => null);
  const b = d?.blocks.find((x) => x.id === id);
  return {
    requestId: `req-${++serial}-test`,
    version: b?.version ?? 'v1',
    fromRoomId: b?.roomId ?? 'rm-201',
    fromStartDate: b?.startDate ?? T,
  };
}
type Rest<R> = Omit<R, 'requestId' | 'version' | 'fromRoomId' | 'fromStartDate'> &
  Partial<Pick<R, Extract<keyof R, 'requestId' | 'version' | 'fromRoomId'>>> & {
    fromStartDate?: string;
  };
async function room(c: ApiClient, r: Rest<MoveRoomRequest>, o?: { signal?: AbortSignal }) {
  const { fromStartDate: _unused, ...g } = await guard(c, r.reservationRoomId);
  void _unused;
  return c.schedule.moveRoom({ ...g, ...r } as MoveRoomRequest, o);
}
async function dates(c: ApiClient, r: Rest<MoveDatesRequest>, o?: { signal?: AbortSignal }) {
  const g = await guard(c, r.reservationRoomId);
  return c.schedule.moveDates({ ...g, ...r } as MoveDatesRequest, o);
}

describe('mock schedule.get', () => {
  it('returns a realistic default inventory', async () => {
    const d = await mk().schedule.get({ startDate: '2026-10-09', days: 30 });
    expect(d.rooms.length).toBeGreaterThanOrEqual(20);
    expect(d.rooms.length).toBeLessThanOrEqual(40);
    expect(d.locations.map((l) => l.name)).toContain('Main Clubhouse');
    expect(new Set(d.blocks.map((b) => b.status))).toEqual(
      new Set(['confirmed', 'nyci', 'checked-in', 'checked-out']),
    );
    expect(d.blocks.some((b) => b.roomCount > 1)).toBe(true);
    expect(d.blocks.some((b) => b.roomTypeLocked)).toBe(true);
    expect(d.closures.some((c) => c.reason === 'Reserved: Fixed Loss' && c.endMarker)).toBe(true);
  });
  it('only returns blocks that overlap the range, in listed rooms', async () => {
    const d = await mk().schedule.get({ startDate: '2026-10-20', days: 7 });
    const rooms = new Set(d.rooms.map((r) => r.id));
    for (const b of [...d.blocks, ...d.closures]) {
      expect(rooms.has(b.roomId)).toBe(true);
      expect(nightsOverlap(b.startDate, b.endDate, '2026-10-20', '2026-10-27')).toBe(true);
    }
  });
  it('has no overlapping stays or closures in any room (default and large)', () => {
    for (const size of ['default', 'large'] as const) {
      const s = createScheduleState(T, size);
      const items = [...s.blocks, ...s.closures];
      const byRoom = new Map<string, typeof items>();
      for (const i of items) byRoom.set(i.roomId, [...(byRoom.get(i.roomId) ?? []), i]);
      for (const list of byRoom.values()) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            expect(
              nightsOverlap(list[i].startDate, list[i].endDate, list[j].startDate, list[j].endDate),
            ).toBe(false);
          }
        }
      }
      expect(items.every((i) => i.startDate < i.endDate)).toBe(true);
    }
  });
  it('keeps multi-room reservations whole', () => {
    const s = createScheduleState(T);
    for (const b of s.blocks.filter((x) => x.roomCount > 1)) {
      expect(s.blocks.filter((x) => x.reservationId === b.reservationId)).toHaveLength(b.roomCount);
    }
  });
  it('answers 7, 14 and 30 day views', async () => {
    const c = mk();
    const counts = [];
    for (const days of [7, 14, 30] as const) {
      const d = await c.schedule.get({ startDate: T, days });
      expect(d.days).toBe(days);
      counts.push(d.blocks.length);
    }
    expect(counts[1]).toBeGreaterThanOrEqual(counts[0]);
    expect(counts[2]).toBeGreaterThanOrEqual(counts[1]);
  });
  it('returns fresh copies', async () => {
    const c = mk();
    const a = await c.schedule.get(week);
    a.rooms.length = 0;
    expect((await c.schedule.get(week)).rooms.length).toBeGreaterThan(0);
  });
  it('rejects malformed queries with a 400', async () => {
    const c = mk();
    const bad: unknown[] = [
      { startDate: 'tomorrow', days: 7 },
      { startDate: T, days: 10 },
    ];
    for (const q of bad) {
      await expect(c.schedule.get(q as ScheduleQuery)).rejects.toMatchObject({
        status: 400,
        code: 'invalid-query',
      });
    }
  });
  it('windows the seeded unassigned reservations by date', async () => {
    const c = mk();
    const first = await c.schedule.get(week);
    expect(first.unassigned.map((b) => b.id)).toEqual(['rr-u1', 'rr-u2']);
    expect(first.unassigned.every((b) => b.roomId === '')).toBe(true);
    const wide = await c.schedule.get({ ...week, days: 14 });
    expect(wide.unassigned).toHaveLength(3);
    const later = await c.schedule.get({ ...week, startDate: '2026-12-01' });
    expect(later.unassigned).toEqual([]);
  });
  it('honors scenarios and abort', async () => {
    const empty = await mk({ scenario: 'empty' }).schedule.get(week);
    expect(empty).toMatchObject({
      rooms: [],
      blocks: [],
      closures: [],
      unassigned: [],
      locations: [],
    });
    await expect(mk({ scenario: 'error' }).schedule.get(week)).rejects.toMatchObject({
      status: 500,
    });
    const settled = vi.fn();
    mk({ scenario: 'loading' }).schedule.get(week).then(settled, settled);
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).not.toHaveBeenCalled();
    const controller = new AbortController();
    const p = mk({ latencyMs: 1000 }).schedule.get(week, { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('large inventory', () => {
  it('generates 200 rooms x 30 days deterministically', async () => {
    const a = createScheduleState(T, 'large');
    const b = createScheduleState(T, 'large');
    expect(a).toEqual(b);
    expect(a.rooms).toHaveLength(200);
    const d = queryScheduleData(a, { startDate: T, days: 30 });
    expect(d.rooms).toHaveLength(200);
    expect(d.blocks.length).toBeGreaterThan(1000);
    expect(new Set(d.blocks.map((x) => x.id)).size).toBe(d.blocks.length);
    const viaClient = await mk({ scheduleSize: 'large' }).schedule.get({ startDate: T, days: 30 });
    // The client adds the slot holds (ticket 152); the rest is the same windowed data.
    const { holds, ...rest } = viaClient;
    expect(holds).toBeInstanceOf(Array);
    expect(rest).toEqual(d);
  });
  it('queries quickly', () => {
    const s = createScheduleState(T, 'large');
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) queryScheduleData(s, { startDate: T, days: 30 });
    expect((performance.now() - t0) / 20).toBeLessThan(50);
  });
});

describe('mock schedule.moveRoom', () => {
  it('moves a room and the change is visible on the next get', async () => {
    const c = mk();
    const res = await room(c, { reservationRoomId: 'rr-3', toRoomId: 'rm-203' });
    expect(res.blocks).toHaveLength(1);
    expect(res.blocks[0].roomId).toBe('rm-203');
    const d = await c.schedule.get({ startDate: T, days: 7 });
    expect(d.blocks.find((b) => b.id === 'rr-3')?.roomId).toBe('rm-203');
  });
  it('409 conflict names the room and applies nothing', async () => {
    const c = mk();
    await expect(room(c, { reservationRoomId: 'rr-3', toRoomId: 'rm-202' })).rejects.toMatchObject({
      status: 409,
      code: 'conflict',
      details: { roomId: ['rm-202'] },
    });
    await expect(room(c, { reservationRoomId: 'rr-12', toRoomId: 'rm-C7' })).rejects.toMatchObject({
      code: 'not-movable',
    });
    const d = await c.schedule.get(week);
    expect(d.blocks.find((b) => b.id === 'rr-3')?.roomId).toBe('rm-201');
  });
  it('409 on a closure, a checked-out room, and a locked room type', async () => {
    const c = mk();
    await expect(room(c, { reservationRoomId: 'rr-3', toRoomId: 'rm-208' })).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(room(c, { reservationRoomId: 'rr-1', toRoomId: 'rm-203' })).rejects.toMatchObject({
      status: 409,
      code: 'not-movable',
    });
    await expect(room(c, { reservationRoomId: 'rr-12', toRoomId: 'rm-203' })).rejects.toMatchObject(
      { code: 'not-movable' },
    );
    // Within its room type a locked reservation can move.
    await expect(room(c, { reservationRoomId: 'rr-12', toRoomId: 'rm-208' })).rejects.toMatchObject(
      { code: 'conflict' },
    );
  });
  it('404s for unknown ids and 400s for unusable ones', async () => {
    const c = mk();
    await expect(room(c, { reservationRoomId: 'nope', toRoomId: 'rm-203' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(room(c, { reservationRoomId: 'rr-3', toRoomId: 'nope' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(room(c, { reservationRoomId: '..', toRoomId: 'rm-203' })).rejects.toMatchObject({
      status: 400,
      code: 'invalid-id',
    });
    await expect(
      room(mk({ scenario: 'empty' }), {
        reservationRoomId: 'rr-3',
        toRoomId: 'rm-203',
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      room(mk({ scenario: 'error' }), {
        reservationRoomId: 'rr-3',
        toRoomId: 'rm-203',
      }),
    ).rejects.toMatchObject({ status: 500 });
  });
  it('does not apply a move that was aborted', async () => {
    const c = mk({ latencyMs: 10 });
    const controller = new AbortController();
    const p = room(
      c,
      { reservationRoomId: 'rr-3', toRoomId: 'rm-203' },
      { signal: controller.signal },
    );
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    const d = await c.schedule.get(week);
    expect(d.blocks.find((b) => b.id === 'rr-3')?.roomId).toBe('rm-201');
  });
});

describe('mock schedule.moveDates', () => {
  it('moves every room of a multi-room reservation (all-rooms)', async () => {
    const c = mk();
    const res = await dates(c, {
      reservationRoomId: 'rr-7',
      toStartDate: '2026-10-25',
      scope: 'all-rooms',
    });
    expect(res.blocks.map((b) => b.id).sort()).toEqual(['rr-7', 'rr-8', 'rr-9']);
    expect(
      res.blocks.every((b) => b.startDate === '2026-10-25' && b.endDate === '2026-10-28'),
    ).toBe(true);
  });
  it('splits one room off (this-room): other rooms keep their dates and count', async () => {
    const c = mk();
    const res = await dates(c, {
      reservationRoomId: 'rr-7',
      toStartDate: '2026-10-25',
      scope: 'this-room',
    });
    const byId = Object.fromEntries(res.blocks.map((b) => [b.id, b]));
    expect(byId['rr-7'].startDate).toBe('2026-10-25');
    expect(byId['rr-7'].roomCount).toBe(1);
    expect(byId['rr-7'].reservationId).not.toBe('rs-7');
    expect(byId['rr-8']).toMatchObject({
      startDate: '2026-10-18',
      roomCount: 2,
      reservationId: 'rs-7',
    });
  });
  it('is atomic: a conflict in any room applies nothing', async () => {
    const c = mk();
    // The trio shifts a day earlier and rr-9 also wants rm-302, where GR-50344 arrives that day.
    await expect(
      dates(c, {
        reservationRoomId: 'rr-9',
        toStartDate: '2026-10-17',
        scope: 'all-rooms',
        toRoomId: 'rm-302',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'conflict', details: { roomId: ['rm-302'] } });
    const d = await c.schedule.get({ startDate: '2026-10-16', days: 14 });
    for (const id of ['rr-7', 'rr-8', 'rr-9']) {
      expect(d.blocks.find((b) => b.id === id)?.startDate).toBe('2026-10-18');
    }
    expect(d.blocks.find((b) => b.id === 'rr-9')?.roomId).toBe('rm-205');
  });
  it('conflict lists every clashing room', async () => {
    const c = mk();
    await expect(
      dates(c, {
        reservationRoomId: 'rr-9',
        toStartDate: '2026-10-17',
        scope: 'this-room',
        toRoomId: 'rm-208',
      }),
    ).rejects.toMatchObject({ code: 'conflict', details: { roomId: ['rm-208'] } });
  });
  it('changes the room together with the dates', async () => {
    const res = await dates(mk(), {
      reservationRoomId: 'rr-3',
      toStartDate: '2026-10-30',
      scope: 'all-rooms',
      toRoomId: 'rm-203',
    });
    expect(res.blocks[0]).toMatchObject({
      roomId: 'rm-203',
      startDate: '2026-10-30',
      endDate: '2026-11-02',
    });
  });
  it('refuses the past, checked-in and checked-out rooms, and locked types', async () => {
    const c = mk();
    await expect(
      dates(c, {
        reservationRoomId: 'rr-3',
        toStartDate: '2026-10-10',
        scope: 'all-rooms',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'not-movable' });
    await expect(
      dates(c, {
        reservationRoomId: 'rr-2',
        toStartDate: '2026-10-30',
        scope: 'all-rooms',
      }),
    ).rejects.toMatchObject({ code: 'not-movable' });
    await expect(
      dates(c, {
        reservationRoomId: 'rr-1',
        toStartDate: '2026-10-30',
        scope: 'all-rooms',
      }),
    ).rejects.toMatchObject({ code: 'not-movable' });
    await expect(
      dates(c, {
        reservationRoomId: 'rr-12',
        toStartDate: '2026-10-30',
        scope: 'all-rooms',
        toRoomId: 'rm-203',
      }),
    ).rejects.toMatchObject({ code: 'not-movable' });
  });
  it('allows same-day turnover and ignores the stay itself', async () => {
    const c = mk();
    // rr-3 (rm-201, +2..+5) one night earlier: starts the day rr-2 departs (+2)... rr-2 ends +2, so +2 is fine; +1 would clash.
    await expect(
      dates(c, {
        reservationRoomId: 'rr-3',
        toStartDate: '2026-10-18',
        scope: 'all-rooms',
      }),
    ).resolves.toBeDefined();
    await expect(
      dates(c, {
        reservationRoomId: 'rr-3',
        toStartDate: '2026-10-17',
        scope: 'all-rooms',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
  it('rejects malformed requests with 400', async () => {
    const c = mk();
    await expect(
      dates(c, { reservationRoomId: 'rr-3', toStartDate: 'x', scope: 'all-rooms' }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
    await expect(
      dates(c, {
        reservationRoomId: 'rr-3',
        toStartDate: '2026-10-30',
        scope: 'both' as never,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      dates(c, {
        reservationRoomId: '',
        toStartDate: '2026-10-30',
        scope: 'all-rooms',
      }),
    ).rejects.toMatchObject({ code: 'invalid-id' });
  });
});

describe('mock move safety: versions, stale state and idempotency', () => {
  it('gives every block a version and bumps it when the block moves', async () => {
    const c = mk();
    const before = (await c.schedule.get(week)).blocks.find((b) => b.id === 'rr-3')!;
    expect(before.version).toBeTruthy();
    const res = await room(c, { reservationRoomId: 'rr-3', toRoomId: 'rm-203' });
    expect(res.blocks[0].version).not.toBe(before.version);
  });
  it('bumps siblings that change with an all-rooms move', async () => {
    const c = mk();
    const before = (await c.schedule.get(week)).blocks.filter((b) => b.reservationId === 'rs-7');
    const res = await dates(c, {
      reservationRoomId: 'rr-7',
      toStartDate: '2026-10-25',
      scope: 'all-rooms',
    });
    for (const b of res.blocks) {
      expect(b.version).not.toBe(before.find((x) => x.id === b.id)!.version);
    }
  });
  it('409 stale for an out-of-date version, room or arrival; nothing is applied', async () => {
    const c = mk();
    await room(c, { reservationRoomId: 'rr-3', toRoomId: 'rm-203' }); // the block moved on
    await expect(
      room(c, {
        reservationRoomId: 'rr-3',
        toRoomId: 'rm-205',
        version: 'v1',
        fromRoomId: 'rm-201',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    await expect(
      room(c, { reservationRoomId: 'rr-3', toRoomId: 'rm-205', fromRoomId: 'rm-201' }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    await expect(
      dates(c, {
        reservationRoomId: 'rr-3',
        toStartDate: '2026-10-30',
        scope: 'all-rooms',
        fromStartDate: '2026-10-01',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    const d = await c.schedule.get(week);
    expect(d.blocks.find((b) => b.id === 'rr-3')?.roomId).toBe('rm-203');
  });
  it('replays the stored result for a repeated requestId instead of applying twice', async () => {
    const c = mk();
    const g = await guard(c, 'rr-3');
    const request = {
      reservationRoomId: 'rr-3',
      toStartDate: '2026-10-30',
      scope: 'all-rooms' as const,
      ...g,
    };
    const first = await c.schedule.moveDates(request);
    const again = await c.schedule.moveDates(request); // would be stale / a second shift without the key
    expect(again).toEqual(first);
    const d = await c.schedule.get({ startDate: '2026-10-25', days: 14 });
    expect(d.blocks.find((b) => b.id === 'rr-3')).toMatchObject({ startDate: '2026-10-30' });
  });
  it('409 idempotency-conflict when a requestId is reused for another request', async () => {
    const c = mk();
    const g = await guard(c, 'rr-3');
    await c.schedule.moveRoom({ ...g, reservationRoomId: 'rr-3', toRoomId: 'rm-203' });
    await expect(
      c.schedule.moveRoom({ ...g, reservationRoomId: 'rr-3', toRoomId: 'rm-205' }),
    ).rejects.toMatchObject({ status: 409, code: 'idempotency-conflict' });
  });
  it('rejects a missing or malformed guard with 400', async () => {
    const c = mk();
    const g = await guard(c, 'rr-3');
    for (const bad of [{ requestId: 'x' }, { requestId: 'has spaces here' }, { version: '' }]) {
      await expect(
        c.schedule.moveRoom({ ...g, reservationRoomId: 'rr-3', toRoomId: 'rm-203', ...bad }),
      ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
    }
  });
});

describe('mock move fidelity', () => {
  it('moveDates without a date change is a room change: allowed for a checked-in room', async () => {
    const c = mk();
    const res = await dates(c, {
      reservationRoomId: 'rr-2', // checked in
      toStartDate: (await c.schedule.get({ startDate: '2026-10-10', days: 14 })).blocks.find(
        (b) => b.id === 'rr-2',
      )!.startDate,
      scope: 'all-rooms',
      toRoomId: 'rm-209',
    });
    expect(res.blocks[0].roomId).toBe('rm-209');
    // ...and checked-out ones are refused, like moveRoom.
    await expect(
      dates(c, {
        reservationRoomId: 'rr-1',
        toStartDate: '2026-10-10',
        scope: 'all-rooms',
        toRoomId: 'rm-203',
      }),
    ).rejects.toMatchObject({ code: 'not-movable' });
  });
  it('refuses a shift that puts any moving sibling in the past', async () => {
    const c = mk();
    // rr-7..9 arrive on +2 (10/18): shifting 3 days earlier is 10/15 for all of them.
    await expect(
      dates(c, { reservationRoomId: 'rr-7', toStartDate: '2026-10-15', scope: 'all-rooms' }),
    ).rejects.toMatchObject({ code: 'not-movable' });
  });
});

describe('mock schedule.setHousekeeping', () => {
  const hk = async (c: ApiClient, id: string) => {
    const g = await guard(c, id);
    return { reservationRoomId: id, requestId: g.requestId, version: g.version };
  };
  const find = async (c: ApiClient, id: string) =>
    (await c.schedule.get({ startDate: '2026-10-06', days: 30 })).blocks.find((b) => b.id === id)!;

  it('sets the status, keeps the note, and shows on the next get with a new version', async () => {
    const c = mk();
    const before = await find(c, 'rr-1');
    const res = await c.schedule.setHousekeeping({ ...(await hk(c, 'rr-1')), status: 'ready' });
    expect(res.blocks).toHaveLength(1);
    expect(res.blocks[0]).toMatchObject({ id: 'rr-1', housekeeping: 'ready' });
    expect(res.blocks[0].version).not.toBe(before.version);
    expect(await find(c, 'rr-1')).toMatchObject({ housekeeping: 'ready' });
  });
  it('saves a note, and an empty note removes it', async () => {
    const c = mk();
    const first = await c.schedule.setHousekeeping({
      ...(await hk(c, 'rr-1')),
      status: 'cleaned',
      notes: 'Mini bar restocked',
    });
    expect(first.blocks[0].housekeepingNotes).toBe('Mini bar restocked');
    const kept = await c.schedule.setHousekeeping({
      reservationRoomId: 'rr-1',
      requestId: 'req-keep-note-1',
      status: 'ready',
    });
    expect(kept.blocks[0].housekeepingNotes).toBe('Mini bar restocked');
    const removed = await c.schedule.setHousekeeping({
      reservationRoomId: 'rr-1',
      requestId: 'req-drop-note-1',
      status: 'ready',
      notes: '',
    });
    expect(removed.blocks[0].housekeepingNotes).toBeUndefined();
  });
  it('409 stale for another version, applying nothing', async () => {
    const c = mk();
    const before = await find(c, 'rr-1');
    await expect(
      c.schedule.setHousekeeping({
        reservationRoomId: 'rr-1',
        requestId: 'req-stale-hk-1',
        version: 'v-old',
        status: 'ready',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    expect((await find(c, 'rr-1')).housekeeping).toBe(before.housekeeping);
  });
  it('404 for an unknown reservation room', async () => {
    await expect(
      mk().schedule.setHousekeeping({
        reservationRoomId: 'rr-nope',
        requestId: 'req-nope-0001',
        status: 'ready',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('replays the same request once and rejects the same id with another body', async () => {
    const c = mk();
    const req = { ...(await hk(c, 'rr-1')), status: 'cleaned' as const };
    const one = await c.schedule.setHousekeeping(req);
    const two = await c.schedule.setHousekeeping(req);
    expect(two).toEqual(one);
    await expect(c.schedule.setHousekeeping({ ...req, status: 'ready' })).rejects.toMatchObject({
      status: 409,
      code: 'idempotency-conflict',
    });
  });
  it('rejects a status that cannot be set (nyci) with 400', async () => {
    await expect(
      mk().schedule.setHousekeeping({
        reservationRoomId: 'rr-1',
        requestId: 'req-nyci-0001',
        status: 'nyci' as never,
      }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
  });
  it("refuses a status that does not fit the stay's check-in status, applying nothing", async () => {
    const c = mk();
    // Not yet checked in (rr-3): nothing to set; checked in (rr-2): stays Not Checked Out;
    // checked out (rr-1): cannot go back to Not Checked Out.
    for (const [id, status] of [
      ['rr-3', 'cleaned'],
      ['rr-2', 'ready'],
      ['rr-1', 'not-checked-out'],
    ] as const) {
      const before = await find(c, id);
      await expect(
        c.schedule.setHousekeeping({ ...(await hk(c, id)), status }),
      ).rejects.toMatchObject({ status: 409, code: 'not-allowed' });
      expect(await find(c, id)).toEqual(before);
    }
  });
});
