import { housekeepingStatusOf } from '../app/housekeepingBlocks';
import { createMockClient } from './mock';
import { createHttpClient } from './http';
import { MOCK_MANAGER_PIN } from './overridePin';
import type { ApiClient, CheckInReservationRequest, PermissionGrant } from './types';

const T = '2026-10-16';
let n = 0;
const rid = () => `req-${++n}-in0000`;
const mk = (o = {}) => createMockClient({ today: T, ...o });
const grant = (...permissions: string[]): PermissionGrant =>
  ({ role: 'Staff', permissions }) as PermissionGrant;
const ANY = grant('reservation.edit', 'reservation.check-in.any-time');
const ARRIVAL = grant('reservation.edit', 'reservation.check-in.arrival-date');
const NEVER = grant('reservation.edit');

async function request(
  c: ApiClient,
  reservationId: string,
  reservationRoomIds: string[],
  over: Partial<CheckInReservationRequest> = {},
): Promise<CheckInReservationRequest> {
  const { version } = await c.reservations.getDetail(reservationId);
  return {
    requestId: rid(),
    reservationId,
    version,
    reservationRoomIds,
    pastDateConfirmed: true,
    checkOutAfter: false,
    ...over,
  };
}

// rs-31 (rr-28, room 110): arrived 10/12, left 10/15, never checked in. rs-32 (rr-31 in, rr-32 not):
// two rooms since 10/14. rs-5 (rr-5): arrives today in room 202. rs-6 (rr-6) has no payment method.
describe('mock reservations.checkIn on a past date', () => {
  it('needs the prior date confirmed', async () => {
    const c = mk();
    await expect(
      c.reservations.checkIn(await request(c, 'rs-31', ['rr-28'], { pastDateConfirmed: false })),
    ).rejects.toMatchObject({ status: 409, code: 'past-date-unconfirmed' });
    expect((await c.reservations.getDetail('rs-31')).rooms[0].status).toBe('nyci');
  });

  it('checks in, records the time and posts the nights before today', async () => {
    const at = new Date('2026-10-16T18:05:00Z');
    const c = mk({ now: () => at });
    const folioBefore = await c.folios.get('rs-31');
    expect(folioBefore.charges.filter((x) => x.type === 'room-rate').map((x) => x.status)).toEqual([
      'unposted',
      'unposted',
      'unposted',
    ]);
    const result = await c.reservations.checkIn(await request(c, 'rs-31', ['rr-28']));
    expect(result.rooms).toEqual([
      { reservationRoomId: 'rr-28', checkedIn: true, checkedInAt: at.toISOString() },
    ]);
    expect(result.nightsPosted).toBe(3);
    expect(result.autoCheckedOut).toBe(false);
    expect(result.reservation.status).toBe('checked-in');
    expect(result.reservation.rooms[0]).toMatchObject({
      status: 'checked-in',
      checkedInAt: at.toISOString(),
    });
    const folio = await c.folios.get('rs-31');
    expect(folio.checkInStatus).toBe('checked-in');
    expect(
      folio.charges.filter((x) => x.type === 'room-rate').every((x) => x.status === 'posted'),
    ).toBe(true);
  });

  it('checks the room out right after when the departure has passed', async () => {
    const at = new Date('2026-10-16T18:05:00Z');
    const c = mk({ now: () => at });
    const result = await c.reservations.checkIn(
      await request(c, 'rs-31', ['rr-28'], { checkOutAfter: true }),
    );
    expect(result.autoCheckedOut).toBe(true);
    expect(result.rooms[0]).toMatchObject({ checkedIn: true, checkedOutAt: at.toISOString() });
    expect(result.reservation.status).toBe('checked-out');
    expect(result.reservation.rooms[0]).toMatchObject({
      checkedInAt: at.toISOString(),
      checkedOutAt: at.toISOString(),
    });
    expect((await c.folios.get('rs-31')).checkInStatus).toBe('checked-out');
  });

  it('does not check out while the departure is ahead, even when asked', async () => {
    const c = mk();
    const result = await c.reservations.checkIn(
      await request(c, 'rs-32', ['rr-32'], { checkOutAfter: true }),
    );
    expect(result.autoCheckedOut).toBe(false);
    expect(result.reservation.rooms.find((r) => r.id === 'rr-32')?.status).toBe('checked-in');
  });

  it('checks out on the departure day only after the check-out time (club clock)', async () => {
    // The mock club is in New York with a 12:00 check-out; rs-6 departs tomorrow, so use a stay that
    // departs today: undo rs-2? It departs +2. Use rs-4 (departs today) after undoing its check in.
    const before = new Date('2026-10-16T14:00:00Z'); // 10:00 in New York
    const after = new Date('2026-10-16T18:00:00Z'); // 14:00 in New York
    for (const [at, out] of [
      [before, false],
      [after, true],
    ] as const) {
      const c = mk({ now: () => at, lastAuditedDate: '2026-10-10' });
      const d = await c.reservations.getDetail('rs-4');
      await c.reservations.undoCheckIn({
        requestId: rid(),
        reservationId: 'rs-4',
        version: d.version,
      });
      const result = await c.reservations.checkIn(
        await request(c, 'rs-4', ['rr-4'], { checkOutAfter: true }),
      );
      expect(result.autoCheckedOut).toBe(out);
    }
  });

  it('updates the schedule block and the reservation list without a reload', async () => {
    const c = mk();
    await c.reservations.checkIn(await request(c, 'rs-31', ['rr-28']));
    const schedule = await c.schedule.get({ startDate: '2026-10-06', days: 30 });
    expect(schedule.blocks.find((b) => b.id === 'rr-28')?.status).toBe('checked-in');
    const list = await c.reservationList.list({});
    const row = list.items.find((r) => r.id === 'rs-31');
    expect(row?.rooms[0].status).toBe('checked-in');
  });

  it('replays the same request id without checking in twice', async () => {
    const c = mk();
    const req = await request(c, 'rs-31', ['rr-28']);
    const first = await c.reservations.checkIn(req);
    expect(await c.reservations.checkIn(req)).toEqual(first);
  });

  it('refuses a stale version', async () => {
    const c = mk();
    await expect(
      c.reservations.checkIn(await request(c, 'rs-31', ['rr-28'], { version: 'old' })),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
  });

  it('refuses a room that is not on the reservation', async () => {
    const c = mk();
    await expect(c.reservations.checkIn(await request(c, 'rs-31', ['rr-1']))).rejects.toMatchObject(
      {
        status: 404,
      },
    );
  });
});

describe('mock reservations.checkIn permission levels', () => {
  it('"never" is forbidden', async () => {
    const c = mk({ grant: NEVER });
    await expect(c.reservations.checkIn(await request(c, 'rs-5', ['rr-5']))).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
    });
  });

  it('"arrival date only" checks in on the arrival date without a code', async () => {
    const c = mk({ grant: ARRIVAL });
    const result = await c.reservations.checkIn(
      await request(c, 'rs-5', ['rr-5'], { pastDateConfirmed: false }),
    );
    expect(result.rooms[0].checkedIn).toBe(true);
  });

  it('"arrival date only" needs a valid override code for a past date', async () => {
    const c = mk({ grant: ARRIVAL });
    await expect(
      c.reservations.checkIn(await request(c, 'rs-31', ['rr-28'])),
    ).rejects.toMatchObject({
      status: 403,
      code: 'override-required',
    });
    await expect(
      c.reservations.checkIn(await request(c, 'rs-31', ['rr-28'], { overrideCode: '0000' })),
    ).rejects.toMatchObject({ status: 403, code: 'override-invalid' });
    const ok = await c.reservations.checkIn(
      await request(c, 'rs-31', ['rr-28'], { overrideCode: MOCK_MANAGER_PIN }),
    );
    expect(ok.rooms[0].checkedIn).toBe(true);
  });

  it('an arrival in the future cannot be checked in at any level', async () => {
    const c = mk({ grant: ANY });
    await expect(c.reservations.checkIn(await request(c, 'rs-3', ['rr-3']))).rejects.toMatchObject({
      status: 409,
      code: 'future-arrival',
    });
  });
});

describe('mock reservations.checkIn per-room failures', () => {
  it('reports a missing payment method and checks in nothing', async () => {
    const c = mk();
    const result = await c.reservations.checkIn(await request(c, 'rs-6', ['rr-6']));
    expect(result.rooms).toEqual([
      { reservationRoomId: 'rr-6', checkedIn: false, failure: 'no-payment-method' },
    ]);
    expect(result.reservation.rooms[0].status).toBe('nyci');
    expect(result.reservation.paymentOnFile).toBe(false);
  });

  it('continues once a payment method is added', async () => {
    const c = mk();
    const added = await c.reservations.addPaymentMethod({
      requestId: rid(),
      reservationId: 'rs-6',
    });
    expect(added.paymentOnFile).toBe(true);
    const result = await c.reservations.checkIn(await request(c, 'rs-6', ['rr-6']));
    expect(result.rooms[0].checkedIn).toBe(true);
  });

  it('reports an unassigned room', async () => {
    const c = mk();
    const created = await c.reservations.create({
      requestId: rid(),
      roomId: null,
      arrival: T,
      departure: '2026-10-18',
      adults: 1,
      children: 0,
      guestName: 'Pat Doe',
      bookingGuestRole: 'occupant',
    });
    const result = await c.reservations.checkIn(
      await request(c, created.id, [created.rooms[0].id]),
    );
    expect(result.rooms[0]).toMatchObject({ checkedIn: false, failure: 'unassigned' });
  });

  it('reports a dirty or not ready room', async () => {
    const c = mk();
    const block = (await c.schedule.get({ startDate: '2026-10-06', days: 30 })).blocks.find(
      (b) => b.id === 'rr-35',
    )!;
    // The guest of rr-35 left room C3 and it needs cleaning before rr-25 arrives today.
    await c.schedule.setHousekeeping({
      reservationRoomId: 'rr-35',
      requestId: rid(),
      version: block.version,
      status: 'needs-cleaning',
    });
    const detail = await c.reservations.getDetail('rs-22');
    expect(detail.rooms[0].housekeeping).toBe('dirty');
    const result = await c.reservations.checkIn(await request(c, 'rs-22', ['rr-25']));
    expect(result.rooms[0]).toMatchObject({ checkedIn: false, failure: 'room-not-ready' });
  });

  it('a mixed request checks in some rooms and reports the others', async () => {
    const c = mk();
    const d = await c.reservations.getDetail('rs-32');
    expect(d.rooms.map((r) => r.status)).toEqual(['checked-in', 'nyci']);
    const result = await c.reservations.checkIn(await request(c, 'rs-32', ['rr-31', 'rr-32']));
    expect(result.rooms).toEqual([
      { reservationRoomId: 'rr-31', checkedIn: false, failure: 'not-checkable' },
      expect.objectContaining({ reservationRoomId: 'rr-32', checkedIn: true }),
    ]);
  });
});

describe('mock reservations.splitRoom', () => {
  it('moves the room to a reservation of its own and answers the new one', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-32');
    const created = await c.reservations.splitRoom({
      requestId: rid(),
      reservationId: 'rs-32',
      reservationRoomId: 'rr-32',
      version: before.version,
    });
    expect(created.id).not.toBe('rs-32');
    expect(created.rooms.map((r) => r.id)).toEqual(['rr-32']);
    expect(created.confirmationNumber).not.toBe(before.confirmationNumber);
    const left = await c.reservations.getDetail('rs-32');
    expect(left.rooms.map((r) => r.id)).toEqual(['rr-31']);
    // The split-off room can now be checked in on its own, for the original date.
    const result = await c.reservations.checkIn(await request(c, created.id, ['rr-32']));
    expect(result.rooms[0].checkedIn).toBe(true);
  });

  it('refuses a one-room reservation and a stale version', async () => {
    const c = mk();
    const one = await c.reservations.getDetail('rs-31');
    await expect(
      c.reservations.splitRoom({
        requestId: rid(),
        reservationId: 'rs-31',
        reservationRoomId: 'rr-28',
        version: one.version,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'not-splittable' });
    await expect(
      c.reservations.splitRoom({
        requestId: rid(),
        reservationId: 'rs-32',
        reservationRoomId: 'rr-32',
        version: 'old',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
  });
});

describe('override code handling in the mock', () => {
  it('verify needs a user with a check-in grant', async () => {
    const ask = (c: ApiClient) =>
      c.overrides.verifyPin({ permission: 'reservation.check-in.any-time', pin: '1' });
    await expect(ask(mk({ grant: NEVER }))).rejects.toMatchObject({ status: 403 });
    await expect(ask(mk({ grant: ARRIVAL }))).resolves.toEqual({ valid: false });
  });

  it('a replay with another code under the same request id is a conflict; the same code replays', async () => {
    const c = mk({ grant: ARRIVAL });
    const req = await request(c, 'rs-31', ['rr-28'], { overrideCode: MOCK_MANAGER_PIN });
    const first = await c.reservations.checkIn(req);
    expect(await c.reservations.checkIn(req)).toEqual(first);
    await expect(c.reservations.checkIn({ ...req, overrideCode: '0000' })).rejects.toMatchObject({
      code: 'idempotency-conflict',
    });
  });
});

describe('request guards', () => {
  const c = mk();
  const base = (): CheckInReservationRequest => ({
    requestId: rid(),
    reservationId: 'rs-31',
    version: 'r1',
    reservationRoomIds: ['rr-28'],
    pastDateConfirmed: true,
    checkOutAfter: false,
  });
  it.each([
    ['a bad request id', { requestId: 'x' }],
    ['no rooms', { reservationRoomIds: [] }],
    ['a repeated room', { reservationRoomIds: ['rr-28', 'rr-28'] }],
    ['a path-like room id', { reservationRoomIds: ['..'] }],
    ['a non-boolean flag', { pastDateConfirmed: 'yes' as unknown as boolean }],
    ['an empty override code', { overrideCode: '' }],
    ['an overlong override code', { overrideCode: 'x'.repeat(33) }],
    ['a missing version', { version: '' }],
  ])('rejects %s before any call', async (_name, over) => {
    await expect(c.reservations.checkIn({ ...base(), ...over })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('http client', () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const respond = (body: unknown) =>
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  afterEach(() => {
    calls.length = 0;
    vi.unstubAllGlobals();
  });

  it('posts the check in with an idempotency key and checks the answer', async () => {
    const mock = mk();
    const req = await request(mock, 'rs-31', ['rr-28']);
    const answer = await mock.reservations.checkIn(req);
    vi.stubGlobal('fetch', respond(answer));
    const http = createHttpClient('https://api.example.test');
    const got = await http.reservations.checkIn(req);
    expect(got.rooms[0].reservationRoomId).toBe('rr-28');
    expect(String(calls[0].url)).toBe('https://api.example.test/reservations/rs-31/check-in');
    expect(calls[0].init?.method).toBe('POST');
    expect((calls[0].init?.headers as Record<string, string>)['Idempotency-Key']).toBe(
      req.requestId,
    );
  });

  it('rejects an answer for another reservation or with a missing room outcome', async () => {
    const mock = mk();
    const req = await request(mock, 'rs-31', ['rr-28']);
    const answer = await mock.reservations.checkIn(req);
    const http = createHttpClient('https://api.example.test');
    vi.stubGlobal('fetch', respond({ ...answer, rooms: [] }));
    await expect(http.reservations.checkIn(req)).rejects.toMatchObject({
      code: 'invalid-response',
    });
    vi.stubGlobal(
      'fetch',
      respond({ ...answer, reservation: { ...answer.reservation, id: 'rs-other' } }),
    );
    await expect(http.reservations.checkIn(req)).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('rejects an answer that repeats a room outcome', async () => {
    const mock = mk();
    const req = await request(mock, 'rs-32', ['rr-31', 'rr-32']);
    const answer = await mock.reservations.checkIn(req);
    const http = createHttpClient('https://api.example.test');
    vi.stubGlobal('fetch', respond({ ...answer, rooms: [answer.rooms[0], answer.rooms[0]] }));
    await expect(http.reservations.checkIn(req)).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('a split answers a new reservation, never the old one', async () => {
    const mock = mk();
    const before = await mock.reservations.getDetail('rs-32');
    const split = {
      requestId: rid(),
      reservationId: 'rs-32',
      reservationRoomId: 'rr-32',
      version: before.version,
    };
    const created = await mock.reservations.splitRoom(split);
    const http = createHttpClient('https://api.example.test');
    vi.stubGlobal('fetch', respond(created));
    expect((await http.reservations.splitRoom(split)).id).toBe(created.id);
    vi.stubGlobal('fetch', respond(before));
    await expect(http.reservations.splitRoom(split)).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('asks the backend to verify an override PIN', async () => {
    vi.stubGlobal('fetch', respond({ valid: true }));
    const http = createHttpClient('https://api.example.test');
    await expect(
      http.overrides.verifyPin({
        permission: 'reservation.check-in.any-time',
        pin: '1',
      }),
    ).resolves.toEqual({ valid: true });
    expect(String(calls[0].url)).toBe('https://api.example.test/overrides/verify-pin');
    vi.stubGlobal('fetch', respond({ valid: 'yes' }));
    await expect(
      http.overrides.verifyPin({
        permission: 'reservation.check-in.any-time',
        pin: '1',
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('refuses a locked-out answer that also says valid', async () => {
    vi.stubGlobal('fetch', respond({ valid: true, lockedForSeconds: 30 }));
    const http = createHttpClient('https://api.example.test');
    await expect(
      http.overrides.verifyPin({ permission: 'reservation.check-in.any-time', pin: '1' }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('reads an HTTP 429 (body or Retry-After) as locked out', async () => {
    const http = createHttpClient('https://api.example.test');
    const ask = () =>
      http.overrides.verifyPin({ permission: 'reservation.check-in.any-time', pin: '1' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '120' } })),
    );
    await expect(ask()).resolves.toEqual({ valid: false, lockedForSeconds: 120 });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ details: { retryAfterSeconds: ['45'] } }), { status: 429 }),
      ),
    );
    await expect(ask()).resolves.toEqual({ valid: false, lockedForSeconds: 45 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 429 })),
    );
    await expect(ask()).resolves.toEqual({ valid: false, lockedForSeconds: 60 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
    await expect(ask()).rejects.toMatchObject({ status: 500 });
  });
});

// D-HK-4: the stored housekeeping state follows the stay's check-in status.
describe('mock check in and check out set the housekeeping state', () => {
  const block = async (c: ApiClient, id: string) =>
    (await c.schedule.get({ startDate: '2026-10-06', days: 30 })).blocks.find((b) => b.id === id)!;

  it('check-in stores Not Checked Out', async () => {
    const c = mk();
    expect(housekeepingStatusOf(await block(c, 'rr-5'))).toBe('nyci');
    await c.reservations.checkIn(await request(c, 'rs-5', ['rr-5']));
    const after = await block(c, 'rr-5');
    expect(after.housekeeping).toBe('not-checked-out');
    expect(housekeepingStatusOf(after)).toBe('not-checked-out');
  });

  it('automatic check-out leaves the room needing cleaning', async () => {
    const c = mk({ now: () => new Date('2026-10-16T18:00:00Z') });
    const result = await c.reservations.checkIn(
      await request(c, 'rs-31', ['rr-28'], { checkOutAfter: true }),
    );
    expect(result.autoCheckedOut).toBe(true);
    const after = await block(c, 'rr-28');
    expect(after.status).toBe('checked-out');
    expect(after.housekeeping).toBe('needs-cleaning');
    expect(housekeepingStatusOf(after)).toBe('needs-cleaning');
  });

  it('undoing a check-in goes back to not checked in', async () => {
    const c = mk({ lastAuditedDate: '2026-10-10' });
    const d = await c.reservations.getDetail('rs-4');
    await c.reservations.undoCheckIn({
      requestId: rid(),
      reservationId: 'rs-4',
      version: d.version,
    });
    expect(housekeepingStatusOf(await block(c, 'rr-4'))).toBe('nyci');
  });
});
