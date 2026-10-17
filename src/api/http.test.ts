import { createHttpClient } from './http';
import { ApiError } from './types';

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { status: 200, ...init });
const page = { items: [], total: 0 };
const grant = { role: 'Manager', permissions: ['page.dashboard'] };

const make = (fetchMock: typeof fetch, extra = {}) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock, ...extra });

afterEach(() => {
  vi.useRealTimers();
});

describe('request building', () => {
  it('requests paths under the base URL and serializes the query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(page));
    await make(fetchMock).reservations.list({
      status: 'confirmed',
      search: 'ada',
      arrivalFrom: '2026-10-01',
      arrivalTo: '2026-10-31',
      departureFrom: '2026-10-02',
      departureTo: '2026-11-01',
      sort: { field: 'departure', direction: 'desc' },
      cursor: '4',
      limit: 4,
    });
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.origin + url.pathname).toBe('https://api.example.com/v1/reservations');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: 'confirmed',
      search: 'ada',
      arrivalFrom: '2026-10-01',
      arrivalTo: '2026-10-31',
      departureFrom: '2026-10-02',
      departureTo: '2026-11-01',
      sort: 'departure:desc',
      cursor: '4',
      limit: '4',
    });
  });
  it('omits unset params and encodes ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: 'a/b' }));
    await make(fetchMock)
      .reservations.get('a/b')
      .catch(() => {});
    expect((fetchMock.mock.calls[0][0] as URL).pathname).toBe('/v1/reservations/a%2Fb');
    await make(fetchMock.mockResolvedValue(json(page))).reservations.list();
    expect((fetchMock.mock.calls[1][0] as URL).search).toBe('');
  });
  it('sends extra headers from getHeaders', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    await make(fetchMock, {
      getHeaders: async () => ({ Authorization: 'Bearer t' }),
    })
      .dashboard.getStats()
      .catch(() => {});
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer t',
    });
  });
});

describe('errors', () => {
  it('maps non-2xx to ApiError with status and status text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 404, statusText: 'Not Found' }));
    await expect(make(fetchMock).dashboard.getStats()).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Not Found',
    });
  });
  it('reads message, code and field details from a JSON error body', async () => {
    const body = { message: 'Invalid', code: 'validation', details: { search: ['too short'] } };
    const fetchMock = vi.fn().mockResolvedValue(json(body, { status: 422 }));
    await expect(make(fetchMock).reservations.list()).rejects.toMatchObject({
      status: 422,
      message: 'Invalid',
      code: 'validation',
      details: { search: ['too short'] },
    });
  });
  it('turns an HTML error body into an ApiError, not a SyntaxError', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
      );
    const err = await make(fetchMock)
      .dashboard.getStats()
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, message: 'Bad Gateway' });
  });
  it('turns a non-JSON 200 (SPA fallback) into an ApiError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<!doctype html>', { status: 200 }));
    const err = await make(fetchMock)
      .dashboard.getStats()
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 200, code: 'invalid-response' });
  });
  it('rejects empty and 204 bodies where data is required', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(null, { status: 204 }));
    await expect(make(fetchMock).dashboard.getStats()).rejects.toMatchObject({
      code: 'invalid-response',
    });
    await expect(make(fetchMock).reservations.list()).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });
  it('handles an error status with an empty body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    await expect(make(fetchMock).dashboard.getStats()).rejects.toMatchObject({ status: 500 });
  });
  it('maps network failures to ApiError status 0', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('failed'));
    const err = await make(fetchMock)
      .permissions.getGrant()
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, code: 'network' });
  });
  it('calls onUnauthorized on 401 and still throws', async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    await expect(make(fetchMock, { onUnauthorized }).dashboard.getStats()).rejects.toMatchObject({
      status: 401,
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
  it('does not call onUnauthorized for other errors', async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
    await make(fetchMock, { onUnauthorized })
      .dashboard.getStats()
      .catch(() => {});
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('hardening', () => {
  it.each(['', ' ', '.', '..'])('rejects reservation id %j without a request', async (id) => {
    const fetchMock = vi.fn();
    await expect(make(fetchMock).reservations.get(id)).rejects.toMatchObject({
      status: 400,
      code: 'invalid-id',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('trims the search term', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json(page));
    await make(fetchMock).reservations.list({ search: '  ada ' });
    expect((fetchMock.mock.calls[0][0] as URL).searchParams.get('search')).toBe('ada');
    await make(fetchMock).reservations.list({ search: '   ' });
    expect((fetchMock.mock.calls[1][0] as URL).searchParams.has('search')).toBe(false);
  });
  it('defaults credentials to same-origin and lets callers opt in to include', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    await make(fetchMock)
      .dashboard.getStats()
      .catch(() => {});
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
    await make(fetchMock, { credentials: 'include' })
      .dashboard.getStats()
      .catch(() => {});
    expect(fetchMock.mock.calls[1][1].credentials).toBe('include');
  });
  it('reports a failing getHeaders as its own error with the cause', async () => {
    const boom = new Error('token store down');
    const fetchMock = vi.fn();
    const err = await make(fetchMock, {
      getHeaders: () => Promise.reject(boom),
    })
      .dashboard.getStats()
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, code: 'headers' });
    expect(err.cause).toBe(boom);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('keeps the cause on network errors', async () => {
    const boom = new TypeError('failed');
    const err = await make(vi.fn().mockRejectedValue(boom))
      .dashboard.getStats()
      .catch((e) => e);
    expect(err.cause).toBe(boom);
  });
  it('treats a signal aborted during getHeaders as an abort, without calling fetch', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn();
    const promise = make(fetchMock, {
      getHeaders: async () => {
        controller.abort();
        return {};
      },
    }).dashboard.getStats({ signal: controller.signal });
    const err = await promise.catch((e) => e);
    expect(err.name).toBe('AbortError');
    expect(err).not.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('lets the caller abort win when it races the timeout', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const settled = make(
      vi
        .fn()
        .mockImplementation(
          (_u: URL, init: RequestInit) =>
            new Promise((_res, rej) =>
              init.signal?.addEventListener('abort', () =>
                rej(new DOMException('x', 'AbortError')),
              ),
            ),
        ),
      { timeoutMs: 50 },
    )
      .dashboard.getStats({ signal: controller.signal })
      .catch((e) => e);
    await vi.advanceTimersByTimeAsync(0);
    vi.advanceTimersByTime(50);
    controller.abort();
    const err = await settled;
    expect(err.name).toBe('AbortError');
    expect(err).not.toBeInstanceOf(ApiError);
  });
});

describe('response validation', () => {
  const reservation = {
    id: 'r1',
    confirmationNumber: 'GR-1',
    guestName: 'Ada',
    arrival: '2026-10-16',
    departure: '2026-10-17',
    status: 'confirmed',
  };
  const stats = {
    arrivalsToday: 1,
    departuresToday: 1,
    inHouse: 1,
    occupancyPercent: 50,
    unassignedChargesCount: 0,
    totalRevenue: 100,
    totalNights: 1,
    averageRate: 100,
    rateCategories: [{ id: 'a' }],
    roomBlocks: [],
  };
  const bad = (body: unknown) => vi.fn().mockResolvedValue(json(body));
  it('accepts well-formed pages, reservations and stats', async () => {
    expect(
      (await make(bad({ items: [reservation], total: 1, nextCursor: '1' })).reservations.list())
        .items,
    ).toHaveLength(1);
    expect((await make(bad(reservation)).reservations.get('r1')).id).toBe('r1');
    expect((await make(bad(stats)).dashboard.getStats()).totalNights).toBe(1);
  });
  it.each([
    ['an item without an id', { items: [{ ...reservation, id: 1 }], total: 1 }],
    ['an item with an unknown status', { items: [{ ...reservation, status: 'lost' }], total: 1 }],
    ['a non-object item', { items: [null], total: 1 }],
    ['a non-numeric total', { items: [], total: '0' }],
    ['a non-string nextCursor', { items: [], total: 0, nextCursor: 5 }],
  ])('rejects a page with %s', async (_l, body) => {
    await expect(make(bad(body)).reservations.list()).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });
  it('rejects a bad reservation and bad stats', async () => {
    await expect(
      make(bad({ ...reservation, status: 'x' })).reservations.get('r1'),
    ).rejects.toMatchObject({
      code: 'invalid-response',
    });
    await expect(make(bad({})).dashboard.getStats()).rejects.toMatchObject({
      code: 'invalid-response',
    });
    await expect(
      make(bad({ ...stats, totalNights: 'many' })).dashboard.getStats(),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(
      make(bad({ ...stats, roomBlocks: [1] })).dashboard.getStats(),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
  it('rejects malformed reservation pages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([]));
    await expect(make(fetchMock).reservations.list()).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });
  it('accepts a valid grant', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(grant));
    expect(await make(fetchMock).permissions.getGrant()).toEqual(grant);
  });
  it("accepts the 'all' sentinel", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ role: 'x', permissions: 'all' }));
    expect((await make(fetchMock).permissions.getGrant()).permissions).toBe('all');
  });
  it.each([
    ['null', null],
    ['an empty object', {}],
    ['a string', 'all'],
    ['a missing role', { permissions: [] }],
    ['a malformed role', { role: 42, permissions: [] }],
    ['a non-array permissions', { role: 'x', permissions: { a: 1 } }],
    ['an unknown sentinel', { role: 'x', permissions: 'ALL' }],
    ['non-string entries', { role: 'x', permissions: [1] }],
  ])('rejects a grant that is %s', async (_label, body) => {
    const fetchMock = vi.fn().mockResolvedValue(json(body));
    await expect(make(fetchMock).permissions.getGrant()).rejects.toMatchObject({
      name: 'ApiError',
      code: 'invalid-response',
    });
  });
});

describe('cancellation and timeout', () => {
  const abortableFetch = () =>
    vi.fn().mockImplementation(
      (_url: URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          if (init.signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

  it('passes a signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    await make(fetchMock)
      .dashboard.getStats()
      .catch(() => {});
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('rethrows a caller abort as AbortError, not ApiError', async () => {
    const controller = new AbortController();
    const promise = make(abortableFetch()).dashboard.getStats({ signal: controller.signal });
    controller.abort();
    const err = await promise.catch((e) => e);
    expect(err).not.toBeInstanceOf(ApiError);
    expect(err.name).toBe('AbortError');
  });
  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const err = await make(abortableFetch())
      .reservations.get('x', { signal: controller.signal })
      .catch((e) => e);
    expect(err.name).toBe('AbortError');
  });
  it('maps a timeout to ApiError status 0 code timeout', async () => {
    vi.useFakeTimers();
    const promise = make(abortableFetch(), { timeoutMs: 50 }).dashboard.getStats();
    const settled = promise.catch((e) => e);
    await vi.advanceTimersByTimeAsync(50);
    const err = await settled;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, code: 'timeout' });
  });
  it('does not time out once the response arrived', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    await make(fetchMock, { timeoutMs: 50 })
      .dashboard.getStats()
      .catch(() => {});
    expect(vi.getTimerCount()).toBe(0);
  });
});
