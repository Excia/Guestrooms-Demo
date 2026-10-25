import { blankRateCategory } from '../app/rateCategories';
import { createHttpClient } from './http';
import { mockRateCategories } from './rateCategoryData';
import { ApiError } from './types';

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { status: 200, ...init });
const make = (fetchMock: typeof fetch) =>
  createHttpClient('https://api.example.com/v1', { fetch: fetchMock });
const sku = { id: 'sku-a', label: 'A' };

describe('http rate category API', () => {
  it('lists categories from /rate-categories', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(mockRateCategories()));
    const list = await make(fetchMock).rateCategories.list();
    expect(list).toHaveLength(mockRateCategories().length);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/rate-categories');
  });

  it('reads the options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ skus: [sku], roomTypes: [sku] }));
    expect(await make(fetchMock).rateCategories.getOptions()).toEqual({
      skus: [sku],
      roomTypes: [sku],
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.example.com/v1/rate-categories/options',
    );
  });

  it('POSTs a new category with its request id as the Idempotency-Key, and PUTs an existing one', async () => {
    const [saved] = mockRateCategories();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(saved)));
    const api = make(fetchMock).rateCategories;
    const fresh = { ...blankRateCategory('2026-10-20', ['rt-a']), name: 'X', sku };
    await api.save({ ...fresh, requestId: 'req-1' });
    await api.save({ ...fresh, id: saved.id });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': 'req-1' }),
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      `https://api.example.com/v1/rate-categories/${saved.id}`,
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PUT' });
  });

  it('POSTs a duplicate with the new name and an Idempotency-Key', async () => {
    const [saved] = mockRateCategories();
    const fetchMock = vi.fn().mockResolvedValue(json(saved));
    await make(fetchMock).rateCategories.duplicate({
      sourceId: 'rc-member',
      name: 'Copy',
      requestId: 'dup-1',
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.example.com/v1/rate-categories/rc-member/duplicate',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': 'dup-1' }),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ name: 'Copy' });
  });

  it('DELETEs a category', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await make(fetchMock).rateCategories.delete('rc-owner');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });

  it('rejects bodies that are not rate categories', async () => {
    const [good] = mockRateCategories();
    for (const bad of [
      { id: 'x' },
      { ...good, kind: 'bundle' },
      { ...good, endDate: 5 },
      { ...good, seasons: [{ ...good.seasons[0], rates: { 'rt-a': { standardBase: 'x' } } }] },
      { ...good, settingNames: [1] },
    ]) {
      const fetchMock = vi.fn().mockResolvedValue(json([bad]));
      await expect(make(fetchMock).rateCategories.list()).rejects.toBeInstanceOf(ApiError);
    }
  });
});
