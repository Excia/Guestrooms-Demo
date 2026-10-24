import { createMockClient } from './mock';
import { createHttpClient } from './http';

const T = '2026-10-16';
// Audited through the 10th: seeded check ins (arrivals 13th to 15th) are still undoable.
const mk = (o = {}) => createMockClient({ today: T, lastAuditedDate: '2026-10-10', ...o });
let n = 0;
const rid = () => `req-${++n}-menu0`;

describe('mock reservations.getDetail lastAuditedDate', () => {
  it('reports the last audited business date (default: the day before today)', async () => {
    expect((await mk().reservations.getDetail('rs-2')).lastAuditedDate).toBe('2026-10-10');
    expect(
      (await createMockClient({ today: T }).reservations.getDetail('rs-2')).lastAuditedDate,
    ).toBe('2026-10-15');
  });
});

describe('mock reservations.getDetail folioCharges', () => {
  it('reports a charge as posted only up to the last audited date (mpos charges as they are)', async () => {
    const early = (await mk().reservations.getDetail('rs-2')).folioCharges!;
    expect(early.filter((c) => c.type === 'room-rate').every((c) => c.status === 'unposted')).toBe(
      true,
    );
    const late = (await createMockClient({ today: T }).reservations.getDetail('rs-2'))
      .folioCharges!;
    expect(late.some((c) => c.type === 'room-rate' && c.status === 'posted')).toBe(true);
  });
});

describe('mock reservations.undoCheckIn', () => {
  it('undoes every checked-in room, bumps the version and updates the schedule', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-8');
    const after = await c.reservations.undoCheckIn({
      requestId: rid(),
      reservationId: 'rs-8',
      version: before.version,
    });
    expect(after.rooms.map((r) => r.status)).toEqual(['nyci', 'nyci']);
    expect(after.version).not.toBe(before.version);
    const grid = await c.schedule.get({ startDate: T, days: 7 });
    expect(grid.blocks.filter((b) => b.reservationId === 'rs-8').map((b) => b.status)).toEqual([
      'nyci',
      'nyci',
    ]);
  });

  it('undoes one room when asked to', async () => {
    const c = mk();
    const { version } = await c.reservations.getDetail('rs-8');
    const after = await c.reservations.undoCheckIn({
      requestId: rid(),
      reservationId: 'rs-8',
      version,
      reservationRoomId: 'rr-10',
    });
    expect(after.rooms.map((r) => r.status)).toEqual(['nyci', 'checked-in']);
  });

  it('409 audit-closed once the night audit has run for the check-in date', async () => {
    const c = createMockClient({ today: T }); // audited through the 15th
    const { version } = await c.reservations.getDetail('rs-2');
    await expect(
      c.reservations.undoCheckIn({ requestId: rid(), reservationId: 'rs-2', version }),
    ).rejects.toMatchObject({ status: 409, code: 'audit-closed' });
    expect((await c.reservations.getDetail('rs-2')).rooms[0].status).toBe('checked-in');
  });

  it('409 stale, 409 not-checked-in, 404, 400, 403 and idempotent replays', async () => {
    const c = mk();
    const { version } = await c.reservations.getDetail('rs-2');
    await expect(
      c.reservations.undoCheckIn({ requestId: rid(), reservationId: 'rs-2', version: 'old' }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    await expect(
      c.reservations.undoCheckIn({
        requestId: rid(),
        reservationId: 'rs-5',
        version: (await c.reservations.getDetail('rs-5')).version,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'not-checked-in' });
    await expect(
      c.reservations.undoCheckIn({ requestId: rid(), reservationId: 'zz', version: 'r1' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      c.reservations.undoCheckIn({ requestId: 'x', reservationId: 'rs-2', version }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
    const request = { requestId: rid(), reservationId: 'rs-2', version };
    const first = await c.reservations.undoCheckIn(request);
    expect(await c.reservations.undoCheckIn(request)).toEqual(first);
    await expect(
      c.reservations.undoCheckIn({ ...request, reservationRoomId: 'rr-2' }),
    ).rejects.toMatchObject({ status: 409, code: 'idempotency-conflict' });
    const readOnly = mk({ grant: { role: 'viewer', permissions: [] } });
    await expect(
      readOnly.reservations.undoCheckIn({ requestId: rid(), reservationId: 'rs-2', version }),
    ).rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });
});

describe('mock reservations.cancelReservation', () => {
  it('cancels, removes the rooms from the schedule and keeps the detail readable', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-7');
    const after = await c.reservations.cancelReservation({
      requestId: rid(),
      reservationId: 'rs-7',
      version: before.version,
    });
    expect(after.status).toBe('cancelled');
    expect(after.version).not.toBe(before.version);
    expect((await c.reservations.getDetail('rs-7')).status).toBe('cancelled');
    const grid = await c.schedule.get({ startDate: T, days: 14 });
    expect(grid.blocks.some((b) => b.reservationId === 'rs-7')).toBe(false);
  });

  it('409 not-cancellable once checked in, or when already cancelled; 409 stale; 403', async () => {
    const c = mk();
    const checkedIn = await c.reservations.getDetail('rs-2');
    await expect(
      c.reservations.cancelReservation({
        requestId: rid(),
        reservationId: 'rs-2',
        version: checkedIn.version,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'not-cancellable' });
    const { version } = await c.reservations.getDetail('rs-3');
    await expect(
      c.reservations.cancelReservation({ requestId: rid(), reservationId: 'rs-3', version: 'old' }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    await c.reservations.cancelReservation({ requestId: rid(), reservationId: 'rs-3', version });
    await expect(
      c.reservations.cancelReservation({ requestId: rid(), reservationId: 'rs-3', version }),
    ).rejects.toMatchObject({ status: 409, code: 'not-cancellable' });
    const readOnly = mk({ grant: { role: 'viewer', permissions: [] } });
    await expect(
      readOnly.reservations.cancelReservation({
        requestId: rid(),
        reservationId: 'rs-6',
        version: 'r1',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('http reservations cancel and undo', () => {
  const body = (status: string) => ({
    id: 'rs-3',
    confirmationNumber: 'GR-1',
    status,
    arrival: '2026-10-18',
    departure: '2026-10-21',
    nights: 3,
    adults: 2,
    children: 0,
    leadOccupant: { name: 'A', memberNumber: null, guestType: 'guest' },
    rooms: [
      {
        id: 'rr-3',
        roomId: 'rm-1',
        roomNumber: '1',
        locationName: 'L',
        roomTypeName: 'T',
        status: 'nyci',
        arrival: '2026-10-18',
        departure: '2026-10-21',
      },
    ],
    earlyCheckIn: false,
    lateCheckOut: false,
    addOns: [],
    publicNotes: '',
    privateNotes: '',
    stay: { lines: [], folioTotalCents: 0 },
    version: 'r2',
    lastAuditedDate: '2026-10-15',
  });

  it('posts with the idempotency key and checks the answer', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify(body('cancelled')), { status: 200 })),
    );
    const client = createHttpClient('https://api.test', { fetch: fetchMock });
    const request = { requestId: rid(), reservationId: 'rs-3', version: 'r1' };
    const detail = await client.reservations.cancelReservation(request);
    expect(detail.status).toBe('cancelled');
    const [url, init = {}] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.test/reservations/rs-3/cancel');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(request.requestId);
  });

  it('rejects a cancel answer that is not cancelled', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify(body('confirmed')), { status: 200 })),
    );
    const client = createHttpClient('https://api.test', { fetch: fetchMock });
    await expect(
      client.reservations.cancelReservation({
        requestId: rid(),
        reservationId: 'rs-3',
        version: 'r1',
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('treats a malformed lastAuditedDate as unknown (absent)', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ...body('confirmed'), lastAuditedDate: 'yesterday' }), {
          status: 200,
        }),
      ),
    );
    const client = createHttpClient('https://api.test', { fetch: fetchMock });
    const detail = await client.reservations.undoCheckIn({
      requestId: rid(),
      reservationId: 'rs-3',
      version: 'r1',
    });
    expect(detail.lastAuditedDate).toBeUndefined();
    const read = await client.reservations.getDetail('rs-3');
    expect(read.lastAuditedDate).toBeUndefined();
  });

  it('rejects folioCharges with an unknown type or status', async () => {
    for (const folioCharges of [[{ type: 'x', status: 'posted' }], [{ type: 'manual' }], 'x']) {
      const fetchMock = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ...body('confirmed'), folioCharges }), { status: 200 }),
        ),
      );
      const client = createHttpClient('https://api.test', { fetch: fetchMock });
      await expect(client.reservations.getDetail('rs-3')).rejects.toMatchObject({
        code: 'invalid-response',
      });
    }
    const ok = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ...body('confirmed'),
            folioCharges: [{ type: 'room-rate', status: 'posted' }],
          }),
          { status: 200 },
        ),
      ),
    );
    const detail = await createHttpClient('https://api.test', { fetch: ok }).reservations.getDetail(
      'rs-3',
    );
    expect(detail.folioCharges).toHaveLength(1);
  });

  it('undo check in posts to its path', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify(body('confirmed')), { status: 200 })),
    );
    const client = createHttpClient('https://api.test', { fetch: fetchMock });
    await client.reservations.undoCheckIn({
      requestId: rid(),
      reservationId: 'rs-3',
      version: 'r1',
      reservationRoomId: 'rr-3',
    });
    const [url, init = {}] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.test/reservations/rs-3/undo-check-in');
    expect(JSON.parse(String(init.body))).toMatchObject({ reservationRoomId: 'rr-3' });
  });
});
