import { roomsFreeForStay } from '../app/addRoom';
import { createHttpClient } from './http';
import { createMockClient } from './mock';
import type { ReservationDetail } from './types';

const T = '2026-10-16';
const mk = (o = {}) => createMockClient({ today: T, ...o });
let n = 0;
const rid = () => `req-${++n}-edit0`;

/** A room free for the whole stay of the reservation, from the schedule itself. */
async function freeRoom(c: ReturnType<typeof mk>, d: ReservationDetail, skip = 0) {
  const grid = await c.schedule.get({ startDate: d.arrival, days: 30 });
  return roomsFreeForStay(grid.rooms, grid.blocks, grid.closures, d.arrival, d.departure)[skip];
}

describe('mock reservations.addRoom', () => {
  it('adds a room for the whole stay: details, schedule and version follow', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-3');
    const room = await freeRoom(c, before);
    const after = await c.reservations.addRoom({
      requestId: rid(),
      reservationId: 'rs-3',
      version: before.version,
      roomId: room.id,
      adults: 3,
      children: 1,
      leadOccupant: { name: 'Pat Guest' },
    });
    expect(after.rooms).toHaveLength(2);
    const added = after.rooms[1];
    expect(added).toMatchObject({
      roomId: room.id,
      arrival: before.arrival,
      departure: before.departure,
      status: 'nyci',
      adults: 3,
      children: 1,
      leadOccupant: { name: 'Pat Guest' },
    });
    expect(after.version).not.toBe(before.version);
    // totals are the sum of the rooms
    expect(after.adults).toBe(before.adults + 3);
    expect(after.children).toBe(before.children + 1);
    expect(after.stay.lines.length).toBe(before.stay.lines.length * 2);
    const grid = await c.schedule.get({ startDate: before.arrival, days: 30 });
    const blocks = grid.blocks.filter((b) => b.reservationId === 'rs-3');
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.roomCount === 2)).toBe(true);
  });

  it('adds an unassigned room when none is chosen', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-3');
    const after = await c.reservations.addRoom({
      requestId: rid(),
      reservationId: 'rs-3',
      version: before.version,
      adults: 1,
      children: 0,
    });
    expect(after.rooms[1]).toMatchObject({ roomId: null, roomNumber: null });
  });

  it('keeps the party of existing rooms of a multi-room reservation', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-7');
    expect(before.adults).toBe(4);
    expect(before.children).toBe(2);
    const room = await freeRoom(c, before);
    const after = await c.reservations.addRoom({
      requestId: rid(),
      reservationId: 'rs-7',
      version: before.version,
      roomId: room.id,
      adults: 2,
      children: 0,
    });
    expect(after.rooms).toHaveLength(4);
    expect(after.adults).toBe(6);
    expect(after.children).toBe(2);
  });

  it('409 conflict for a booked room, with nothing changed', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-3');
    await expect(
      c.reservations.addRoom({
        requestId: rid(),
        reservationId: 'rs-3',
        version: before.version,
        roomId: 'rm-201', // its own room
        adults: 1,
        children: 0,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'conflict' });
    const after = await c.reservations.getDetail('rs-3');
    expect(after.rooms).toHaveLength(1);
    expect(after.version).toBe(before.version);
  });

  it('409 stale, 404, 400 and 403', async () => {
    const c = mk();
    const { version } = await c.reservations.getDetail('rs-3');
    const base = { reservationId: 'rs-3', adults: 1, children: 0 };
    await expect(
      c.reservations.addRoom({ ...base, requestId: rid(), version: 'old' }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    await expect(
      c.reservations.addRoom({ ...base, requestId: rid(), version, roomId: 'nope' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      c.reservations.addRoom({ ...base, reservationId: 'rs-nope', requestId: rid(), version }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      c.reservations.addRoom({ ...base, requestId: rid(), version, adults: 0 }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
    await expect(
      c.reservations.addRoom({ ...base, requestId: 'x', version }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('409 not-editable once the night audit has posted a charge (the legacy rule)', async () => {
    // rs-2 is checked in since the 13th: the audited days are posted on its folio.
    const c = createMockClient({ today: T });
    const { version } = await c.reservations.getDetail('rs-2');
    await expect(
      c.reservations.addRoom({
        requestId: rid(),
        reservationId: 'rs-2',
        version,
        adults: 1,
        children: 0,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'not-editable' });
  });

  it('replays the same request id and refuses the id for a different request', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-3');
    const room = await freeRoom(c, before);
    const request = {
      requestId: rid(),
      reservationId: 'rs-3',
      version: before.version,
      roomId: room.id,
      adults: 1,
      children: 0,
    };
    const first = await c.reservations.addRoom(request);
    const again = await c.reservations.addRoom(request);
    expect(again).toEqual(first);
    expect(again.rooms).toHaveLength(2);
    await expect(c.reservations.addRoom({ ...request, adults: 2 })).rejects.toMatchObject({
      status: 409,
      code: 'idempotency-conflict',
    });
  });
});

describe('mock reservations.updateGuests', () => {
  const base = async (c: ReturnType<typeof mk>) => {
    const d = await c.reservations.getDetail('rs-3');
    return {
      requestId: rid(),
      reservationId: 'rs-3',
      reservationRoomId: d.rooms[0].id,
      version: d.version,
    };
  };

  it('sets the party and the named guests of a room that has not checked in', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-3');
    const members = await c.members.search({ q: 'Daniel' });
    const after = await c.reservations.updateGuests({
      ...(await base(c)),
      adults: 3,
      children: 1,
      guests: [
        {
          kind: 'adult',
          name: members.items[0].name,
          memberId: members.items[0].id,
          sendConfirmation: true,
        },
        { kind: 'child', name: 'Kid One' },
      ],
    });
    expect(after.adults).toBe(3);
    expect(after.children).toBe(1);
    expect(after.rooms[0].guests).toEqual([
      expect.objectContaining({
        kind: 'adult',
        name: members.items[0].name,
        confirmationSent: true,
      }),
      expect.objectContaining({ kind: 'child', name: 'Kid One' }),
    ]);
    expect(after.version).not.toBe(before.version);
  });

  it('keeps the ids of guests that stay, and does not resend a sent confirmation', async () => {
    const c = mk();
    const members = await c.members.search({ q: 'Daniel' });
    const m = members.items[0];
    const guest = { kind: 'adult' as const, name: m.name, memberId: m.id };
    const one = await c.reservations.updateGuests({
      ...(await base(c)),
      adults: 2,
      children: 0,
      guests: [{ ...guest, sendConfirmation: true }],
    });
    const two = await c.reservations.updateGuests({
      ...(await base(c)),
      adults: 3,
      children: 0,
      guests: [guest],
    });
    expect(two.rooms[0].guests?.[0].id).toBe(one.rooms[0].guests?.[0].id);
    expect(two.rooms[0].guests?.[0].confirmationSent).toBe(true);
  });

  it('is read-only once the room is checked in', async () => {
    const c = mk();
    const d = await c.reservations.getDetail('rs-2');
    await expect(
      c.reservations.updateGuests({
        requestId: rid(),
        reservationId: 'rs-2',
        reservationRoomId: d.rooms[0].id,
        version: d.version,
        adults: 2,
        children: 0,
        guests: [],
      }),
    ).rejects.toMatchObject({ status: 409, code: 'not-editable' });
  });

  it('rejects more named guests than the party leaves room for, a stale version and an unknown room', async () => {
    const c = mk();
    await expect(
      c.reservations.updateGuests({
        ...(await base(c)),
        adults: 1,
        children: 0,
        guests: [{ kind: 'adult', name: 'Too Many' }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      c.reservations.updateGuests({
        ...(await base(c)),
        version: 'old',
        adults: 2,
        children: 0,
        guests: [],
      }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    await expect(
      c.reservations.updateGuests({
        ...(await base(c)),
        reservationRoomId: 'rr-nope',
        adults: 2,
        children: 0,
        guests: [],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('replays a repeated request', async () => {
    const c = mk();
    const request = { ...(await base(c)), adults: 3, children: 0, guests: [] };
    const first = await c.reservations.updateGuests(request);
    expect(await c.reservations.updateGuests(request)).toEqual(first);
  });
});

describe('mock reservations.updateNotes', () => {
  it('saves both notes and bumps the version', async () => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-3');
    const after = await c.reservations.updateNotes({
      requestId: rid(),
      reservationId: 'rs-3',
      version: before.version,
      publicNotes: 'Late arrival',
      privateNotes: '',
    });
    expect(after).toMatchObject({ publicNotes: 'Late arrival', privateNotes: '' });
    expect(after.version).not.toBe(before.version);
    expect((await c.reservations.getDetail('rs-3')).publicNotes).toBe('Late arrival');
  });

  it('409 stale, 400 for notes that are too long, 404, and replays', async () => {
    const c = mk();
    const { version } = await c.reservations.getDetail('rs-3');
    const base = { reservationId: 'rs-3', publicNotes: 'a', privateNotes: 'b' };
    await expect(
      c.reservations.updateNotes({ ...base, requestId: rid(), version: 'old' }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    await expect(
      c.reservations.updateNotes({
        ...base,
        requestId: rid(),
        version,
        publicNotes: 'x'.repeat(2001),
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      c.reservations.updateNotes({ ...base, reservationId: 'rs-nope', requestId: rid(), version }),
    ).rejects.toMatchObject({ status: 404 });
    const request = { ...base, requestId: rid(), version };
    const first = await c.reservations.updateNotes(request);
    expect(await c.reservations.updateNotes(request)).toEqual(first);
  });
});

describe('http add room, guests and notes', () => {
  const detail = async (): Promise<ReservationDetail> => {
    const c = mk();
    const before = await c.reservations.getDetail('rs-3');
    const room = await freeRoom(c, before);
    return c.reservations.addRoom({
      requestId: rid(),
      reservationId: 'rs-3',
      version: before.version,
      roomId: room.id,
      adults: 2,
      children: 0,
    });
  };
  const client = (body: unknown) => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200 })),
    );
    return { fetchMock, api: createHttpClient('https://api.test', { fetch: fetchMock }) };
  };

  it('posts the room with the idempotency key and accepts an answer with one more room', async () => {
    const d = await detail();
    const { fetchMock, api } = client(d);
    const request = {
      requestId: rid(),
      reservationId: 'rs-3',
      version: 'r1',
      roomId: d.rooms[1].roomId,
      adults: 2,
      children: 0,
    };
    expect((await api.reservations.addRoom(request)).rooms).toHaveLength(2);
    const [url, init = {}] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.test/reservations/rs-3/rooms');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(request.requestId);
  });

  it('rejects an answer without the added room, or for another reservation', async () => {
    const d = await detail();
    const request = {
      requestId: rid(),
      reservationId: 'rs-3',
      version: 'r1',
      adults: 1,
      children: 0,
    };
    await expect(
      client({ ...d, rooms: [d.rooms[0]] }).api.reservations.addRoom(request),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(
      client({ ...d, id: 'rs-9' }).api.reservations.addRoom(request),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(
      client(d).api.reservations.addRoom({ ...request, roomId: 'rm-other' }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('refuses a malformed request before sending it', async () => {
    const { fetchMock, api } = client({});
    await expect(
      api.reservations.addRoom({
        requestId: rid(),
        reservationId: '..',
        version: 'r1',
        adults: 1,
        children: 0,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      api.reservations.updateGuests({
        requestId: rid(),
        reservationId: 'rs-3',
        reservationRoomId: 'rr-3',
        version: 'r1',
        adults: 2,
        children: 0,
        guests: [{ kind: 'adult', name: 'A', email: 'not-an-email' }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks that guests and notes answers show what was saved', async () => {
    const c = mk();
    const d = await c.reservations.getDetail('rs-3');
    const guests = {
      requestId: rid(),
      reservationId: 'rs-3',
      reservationRoomId: d.rooms[0].id,
      version: d.version,
      adults: 3,
      children: 0,
      guests: [{ kind: 'adult' as const, name: 'Pat' }],
    };
    const saved = await c.reservations.updateGuests(guests);
    const ok = client(saved);
    await ok.api.reservations.updateGuests(guests);
    expect(String(ok.fetchMock.mock.calls[0][0])).toBe(
      `https://api.test/reservation-rooms/${d.rooms[0].id}/guests`,
    );
    expect(ok.fetchMock.mock.calls[0][1]?.method).toBe('PUT');
    await expect(client(d).api.reservations.updateGuests(guests)).rejects.toMatchObject({
      code: 'invalid-response',
    });
    const notes = {
      requestId: rid(),
      reservationId: 'rs-3',
      version: d.version,
      publicNotes: 'p',
      privateNotes: 'q',
    };
    await expect(client(d).api.reservations.updateNotes(notes)).rejects.toMatchObject({
      code: 'invalid-response',
    });
    const { api } = client({ ...d, publicNotes: 'p', privateNotes: 'q' });
    expect((await api.reservations.updateNotes(notes)).publicNotes).toBe('p');
  });

  it('rejects a malformed per-room party in any detail answer', async () => {
    const d = await detail();
    const bad = {
      ...d,
      rooms: [
        { ...d.rooms[0], guests: [{ id: '', kind: 'adult', name: 'x', memberNumber: null }] },
        d.rooms[1],
      ],
    };
    await expect(client(bad).api.reservations.getDetail('rs-3')).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });
});
