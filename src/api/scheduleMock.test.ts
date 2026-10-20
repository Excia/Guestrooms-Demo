import { createMockClient } from './mock';
import { createScheduleState } from './scheduleData';
import { queryScheduleData } from './scheduleQuery';
import type { ScheduleQuery } from './types';
import { nightsOverlap } from '../lib/dates';

const T = '2026-10-16';
const mk = (o = {}) => createMockClient({ today: T, ...o });
const week: ScheduleQuery = { startDate: T, days: 7 };

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
  it('applies filters like the backend would', async () => {
    const d = await mk().schedule.get({
      ...week,
      locationIds: ['lakeside'],
      availability: 'booked',
    });
    expect(d.rooms.every((r) => r.locationId === 'lakeside')).toBe(true);
    expect(d.rooms.length).toBeGreaterThan(0);
    expect(d.locations).toHaveLength(3);
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
      { startDate: T, days: 7, locationIds: [] },
      { startDate: T, days: 7, locationIds: ['a,b'] },
      { startDate: T, days: 7, roomTypeIds: [''] },
      { startDate: T, days: 7, availability: 'some' },
    ];
    for (const q of bad) {
      await expect(c.schedule.get(q as ScheduleQuery)).rejects.toMatchObject({
        status: 400,
        code: 'invalid-query',
      });
    }
  });
  it('honors scenarios and abort', async () => {
    const empty = await mk({ scenario: 'empty' }).schedule.get(week);
    expect(empty).toMatchObject({ rooms: [], blocks: [], closures: [], locations: [] });
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
    expect(viaClient).toEqual(d);
  });
  it('queries quickly', () => {
    const s = createScheduleState(T, 'large');
    const t0 = performance.now();
    for (let i = 0; i < 20; i++)
      queryScheduleData(s, { startDate: T, days: 30, availability: 'booked' });
    expect((performance.now() - t0) / 20).toBeLessThan(50);
  });
});

describe('mock schedule.moveRoom', () => {
  it('moves a room and the change is visible on the next get', async () => {
    const c = mk();
    const res = await c.schedule.moveRoom({ reservationRoomId: 'rr-3', toRoomId: 'rm-203' });
    expect(res.blocks).toHaveLength(1);
    expect(res.blocks[0].roomId).toBe('rm-203');
    const d = await c.schedule.get({ startDate: T, days: 7 });
    expect(d.blocks.find((b) => b.id === 'rr-3')?.roomId).toBe('rm-203');
  });
  it('409 conflict names the room and applies nothing', async () => {
    const c = mk();
    await expect(
      c.schedule.moveRoom({ reservationRoomId: 'rr-3', toRoomId: 'rm-202' }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'conflict',
      details: { roomId: ['rm-202'] },
    });
    await expect(
      c.schedule.moveRoom({ reservationRoomId: 'rr-12', toRoomId: 'rm-C7' }),
    ).rejects.toMatchObject({ code: 'not-movable' });
    const d = await c.schedule.get(week);
    expect(d.blocks.find((b) => b.id === 'rr-3')?.roomId).toBe('rm-201');
  });
  it('409 on a closure, a checked-out room, and a locked room type', async () => {
    const c = mk();
    await expect(
      c.schedule.moveRoom({ reservationRoomId: 'rr-3', toRoomId: 'rm-208' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      c.schedule.moveRoom({ reservationRoomId: 'rr-1', toRoomId: 'rm-203' }),
    ).rejects.toMatchObject({ status: 409, code: 'not-movable' });
    await expect(
      c.schedule.moveRoom({ reservationRoomId: 'rr-12', toRoomId: 'rm-203' }),
    ).rejects.toMatchObject({ code: 'not-movable' });
    // Within its room type a locked reservation can move.
    await expect(
      c.schedule.moveRoom({ reservationRoomId: 'rr-12', toRoomId: 'rm-208' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
  it('404s for unknown ids and 400s for unusable ones', async () => {
    const c = mk();
    await expect(
      c.schedule.moveRoom({ reservationRoomId: 'nope', toRoomId: 'rm-203' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      c.schedule.moveRoom({ reservationRoomId: 'rr-3', toRoomId: 'nope' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      c.schedule.moveRoom({ reservationRoomId: '..', toRoomId: 'rm-203' }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-id' });
    await expect(
      mk({ scenario: 'empty' }).schedule.moveRoom({
        reservationRoomId: 'rr-3',
        toRoomId: 'rm-203',
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      mk({ scenario: 'error' }).schedule.moveRoom({
        reservationRoomId: 'rr-3',
        toRoomId: 'rm-203',
      }),
    ).rejects.toMatchObject({ status: 500 });
  });
  it('does not apply a move that was aborted', async () => {
    const c = mk({ latencyMs: 10 });
    const controller = new AbortController();
    const p = c.schedule.moveRoom(
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
    const res = await c.schedule.moveDates({
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
    const res = await c.schedule.moveDates({
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
      c.schedule.moveDates({
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
      c.schedule.moveDates({
        reservationRoomId: 'rr-9',
        toStartDate: '2026-10-17',
        scope: 'this-room',
        toRoomId: 'rm-208',
      }),
    ).rejects.toMatchObject({ code: 'conflict', details: { roomId: ['rm-208'] } });
  });
  it('changes the room together with the dates', async () => {
    const res = await mk().schedule.moveDates({
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
      c.schedule.moveDates({
        reservationRoomId: 'rr-3',
        toStartDate: '2026-10-10',
        scope: 'all-rooms',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'not-movable' });
    await expect(
      c.schedule.moveDates({
        reservationRoomId: 'rr-2',
        toStartDate: '2026-10-30',
        scope: 'all-rooms',
      }),
    ).rejects.toMatchObject({ code: 'not-movable' });
    await expect(
      c.schedule.moveDates({
        reservationRoomId: 'rr-1',
        toStartDate: '2026-10-30',
        scope: 'all-rooms',
      }),
    ).rejects.toMatchObject({ code: 'not-movable' });
    await expect(
      c.schedule.moveDates({
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
      c.schedule.moveDates({
        reservationRoomId: 'rr-3',
        toStartDate: '2026-10-18',
        scope: 'all-rooms',
      }),
    ).resolves.toBeDefined();
    await expect(
      c.schedule.moveDates({
        reservationRoomId: 'rr-3',
        toStartDate: '2026-10-17',
        scope: 'all-rooms',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
  it('rejects malformed requests with 400', async () => {
    const c = mk();
    await expect(
      c.schedule.moveDates({ reservationRoomId: 'rr-3', toStartDate: 'x', scope: 'all-rooms' }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
    await expect(
      c.schedule.moveDates({
        reservationRoomId: 'rr-3',
        toStartDate: '2026-10-30',
        scope: 'both' as never,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      c.schedule.moveDates({
        reservationRoomId: '',
        toStartDate: '2026-10-30',
        scope: 'all-rooms',
      }),
    ).rejects.toMatchObject({ code: 'invalid-id' });
  });
});
