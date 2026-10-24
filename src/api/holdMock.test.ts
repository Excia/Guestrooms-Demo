import { createMockClient } from './mock';
import type { ApiClient, ScheduleHold } from './types';

const T = '2026-10-16';
const NOW = new Date(2026, 9, 16, 9, 0, 0).getTime();
const q = { startDate: T, days: 14 } as const;
let clock = NOW;
const mk = (o = {}): ApiClient => createMockClient({ today: T, now: () => new Date(clock), ...o });
const ID = 'hold-aaaa-1111';
const slot = (roomId: string, startDate: string, endDate: string, holdId = ID) => ({
  holdId,
  roomId,
  startDate,
  endDate,
});

beforeEach(() => {
  clock = NOW;
});

/** A room with nothing booked, held or closed in the window. */
async function freeRoom(c: ApiClient, from: string, to: string): Promise<string> {
  const d = await c.schedule.get(q);
  const busy = (x: { roomId: string; startDate: string; endDate: string }) =>
    x.startDate < to && from < x.endDate;
  const room = d.rooms.find(
    (r) =>
      ![...d.blocks, ...d.closures, ...(d.holds ?? [])].some((x) => x.roomId === r.id && busy(x)),
  );
  return room!.id;
}

describe('mock schedule holds', () => {
  it("seeds another user's hold, shown in the schedule answer and not marked mine", async () => {
    const d = await mk().schedule.get(q);
    expect(d.holds).toHaveLength(1);
    expect(d.holds![0].mine).toBe(false);
    expect(Date.parse(d.holds![0].expiresAt)).toBeGreaterThan(NOW);
  });
  it('starts with no holds when asked to', async () => {
    expect((await mk({ holds: 'none' }).schedule.get(q)).holds).toEqual([]);
  });
  it('holds a slot for the Reservation Hold minutes of Booking Rules (employee)', async () => {
    const c = mk({ holds: 'none' });
    const room = await freeRoom(c, '2026-10-20', '2026-10-22');
    const hold = await c.schedule.holdSlot(slot(room, '2026-10-20', '2026-10-22'));
    const rules = await c.settings.getBookingHold();
    expect(hold).toMatchObject({ id: ID, roomId: room, mine: true });
    expect(Date.parse(hold.expiresAt)).toBe(NOW + rules.employee * 60_000);
    expect((await c.schedule.get(q)).holds).toEqual([hold]);
  });
  it('is idempotent on the hold id: the same slot answers the same hold, the expiry is not extended', async () => {
    const c = mk({ holds: 'none' });
    const room = await freeRoom(c, '2026-10-20', '2026-10-22');
    const first = await c.schedule.holdSlot(slot(room, '2026-10-20', '2026-10-22'));
    clock += 5 * 60_000;
    const again = await c.schedule.holdSlot(slot(room, '2026-10-20', '2026-10-22'));
    expect(again).toEqual(first);
    expect((await c.schedule.get(q)).holds).toHaveLength(1);
  });
  it('moves the hold to another slot and keeps its expiry', async () => {
    const c = mk({ holds: 'none' });
    const room = await freeRoom(c, '2026-10-20', '2026-10-24');
    const first = await c.schedule.holdSlot(slot(room, '2026-10-20', '2026-10-22'));
    clock += 60_000;
    const moved = await c.schedule.holdSlot(slot(room, '2026-10-22', '2026-10-24'));
    expect(moved).toMatchObject({ startDate: '2026-10-22', endDate: '2026-10-24' });
    expect(moved.expiresAt).toBe(first.expiresAt);
    expect((await c.schedule.get(q)).holds).toHaveLength(1);
  });
  it('expires by the clock: the hold leaves the schedule and the id starts a fresh hold', async () => {
    const c = mk({ holds: 'none' });
    const room = await freeRoom(c, '2026-10-20', '2026-10-22');
    const first = await c.schedule.holdSlot(slot(room, '2026-10-20', '2026-10-22'));
    clock = Date.parse(first.expiresAt);
    expect((await c.schedule.get(q)).holds).toEqual([]);
    const fresh = await c.schedule.holdSlot(slot(room, '2026-10-20', '2026-10-22'));
    expect(Date.parse(fresh.expiresAt)).toBeGreaterThan(Date.parse(first.expiresAt));
  });
  it('refuses a booked slot with 409 conflict', async () => {
    const c = mk({ holds: 'none' });
    const d = await c.schedule.get(q);
    const b = d.blocks.find((x) => x.endDate > T && x.roomId)!;
    await expect(c.schedule.holdSlot(slot(b.roomId, b.startDate, b.endDate))).rejects.toMatchObject(
      { status: 409, code: 'conflict' },
    );
    expect((await c.schedule.get(q)).holds).toEqual([]);
  });
  it('refuses a slot held by someone else with 409 held, also when it overlaps by one night', async () => {
    const c = mk();
    const other = (await c.schedule.get(q)).holds![0];
    await expect(
      c.schedule.holdSlot(slot(other.roomId, other.startDate, other.endDate)),
    ).rejects.toMatchObject({ status: 409, code: 'held', details: { roomId: [other.roomId] } });
    await expect(
      c.schedule.holdSlot(slot(other.roomId, other.endDate, '2026-12-30')),
    ).resolves.toMatchObject({ mine: true });
  });
  it('refuses an unknown room (404) and a malformed request (400)', async () => {
    const c = mk();
    await expect(
      c.schedule.holdSlot(slot('nope', '2026-10-20', '2026-10-22')),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      c.schedule.holdSlot(slot('rm-201', '2026-10-22', '2026-10-22')),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
    await expect(
      c.schedule.holdSlot(slot('rm-201', '2026-10-20', '2026-10-22', 'x')),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
  });
  it("releases a hold, idempotently, and never someone else's", async () => {
    const c = mk();
    const room = await freeRoom(c, '2026-10-24', '2026-10-26');
    await c.schedule.holdSlot(slot(room, '2026-10-24', '2026-10-26'));
    await c.schedule.releaseHold(ID);
    await c.schedule.releaseHold(ID);
    await c.schedule.releaseHold('unknown-hold-id');
    let holds = (await c.schedule.get(q)).holds!;
    expect(holds.map((h) => h.id)).toEqual(['hold-seed-1']);
    await c.schedule.releaseHold('hold-seed-1');
    holds = (await c.schedule.get(q)).holds!;
    expect(holds).toHaveLength(1);
  });
  it('only returns holds that touch the window', async () => {
    const c = mk({ holds: 'none' });
    const room = await freeRoom(c, '2026-12-01', '2026-12-03');
    await c.schedule.holdSlot(slot(room, '2026-12-01', '2026-12-03'));
    expect((await c.schedule.get(q)).holds).toEqual([]);
    expect(
      (await c.schedule.get({ startDate: '2026-11-30', days: 7 })).holds as ScheduleHold[],
    ).toHaveLength(1);
  });
  it('refuses a hold without the reservation edit permission', async () => {
    const c = mk({ grant: { role: 'viewer', permissions: [] } });
    await expect(
      c.schedule.holdSlot(slot('rm-201', '2026-10-30', '2026-11-01')),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('mock create with holds', () => {
  const body = (roomId: string, arrival: string, departure: string, holdId?: string) => ({
    requestId: `req-${roomId}-${arrival}`,
    roomId,
    arrival,
    departure,
    adults: 1,
    children: 0,
    guestName: 'Pat Doe',
    bookingGuestRole: 'occupant' as const,
    holdId,
  });
  it('refuses a booking on a slot someone else holds', async () => {
    const c = mk();
    const other = (await c.schedule.get(q)).holds![0];
    await expect(
      c.reservations.create(body(other.roomId, other.startDate, other.endDate)),
    ).rejects.toMatchObject({ status: 409, code: 'held' });
  });
  it('lets the holder book the slot and ends the hold', async () => {
    const c = mk({ holds: 'none' });
    const room = await freeRoom(c, '2026-10-20', '2026-10-22');
    await c.schedule.holdSlot(slot(room, '2026-10-20', '2026-10-22'));
    await c.reservations.create(body(room, '2026-10-20', '2026-10-22', ID));
    const d = await c.schedule.get(q);
    expect(d.holds).toEqual([]);
    expect(d.blocks.some((b) => b.roomId === room && b.startDate === '2026-10-20')).toBe(true);
  });
  it('a booking without a hold on a free slot still works', async () => {
    const c = mk();
    const room = await freeRoom(c, '2026-10-26', '2026-10-28');
    await expect(
      c.reservations.create(body(room, '2026-10-26', '2026-10-28')),
    ).resolves.toBeDefined();
  });
});
