import { createHttpClient } from './http';
import { createMockClient } from './mock';
import { buildDetail } from './reservationDetailData';
import { createScheduleState } from './scheduleData';
import type { CreateReservationRequest, ReservationDetail } from './types';

const T = '2026-10-16';
const mk = (o = {}) => createMockClient({ today: T, ...o });
let n = 0;
const rid = () => `req-${++n}-test0`;

describe('mock reservations.getDetail', () => {
  it('describes a single-room reservation from the schedule state', async () => {
    const d = await mk().reservations.getDetail('rs-2');
    expect(d).toMatchObject({
      confirmationNumber: 'GR-50240',
      status: 'checked-in',
      nights: 3,
      adults: 2,
      children: 2,
      earlyCheckIn: true,
      lateCheckOut: false,
      leadOccupant: { name: 'Daniel Whitfield', memberNumber: expect.stringMatching(/^MEM-/) },
    });
    expect(d.rooms).toEqual([
      expect.objectContaining({
        id: 'rr-2',
        roomNumber: '201',
        locationName: 'Main Clubhouse',
        status: 'checked-in',
      }),
    ]);
    expect(d.stay.lines).toHaveLength(3);
    expect(d.stay.folioTotalCents).toBe(3 * 24900 + 6500);
  });

  it('describes a multi-room reservation with one entry per room', async () => {
    const d = await mk().reservations.getDetail('rs-7');
    expect(d.rooms.map((r) => r.roomNumber)).toEqual(['204', '209', '205']);
    expect(d.status).toBe('confirmed');
    expect(d.lateCheckOut).toBe(true);
  });

  it('the status follows the rooms: in house while any room is, checked out when all are', async () => {
    expect((await mk().reservations.getDetail('rs-1')).status).toBe('checked-out');
    expect((await mk().reservations.getDetail('rs-8')).status).toBe('checked-in');
  });

  it('404 for an unknown reservation, 400 for a bad id, 404 in the empty scenario', async () => {
    await expect(mk().reservations.getDetail('nope')).rejects.toMatchObject({ status: 404 });
    await expect(mk().reservations.getDetail('..')).rejects.toMatchObject({ code: 'invalid-id' });
    await expect(mk({ scenario: 'empty' }).reservations.getDetail('rs-2')).rejects.toMatchObject({
      status: 404,
    });
    await expect(mk({ scenario: 'error' }).reservations.getDetail('rs-2')).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe('mock reservations.setEarlyLate', () => {
  it('saves the flags, bumps the version and mirrors them on the schedule blocks', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-3');
    const result = await c.reservations.setEarlyLate({
      requestId: rid(),
      reservationId: 'rs-3',
      version: before.version,
      earlyCheckIn: true,
    });
    expect(result).toMatchObject({ earlyCheckIn: true, lateCheckOut: false });
    expect(result.version).not.toBe(before.version);
    expect((await c.reservations.getDetail('rs-3')).earlyCheckIn).toBe(true);
    const grid = await c.schedule.get({ startDate: T, days: 7 });
    expect(grid.blocks.find((b) => b.reservationId === 'rs-3')?.earlyCheckIn).toBe(true);
    // Clearing removes the marker.
    await c.reservations.setEarlyLate({
      requestId: rid(),
      reservationId: 'rs-3',
      version: result.version,
      earlyCheckIn: false,
    });
    const again = await c.schedule.get({ startDate: T, days: 7 });
    expect(again.blocks.find((b) => b.reservationId === 'rs-3')?.earlyCheckIn).toBeUndefined();
  });

  it('409 stale for an old version and applies nothing', async () => {
    const c = mk();
    const { version } = await c.reservations.getDetail('rs-3');
    await c.reservations.setEarlyLate({
      requestId: rid(),
      reservationId: 'rs-3',
      version,
      lateCheckOut: true,
    });
    await expect(
      c.reservations.setEarlyLate({
        requestId: rid(),
        reservationId: 'rs-3',
        version,
        earlyCheckIn: true,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    expect((await c.reservations.getDetail('rs-3')).earlyCheckIn).toBe(false);
  });

  it('is idempotent on requestId: a replay does not apply twice or go stale', async () => {
    const c = mk();
    const { version } = await c.reservations.getDetail('rs-3');
    const request = { requestId: rid(), reservationId: 'rs-3', version, earlyCheckIn: true };
    const first = await c.reservations.setEarlyLate(request);
    expect(await c.reservations.setEarlyLate(request)).toEqual(first);
    await expect(
      c.reservations.setEarlyLate({ ...request, earlyCheckIn: false }),
    ).rejects.toMatchObject({ status: 409, code: 'idempotency-conflict' });
  });

  it('409 not-editable once checked out; 404 unknown; 400 for an empty change', async () => {
    const c = mk();
    const { version } = await c.reservations.getDetail('rs-1');
    await expect(
      c.reservations.setEarlyLate({
        requestId: rid(),
        reservationId: 'rs-1',
        version,
        earlyCheckIn: true,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'not-editable' });
    await expect(
      c.reservations.setEarlyLate({
        requestId: rid(),
        reservationId: 'zz',
        version: 'r1',
        earlyCheckIn: true,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      c.reservations.setEarlyLate({ requestId: rid(), reservationId: 'rs-3', version: 'r1' }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
    await expect(
      c.reservations.setEarlyLate({
        requestId: 'x',
        reservationId: 'rs-3',
        version: 'r1',
        earlyCheckIn: true,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('mock reservations.create', () => {
  const base = (over: Partial<CreateReservationRequest> = {}): CreateReservationRequest => ({
    requestId: rid(),
    roomId: 'rm-203',
    arrival: '2026-10-20',
    departure: '2026-10-22',
    adults: 2,
    children: 1,
    guestName: 'Ann Lee',
    bookingGuestRole: 'occupant',
    ...over,
  });

  it('creates the reservation, shows it on the grid and answers its detail', async () => {
    const c = mk();
    const d = await c.reservations.create(base());
    expect(d).toMatchObject({ status: 'confirmed', nights: 2, adults: 2, children: 1 });
    expect(d.rooms[0].roomNumber).toBe('203');
    const grid = await c.schedule.get({ startDate: '2026-10-16', days: 14 });
    expect(grid.blocks.some((b) => b.reservationId === d.id)).toBe(true);
    expect((await c.reservations.getDetail(d.id)).confirmationNumber).toBe(d.confirmationNumber);
  });

  it('409 conflict when the room is booked or closed; nothing is created', async () => {
    const c = mk();
    await expect(
      c.reservations.create(
        base({ roomId: 'rm-201', arrival: '2026-10-17', departure: '2026-10-19' }),
      ),
    ).rejects.toMatchObject({ status: 409, code: 'conflict' });
    await expect(
      c.reservations.create(
        base({ roomId: 'rm-208', arrival: '2026-10-17', departure: '2026-10-19' }),
      ),
    ).rejects.toMatchObject({ code: 'conflict' });
    const grid = await c.schedule.get({ startDate: T, days: 30 });
    expect(grid.blocks.some((b) => b.id.startsWith('rr-new'))).toBe(false);
  });

  it('replays a repeated request id instead of creating twice', async () => {
    const c = mk();
    const request = base();
    const a = await c.reservations.create(request);
    expect(await c.reservations.create(request)).toEqual(a);
  });

  it('rejects bad input and unknown rooms', async () => {
    const c = mk();
    for (const bad of [
      base({ departure: '2026-10-20' }),
      base({ adults: 0 }),
      base({ guestName: ' ' }),
      base({ arrival: '2026-10-01', departure: '2026-10-03' }),
    ]) {
      await expect(c.reservations.create(bad)).rejects.toMatchObject({ status: 400 });
    }
    await expect(c.reservations.create(base({ roomId: 'rm-nope' }))).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('mock settings.getBookingHold', () => {
  it('answers minutes per audience (placeholder values)', async () => {
    expect(await mk().settings.getBookingHold()).toEqual({
      employee: 15,
      member: 10,
      nonMember: 10,
    });
  });
});

describe('http reservation details, early/late, create and settings', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const make = (f: typeof fetch) => createHttpClient('https://api.example.com/v1', { fetch: f });
  const detail = (): ReservationDetail => buildDetail(createScheduleState(T), 'rs-2');

  it('getDetail calls /reservations/:id/detail and checks the shape', async () => {
    const f = vi.fn().mockResolvedValue(json(detail()));
    expect((await make(f).reservations.getDetail('rs-2')).confirmationNumber).toBe('GR-50240');
    expect((f.mock.calls[0][0] as URL).pathname).toBe('/v1/reservations/rs-2/detail');
    for (const bad of [
      {},
      { ...detail(), rooms: [] },
      { ...detail(), status: 'x' },
      { ...detail(), version: '' },
      { ...detail(), earlyCheckIn: 'yes' },
    ]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(bad))).reservations.getDetail('rs-2'),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
    const never = vi.fn();
    await expect(make(never).reservations.getDetail('..')).rejects.toMatchObject({
      code: 'invalid-id',
    });
    expect(never).not.toHaveBeenCalled();
  });

  it('setEarlyLate posts with the idempotency header and requires the asked flags back', async () => {
    const request = {
      requestId: 'req-12345678',
      reservationId: 'rs-2',
      version: 'r1',
      lateCheckOut: true,
    };
    const ok = vi
      .fn()
      .mockResolvedValue(json({ earlyCheckIn: true, lateCheckOut: true, version: 'r2' }));
    await make(ok).reservations.setEarlyLate(request);
    const init = ok.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('req-12345678');
    expect((ok.mock.calls[0][0] as URL).pathname).toBe('/v1/reservations/rs-2/early-late');
    for (const bad of [
      { earlyCheckIn: true, lateCheckOut: false, version: 'r2' },
      { earlyCheckIn: true, lateCheckOut: true },
      {},
    ]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(bad))).reservations.setEarlyLate(request),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
    await expect(
      make(
        vi.fn().mockResolvedValue(json({ message: 'old', code: 'stale' }, 409)),
      ).reservations.setEarlyLate(request),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
  });

  it('create posts and checks the created reservation is the requested one', async () => {
    const c = mk();
    const request: CreateReservationRequest = {
      requestId: 'req-12345678',
      roomId: 'rm-203',
      arrival: '2026-10-20',
      departure: '2026-10-22',
      adults: 2,
      children: 0,
      guestName: 'Ann',
      bookingGuestRole: 'occupant',
    };
    const created = await c.reservations.create(request);
    const f = vi.fn().mockResolvedValue(json(created, 201));
    await expect(make(f).reservations.create(request)).resolves.toMatchObject({ id: created.id });
    expect((f.mock.calls[0][0] as URL).pathname).toBe('/v1/reservations');
    await expect(
      make(vi.fn().mockResolvedValue(json(created))).reservations.create({
        ...request,
        roomId: 'rm-204',
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('getBookingHold requires 1 to 99 minutes per audience', async () => {
    const f = vi.fn().mockResolvedValue(json({ employee: 15, member: 10, nonMember: 99 }));
    await expect(make(f).settings.getBookingHold()).resolves.toEqual({
      employee: 15,
      member: 10,
      nonMember: 99,
    });
    expect((f.mock.calls[0][0] as URL).pathname).toBe('/v1/settings/booking-hold');
    for (const bad of [
      { employee: 0, member: 10, nonMember: 10 },
      { employee: 15, member: 100, nonMember: 10 },
      { employee: 1.5, member: 1, nonMember: 1 },
      { employee: 15 },
    ]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(bad))).settings.getBookingHold(),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
  });
});
