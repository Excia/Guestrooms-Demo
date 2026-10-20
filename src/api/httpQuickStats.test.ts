import { createHttpClient } from './http';
import { buildQuickStats } from './quickStatsData';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

describe('http getQuickStats', () => {
  it('sends the view and its period as query parameters', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(buildQuickStats({ view: 'week', startDate: '2026-10-11' })));
    await make(fetchMock).dashboard.getQuickStats({ view: 'week', startDate: '2026-10-11' });
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.pathname).toBe('/v1/dashboard/quick-stats');
    expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'week', startDate: '2026-10-11' });
  });

  it('accepts a well-formed response for each view', async () => {
    for (const query of [
      { view: 'day', date: '2026-10-16' },
      { view: 'week', startDate: '2026-10-11' },
      { view: 'month', month: '2026-10' },
    ] as const) {
      const fetchMock = vi.fn().mockResolvedValue(json(buildQuickStats(query)));
      expect((await make(fetchMock).dashboard.getQuickStats(query)).view).toBe(query.view);
    }
  });

  it('rejects a malformed query before fetching', async () => {
    const fetchMock = vi.fn();
    await expect(
      make(fetchMock).dashboard.getQuickStats({ view: 'day', date: 'tomorrow' }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid-query' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ view: 'day', occupancy: {} }));
    await expect(
      make(fetchMock).dashboard.getQuickStats({ view: 'day', date: '2026-10-16' }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
});
