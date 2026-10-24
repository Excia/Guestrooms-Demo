import { createHttpClient } from './http';
import { createMockClient } from './mock';
import { createScheduleState } from './scheduleData';
import { queryScheduleData } from './scheduleQuery';
import type { SaveClosureRequest } from './types';

const T = '2026-10-16';
const week = { startDate: T, days: 30 } as const;
const mk = () => createMockClient({ today: T });
let serial = 0;
const save = (over: Partial<SaveClosureRequest> = {}): SaveClosureRequest => ({
  roomId: 'rm-208',
  startDate: '2026-11-20',
  endDate: '2026-11-22',
  description: 'Paint',
  requestId: `req-${++serial}-closure`,
  ...over,
});

describe('mock closures', () => {
  it('creates a closure that the next schedule load returns', async () => {
    const api = mk();
    const made = await api.schedule.createClosure(
      save({ startDate: '2026-10-28', endDate: '2026-10-30' }),
    );
    expect(made).toMatchObject({
      kind: 'closure',
      roomId: 'rm-208',
      reason: 'Paint',
      endMarker: false,
    });
    const data = await api.schedule.get(week);
    expect(data.closures.find((c) => c.id === made.id)).toBeDefined();
  });

  it('refuses a closure over another closure or a reservation with a 422 conflict', async () => {
    const api = mk();
    const data = await api.schedule.get(week);
    const cl = data.closures.find((c) => c.id === 'cl-1')!;
    await expect(
      api.schedule.createClosure(
        save({ roomId: cl.roomId, startDate: cl.startDate, endDate: cl.endDate }),
      ),
    ).rejects.toMatchObject({ status: 422, code: 'closure-conflict' });
    const b = data.blocks.find((x) => x.status === 'confirmed')!;
    await expect(
      api.schedule.createClosure(
        save({ roomId: b.roomId, startDate: b.startDate, endDate: b.endDate }),
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: 'closure-conflict',
      details: { roomId: [b.roomId] },
    });
  });

  it('updates a closure without conflicting with itself, and removes it', async () => {
    const api = mk();
    const made = await api.schedule.createClosure(save());
    const changed = await api.schedule.updateClosure({
      ...save({ endDate: '2026-11-23', description: 'Paint and floors' }),
      closureId: made.id,
    });
    expect(changed).toMatchObject({
      id: made.id,
      endDate: '2026-11-23',
      reason: 'Paint and floors',
    });
    await api.schedule.deleteClosure({ closureId: made.id, requestId: `req-${++serial}-delete` });
    const data = await api.schedule.get({ startDate: '2026-11-15', days: 30 });
    expect(data.closures.find((c) => c.id === made.id)).toBeUndefined();
    await expect(
      api.schedule.deleteClosure({ closureId: made.id, requestId: `req-${++serial}-delete` }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an update to a conflicting range and an unknown closure', async () => {
    const api = mk();
    await expect(
      api.schedule.updateClosure({
        ...save({ roomId: 'rm-102', startDate: T, endDate: '2026-10-19' }),
        closureId: 'cl-1',
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      api.schedule.updateClosure({ ...save(), closureId: 'nope' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('replays the same request id and refuses a different request with it', async () => {
    const api = mk();
    const request = save();
    const a = await api.schedule.createClosure(request);
    const b = await api.schedule.createClosure({ ...request });
    expect(b.id).toBe(a.id);
    await expect(
      api.schedule.createClosure({ ...request, description: 'Other' }),
    ).rejects.toMatchObject({ code: 'idempotency-conflict' });
  });

  it('rejects malformed requests before doing anything', async () => {
    const api = mk();
    for (const bad of [
      save({ endDate: '2026-11-20' }),
      save({ startDate: 'x' }),
      save({ description: 'x'.repeat(51) }),
      save({ roomId: '..' }),
      save({ requestId: 'short' }),
    ]) {
      await expect(api.schedule.createClosure(bad)).rejects.toMatchObject({ status: 400 });
    }
  });

  it('refuses a room that does not exist', async () => {
    await expect(mk().schedule.createClosure(save({ roomId: 'rm-none' }))).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('mock closures, review items', () => {
  it('answers 403 forbidden without reservation.edit', async () => {
    const api = createMockClient({ today: T, grant: { role: 'Viewer', permissions: [] } });
    await expect(api.schedule.createClosure(save())).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
    });
    await expect(
      api.schedule.updateClosure({ ...save(), closureId: 'cl-1' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      api.schedule.deleteClosure({ closureId: 'cl-1', requestId: 'req-forbidden-1' }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('drops the end marker when the end date changes, keeps it otherwise', async () => {
    const api = mk();
    const before = (await api.schedule.get(week)).closures.find((c) => c.id === 'cl-1')!;
    expect(before.endMarker).toBe(true);
    const same = await api.schedule.updateClosure({
      closureId: 'cl-1',
      roomId: before.roomId,
      startDate: before.startDate,
      endDate: before.endDate,
      description: 'Renamed',
      requestId: 'req-marker-keep',
    });
    expect(same.endMarker).toBe(true);
    const moved = await api.schedule.updateClosure({
      closureId: 'cl-1',
      roomId: before.roomId,
      startDate: before.startDate,
      endDate: '2026-10-21',
      description: 'Renamed',
      requestId: 'req-marker-drop',
    });
    expect(moved.endMarker).toBe(false);
  });
});

describe('http closures', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const make = (fetchMock: typeof fetch) =>
    createHttpClient('https://api.example.com/v1', { fetch: fetchMock });
  const closure = (r: SaveClosureRequest) => ({
    kind: 'closure',
    id: 'cl-9',
    roomId: r.roomId,
    startDate: r.startDate,
    endDate: r.endDate,
    reason: r.description,
    endMarker: false,
  });

  it('POSTs a create with the idempotency key and checks the answer', async () => {
    const request = save();
    const fetchMock = vi.fn().mockResolvedValue(json(closure(request), 201));
    await expect(make(fetchMock).schedule.createClosure(request)).resolves.toMatchObject({
      id: 'cl-9',
    });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v1/schedule/closures');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(request.requestId);
    await expect(
      make(
        vi.fn().mockResolvedValue(json({ ...closure(request), roomId: 'other' })),
      ).schedule.createClosure(request),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(
      make(vi.fn().mockResolvedValue(json({ id: 'x' }))).schedule.createClosure(request),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('PUTs an update and DELETEs a removal on the closure path', async () => {
    const request = { ...save(), closureId: 'cl-9' };
    const put = vi.fn().mockResolvedValue(json(closure(request)));
    await make(put).schedule.updateClosure(request);
    const [putUrl, putInit] = put.mock.calls[0] as [URL, RequestInit];
    expect(putUrl.pathname).toBe('/v1/schedule/closures/cl-9');
    expect(putInit.method).toBe('PUT');
    await expect(
      make(
        vi.fn().mockResolvedValue(json(closure({ ...request, roomId: 'other' }))),
      ).schedule.updateClosure(request),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    const del = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await make(del).schedule.deleteClosure({ closureId: 'cl-9', requestId: save().requestId });
    const [delUrl, delInit] = del.mock.calls[0] as [URL, RequestInit];
    expect(delUrl.pathname).toBe('/v1/schedule/closures/cl-9');
    expect(delInit.method).toBe('DELETE');
  });

  it('passes a 422 conflict through with its code, and rejects bad requests before fetching', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ message: 'conflict', code: 'closure-conflict' }, 422));
    await expect(make(fetchMock).schedule.createClosure(save())).rejects.toMatchObject({
      status: 422,
      code: 'closure-conflict',
    });
    const never = vi.fn();
    await expect(
      make(never).schedule.createClosure(save({ endDate: '2026-11-19' })),
    ).rejects.toMatchObject({
      code: 'invalid-query',
    });
    await expect(
      make(never).schedule.deleteClosure({ closureId: '..', requestId: 'abcdefgh' }),
    ).rejects.toMatchObject({ code: 'invalid-id' });
    expect(never).not.toHaveBeenCalled();
  });

  it('accepts a schedule answer whose closure has an empty description', async () => {
    const d = queryScheduleData(createScheduleState(T), { startDate: T, days: 7 });
    d.closures = [{ ...d.closures[0], reason: '' }];
    await expect(
      make(vi.fn().mockResolvedValue(json(d))).schedule.get({ startDate: T, days: 7 }),
    ).resolves.toBeDefined();
  });
});
