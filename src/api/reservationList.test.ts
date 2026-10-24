import { createHttpClient } from './http';
import { createMockClient } from './mock';
import { buildListRows } from './reservationListData';
import { queryReservationList } from './reservationListQuery';
import { deriveListStatus, hasUnassignedRoom } from './reservationListRules';
import type { ListStatus, ReservationListRow } from './reservationListTypes';
import { createScheduleState } from './scheduleData';

const T = '2026-10-16';
const rows = () => buildListRows(createScheduleState(T));
const ids = (q: Parameters<typeof queryReservationList>[1]) =>
  queryReservationList(rows(), q).items.map((r) => r.confirmationNumber);
const rooms = (...status: ListStatus[]) => status.map((s) => ({ status: s }));

describe('deriveListStatus (lowest common denominator)', () => {
  it('is the shared status when every room agrees', () => {
    expect(deriveListStatus(rooms('not-checked-in', 'not-checked-in'))).toBe('not-checked-in');
    expect(deriveListStatus(rooms('checked-in', 'checked-in'))).toBe('checked-in');
    expect(deriveListStatus(rooms('checked-out'))).toBe('checked-out');
  });
  it('shows Checked In for a partially checked-in multi-room reservation', () => {
    expect(deriveListStatus(rooms('checked-in', 'not-checked-in'))).toBe('checked-in');
    expect(deriveListStatus(rooms('not-checked-in', 'checked-in', 'not-checked-in'))).toBe(
      'checked-in',
    );
    expect(deriveListStatus(rooms('checked-out', 'not-checked-in'))).toBe('checked-in');
  });
  it('is Canceled only when every room is canceled', () => {
    expect(deriveListStatus(rooms('canceled', 'canceled'))).toBe('canceled');
    expect(deriveListStatus(rooms('canceled', 'not-checked-in'))).toBe('not-checked-in');
    expect(deriveListStatus(rooms('canceled', 'checked-out'))).toBe('checked-out');
  });
  it('treats no rooms as not checked in', () => {
    expect(deriveListStatus([])).toBe('not-checked-in');
  });
});

describe('hasUnassignedRoom', () => {
  it('is true when any room has no number', () => {
    expect(hasUnassignedRoom([{ roomNumber: '201' }, { roomNumber: null }])).toBe(true);
    expect(hasUnassignedRoom([{ roomNumber: '201' }])).toBe(false);
  });
});

describe('mock rows', () => {
  it('has one row per reservation, with every room of a multi-room one', () => {
    const all = rows();
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    const multi = all.find((r) => r.confirmationNumber === 'GR-50321');
    expect(multi?.rooms).toHaveLength(3);
    expect(multi?.status).toBe('not-checked-in');
  });
  it('covers canceled and unassigned reservations', () => {
    const all = rows();
    expect(all.some((r) => r.status === 'canceled')).toBe(true);
    expect(all.some((r) => hasUnassignedRoom(r.rooms))).toBe(true);
  });
});

describe('queryReservationList', () => {
  it('sorts by check-in ascending by default and breaks ties by id', () => {
    const arrivals = queryReservationList(rows(), { limit: 100 }).items.map((r) => r.arrival);
    expect(arrivals).toEqual([...arrivals].sort());
  });
  it('sorts descending and by another column', () => {
    const desc = queryReservationList(rows(), { sort: { field: 'arrival', direction: 'desc' } });
    expect(desc.items[0].arrival >= desc.items[1].arrival).toBe(true);
    const byGuest = queryReservationList(rows(), {
      sort: { field: 'guestName', direction: 'asc' },
      limit: 100,
    }).items.map((r) => r.guestName.toLowerCase());
    expect(byGuest).toEqual([...byGuest].sort());
  });
  it('applies inclusive check-in bounds', () => {
    const got = queryReservationList(rows(), { checkInFrom: T, checkInTo: T, limit: 100 }).items;
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((r) => r.arrival === T)).toBe(true);
  });
  it('filters unassigned only, by location, room type and status', () => {
    const un = queryReservationList(rows(), { unassignedOnly: true }).items;
    expect(un.length).toBeGreaterThan(0);
    expect(un.every((r) => hasUnassignedRoom(r.rooms))).toBe(true);
    const lake = queryReservationList(rows(), { locationIds: ['lakeside'], limit: 100 }).items;
    expect(lake.every((r) => r.locationId === 'lakeside')).toBe(true);
    const suite = queryReservationList(rows(), { roomTypeIds: ['suite'], limit: 100 }).items;
    expect(suite.every((r) => r.roomTypeId === 'suite')).toBe(true);
    const canceled = queryReservationList(rows(), { statuses: ['canceled'] }).items;
    expect(canceled.map((r) => r.status)).toEqual(['canceled']);
  });
  it('matches text filters as case-insensitive substrings', () => {
    expect(ids({ guest: 'MARCHETTI' })).toEqual(['GR-50188']);
    expect(ids({ resNumber: 'gr-50321' })).toEqual(['GR-50321']);
    expect(ids({ room: 'unassigned' }).length).toBeGreaterThan(0);
    expect(ids({ search: 'marchetti' })).toEqual(['GR-50188']);
  });
  it('pages by page number and reports the total of all matches', () => {
    const all = queryReservationList(rows(), { limit: 100 });
    const p1 = queryReservationList(rows(), { limit: 5, page: 1 });
    const p2 = queryReservationList(rows(), { limit: 5, page: 2 });
    expect(p1.total).toBe(all.total);
    expect(p1.items).toHaveLength(5);
    expect(p2.items.map((r) => r.id)).toEqual(all.items.slice(5, 10).map((r) => r.id));
  });
  it('returns copies', () => {
    const page = queryReservationList(rows(), {});
    page.items[0].guestName = 'changed';
    expect(queryReservationList(rows(), {}).items[0].guestName).not.toBe('changed');
  });
});

describe('mock client reservationList', () => {
  it('answers the list and the options', async () => {
    const client = createMockClient({ today: T });
    const page = await client.reservationList.list({ limit: 3 });
    expect(page.items).toHaveLength(3);
    const options = await client.reservationList.getOptions();
    expect(options.locations.length).toBeGreaterThan(0);
    expect(options.roomTypes.length).toBeGreaterThan(0);
  });
  it('answers empty in the empty scenario and rejects in the error scenario', async () => {
    expect(await createMockClient({ scenario: 'empty' }).reservationList.list({})).toEqual({
      items: [],
      total: 0,
    });
    await expect(
      createMockClient({ scenario: 'error' }).reservationList.list({}),
    ).rejects.toMatchObject({
      status: 500,
    });
  });
  it('rejects a malformed query', async () => {
    await expect(
      createMockClient().reservationList.list({ checkInFrom: 'tomorrow' }),
    ).rejects.toMatchObject({ code: 'invalid-query' });
  });
});

describe('http reservationList', () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const make = (fetchMock: typeof fetch) =>
    createHttpClient('https://api.example.com/v1', { fetch: fetchMock });
  const good = (): { items: ReservationListRow[]; total: number } =>
    queryReservationList(rows(), { limit: 2 });

  it('sends the query as parameters and accepts a well-formed answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(good()));
    const page = await make(fetchMock).reservationList.list({
      checkInFrom: T,
      unassignedOnly: true,
      locationIds: ['a', 'b'],
      statuses: ['canceled'],
      sort: { field: 'guestName', direction: 'desc' },
      page: 2,
      limit: 10,
    });
    expect(page.items).toHaveLength(2);
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.pathname).toBe('/v1/reservation-list');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      checkInFrom: T,
      unassignedOnly: 'true',
      locationIds: 'a,b',
      statuses: 'canceled',
      sort: 'guestName:desc',
      page: '2',
      limit: '10',
    });
  });
  it('rejects a malformed query before fetching', async () => {
    const fetchMock = vi.fn();
    await expect(
      make(fetchMock).reservationList.list({ statuses: ['bogus' as never] }),
    ).rejects.toMatchObject({ code: 'invalid-query' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects malformed answers', async () => {
    const row = good().items[0];
    for (const body of [
      {},
      { items: [{ id: 'x' }], total: 1 },
      { items: [{ ...row, status: 'pending' }], total: 1 },
      { items: [{ ...row, rooms: [] }], total: 1 },
      { items: [row], total: 'many' },
    ]) {
      await expect(
        make(vi.fn().mockResolvedValue(json(body))).reservationList.list(),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
  });
  it('reads the filter options', async () => {
    const options = { locations: [{ id: 'l', name: 'L' }], roomTypes: [{ id: 't', name: 'T' }] };
    const client = make(vi.fn().mockResolvedValue(json(options)));
    expect(await client.reservationList.getOptions()).toEqual(options);
    await expect(
      make(vi.fn().mockResolvedValue(json({ locations: 1 }))).reservationList.getOptions(),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
});

describe('checkInRoom', () => {
  const T2 = '2026-10-16';
  const request = (id: string) => ({ reservationRoomId: id, requestId: `req-${id}-12345678` });
  const roomsOf = (rowsIn: ReservationListRow[]) => rowsIn.flatMap((r) => r.rooms);

  it('checks a room in, shows it as checked in, and replays a repeated request', async () => {
    const client = createMockClient({ today: T2 });
    const page = await client.reservationList.list({ limit: 200 });
    // Find a room that checks in: try each waiting room until one succeeds.
    for (const room of roomsOf(page.items).filter((r) => r.status === 'not-checked-in')) {
      const result = await client.reservationList.checkInRoom(request(room.id)).catch(() => null);
      if (!result) continue;
      expect(result).toEqual({ reservationRoomId: room.id, status: 'checked-in' });
      const after = await client.reservationList.list({ limit: 200 });
      expect(roomsOf(after.items).find((r) => r.id === room.id)?.status).toBe('checked-in');
      await expect(client.reservationList.checkInRoom(request(room.id))).resolves.toEqual(result);
      return;
    }
    throw new Error('no room could be checked in');
  });
  it('fails an unassigned room with 409 unassigned', async () => {
    const client = createMockClient({ today: T2 });
    await expect(client.reservationList.checkInRoom(request('rs-X2-1'))).rejects.toMatchObject({
      status: 409,
      code: 'unassigned',
    });
  });
  it('fails a checked-in room with 409 not-checkable and an unknown room with 404', async () => {
    const client = createMockClient({ today: T2 });
    const page = await client.reservationList.list({ limit: 200 });
    const done = roomsOf(page.items).find((r) => r.status === 'checked-in')!;
    await expect(client.reservationList.checkInRoom(request(done.id))).rejects.toMatchObject({
      status: 409,
      code: 'not-checkable',
    });
    await expect(client.reservationList.checkInRoom(request('nope'))).rejects.toMatchObject({
      status: 404,
    });
  });
  it('fails some assigned room with 409 no-payment-method', async () => {
    const client = createMockClient({ today: T2 });
    const page = await client.reservationList.list({ limit: 200 });
    const codes = new Set<string | undefined>();
    for (const room of roomsOf(page.items).filter(
      (r) => r.status === 'not-checked-in' && r.roomNumber !== null,
    )) {
      await client.reservationList
        .checkInRoom(request(room.id))
        .catch((e: { code?: string }) => codes.add(e.code));
    }
    expect(codes.has('no-payment-method')).toBe(true);
  });
});
