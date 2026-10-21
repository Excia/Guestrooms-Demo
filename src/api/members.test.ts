import { createHttpClient } from './http';
import { createMockClient } from './mock';
import type { CreateReservationRequest } from './types';

const T = '2026-10-16';
const mk = (o = {}) => createMockClient({ today: T, ...o });
let n = 0;
const rid = () => `req-${++n}-members`;

describe('mock members.search', () => {
  it('answers the first members by name, with a total, when there is no query', async () => {
    const page = await mk().members.search();
    expect(page.items).toHaveLength(8);
    expect(page.total).toBe(25);
    expect(page.items.map((m) => m.name)).toEqual([...page.items.map((m) => m.name)].sort());
    expect(page.items[0]).toMatchObject({ memberNumber: expect.stringMatching(/^MEM-\d{4}$/) });
  });

  it('searches name, member number and email, case-insensitively, and honours the limit', async () => {
    const c = mk();
    expect((await c.members.search({ q: 'GRACE' })).items.map((m) => m.name)).toEqual([
      'Grace Nakamura',
    ]);
    expect((await c.members.search({ q: 'mem-0002' })).items[0].name).toBe('Daniel Whitfield');
    expect((await c.members.search({ q: 'example.com', limit: 3 })).items).toHaveLength(3);
    expect((await c.members.search({ q: 'zzzz' })).items).toEqual([]);
  });

  it('rejects bad queries, and behaves in the empty and error scenarios', async () => {
    await expect(mk().members.search({ limit: 0 })).rejects.toMatchObject({
      code: 'invalid-query',
    });
    await expect(mk().members.search({ limit: 500 })).rejects.toMatchObject({ status: 400 });
    expect((await mk({ scenario: 'empty' }).members.search()).items).toEqual([]);
    await expect(mk({ scenario: 'error' }).members.search()).rejects.toMatchObject({ status: 500 });
  });
});

describe('mock members.create', () => {
  it('adds a person who can then be found; idempotent on requestId', async () => {
    const c = mk();
    const request = { requestId: rid(), name: ' Zed Newcomer ', email: 'zed@example.com' };
    const made = await c.members.create(request);
    expect(made).toMatchObject({ name: 'Zed Newcomer', email: 'zed@example.com', phone: '' });
    expect(await c.members.create(request)).toEqual(made);
    expect((await c.members.search({ q: 'zed' })).items.map((m) => m.id)).toEqual([made.id]);
    await expect(c.members.create({ ...request, name: 'Other' })).rejects.toMatchObject({
      status: 409,
      code: 'idempotency-conflict',
    });
  });

  it('validates name, email and request id', async () => {
    const c = mk();
    for (const bad of [
      { requestId: rid(), name: '  ' },
      { requestId: rid(), name: 'A', email: 'not-an-email' },
      { requestId: rid(), name: 'A', phone: 'x'.repeat(41) },
      { requestId: 'x', name: 'A' },
    ]) {
      await expect(c.members.create(bad)).rejects.toMatchObject({ status: 400 });
    }
  });
});

describe('http members', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const make = (f: typeof fetch) => createHttpClient('https://api.example.com/v1', { fetch: f });

  it('search sends q and limit and checks the shape', async () => {
    const page = await mk().members.search({ q: 'grace' });
    const f = vi.fn().mockResolvedValue(json(page));
    await expect(make(f).members.search({ q: ' grace ', limit: 5 })).resolves.toMatchObject({
      total: 1,
    });
    const url = f.mock.calls[0][0] as URL;
    expect(url.pathname).toBe('/v1/members');
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'grace', limit: '5' });
    for (const bad of [{}, { items: [{ id: 'x' }], total: 1 }, { items: [], total: 'x' }]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(bad))).members.search(),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
    const never = vi.fn();
    await expect(make(never).members.search({ limit: 0 })).rejects.toMatchObject({
      code: 'invalid-query',
    });
    expect(never).not.toHaveBeenCalled();
  });

  it('create posts with the idempotency header and checks the person is the one asked for', async () => {
    const request = { requestId: 'req-12345678', name: 'Zed', phone: '555' };
    const made = await mk().members.create(request);
    const f = vi.fn().mockResolvedValue(json(made, 201));
    await expect(make(f).members.create(request)).resolves.toMatchObject({ name: 'Zed' });
    const init = f.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('req-12345678');
    await expect(
      make(vi.fn().mockResolvedValue(json({ ...made, name: 'Other' }, 201))).members.create(
        request,
      ),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
});

describe('create without a room, a lead occupant and TBD', () => {
  const base = (over: Partial<CreateReservationRequest> = {}): CreateReservationRequest => ({
    requestId: rid(),
    arrival: '2026-10-20',
    departure: '2026-10-22',
    adults: 2,
    children: 0,
    guestName: 'TBD',
    bookingGuestRole: 'occupant',
    ...over,
  });

  it('an unassigned reservation has no lane on the grid, but a detail that says Unassigned', async () => {
    const c = mk();
    const d = await c.reservations.create(base());
    expect(d.rooms[0]).toMatchObject({ roomId: null, roomNumber: null, locationName: null });
    expect(d.leadOccupant.name).toBe('TBD');
    const grid = await c.schedule.get({ startDate: T, days: 14 });
    expect(grid.blocks.some((b) => b.reservationId === d.id)).toBe(false);
    expect((await c.reservations.getDetail(d.id)).confirmationNumber).toBe(d.confirmationNumber);
    // it can still be edited
    const saved = await c.reservations.setEarlyLate({
      requestId: rid(),
      reservationId: d.id,
      version: d.version,
      earlyCheckIn: true,
    });
    expect(saved.earlyCheckIn).toBe(true);
  });

  it('no conflict check without a room; null and absent room are the same', async () => {
    const c = mk();
    await c.reservations.create(base({ roomId: null }));
    await c.reservations.create(base());
    await expect(c.reservations.create(base({ roomId: 'rm-nope' }))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('lead occupant: the booking guest for an occupant, the given person or TBD for a reserver', async () => {
    const c = mk();
    const guest = (await c.members.search({ q: 'grace' })).items[0];
    const occupant = await c.reservations.create(
      base({ guestName: guest.name, bookingGuestId: guest.id }),
    );
    expect(occupant.leadOccupant).toMatchObject({
      name: 'Grace Nakamura',
      memberNumber: guest.memberNumber,
    });
    const other = (await c.members.search({ q: 'victor' })).items[0];
    const reserver = await c.reservations.create(
      base({
        guestName: guest.name,
        bookingGuestId: guest.id,
        bookingGuestRole: 'reserver',
        leadOccupant: { name: other.name, memberId: other.id },
      }),
    );
    expect(reserver.leadOccupant).toMatchObject({
      name: 'Victor Almeida',
      memberNumber: other.memberNumber,
    });
    const tbd = await c.reservations.create(
      base({ guestName: guest.name, bookingGuestRole: 'reserver' }),
    );
    expect(tbd.leadOccupant.name).toBe('TBD');
  });

  it('validates the lead occupant and the guest id', async () => {
    const c = mk();
    await expect(
      c.reservations.create(base({ leadOccupant: { name: ' ' } })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(c.reservations.create(base({ bookingGuestId: '' }))).rejects.toMatchObject({
      status: 400,
    });
  });

  it('http: the created answer must match the lead occupant rule and the missing room', async () => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 201 });
    const make = (f: typeof fetch) => createHttpClient('https://api.example.com/v1', { fetch: f });
    const c = mk();
    const request = base({ bookingGuestRole: 'reserver' });
    const created = await c.reservations.create(request);
    await expect(
      make(vi.fn().mockResolvedValue(json(created))).reservations.create(request),
    ).resolves.toMatchObject({ id: created.id });
    const wrong = { ...created, leadOccupant: { ...created.leadOccupant, name: 'Someone' } };
    await expect(
      make(vi.fn().mockResolvedValue(json(wrong))).reservations.create(request),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    const roomed = { ...created, rooms: [{ ...created.rooms[0], roomId: 'rm-1' }] };
    await expect(
      make(vi.fn().mockResolvedValue(json(roomed))).reservations.create(request),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
});
