import { createHttpClient } from './http';
import { createMockClient } from './mock';
import { mockCustomReports } from './reportsData';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });

describe('http reports.listCustom', () => {
  it('requests /reports/custom and accepts a well-formed list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(mockCustomReports()));
    const list = await make(fetchMock).reports.listCustom();
    expect(list).toHaveLength(mockCustomReports().length);
    expect((fetchMock.mock.calls[0][0] as URL).pathname).toBe('/v1/reports/custom');
  });

  it('rejects a body that is not a list of reports', async () => {
    const bad = [{ id: 'x', name: 'No creator', updatedAt: '2026-10-01T00:00:00Z' }];
    await expect(
      make(vi.fn().mockResolvedValue(json(bad))).reports.listCustom(),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(
      make(vi.fn().mockResolvedValue(json({ items: [] }))).reports.listCustom(),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('rejects an updatedAt that is not a date', async () => {
    const bad = [{ ...mockCustomReports()[0], updatedAt: 'yesterday' }];
    await expect(
      make(vi.fn().mockResolvedValue(json(bad))).reports.listCustom(),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });
});

describe('mock reports.listCustom', () => {
  it('answers sample reports, or none in the empty scenario', async () => {
    expect(await createMockClient().reports.listCustom()).toHaveLength(5);
    expect(await createMockClient({ scenario: 'empty' }).reports.listCustom()).toEqual([]);
  });
});
