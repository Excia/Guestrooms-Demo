import { mockReservations } from './mockData';
import { queryReservations } from './reservationQuery';

const ids = (q: Parameters<typeof queryReservations>[1], limit?: number) =>
  queryReservations(mockReservations, q, limit).items.map((r) => r.id);

describe('queryReservations', () => {
  it('filters by status and search (name or confirmation, case-insensitive)', () => {
    expect(ids({ status: 'checked-in' })).toHaveLength(2);
    expect(ids({ search: 'ELLISON' })).toEqual(['res-1001']);
    expect(ids({ search: 'gr-48214' })).toEqual(['res-1002']);
    expect(ids({ status: 'cancelled', search: 'ellison' })).toEqual([]);
  });
  it('applies inclusive date bounds', () => {
    expect(ids({ arrivalFrom: '2026-10-16', arrivalTo: '2026-10-16' })).toEqual([
      'res-1001',
      'res-1002',
    ]);
    expect(ids({ departureFrom: '2026-10-19' })).toEqual(['res-1001', 'res-1006']);
    expect(ids({ departureTo: '2026-10-12' })).toEqual(['res-1005']);
  });
  it('sorts ascending by arrival by default, ties broken by id', () => {
    expect(ids({})[0]).toBe('res-1005');
    const arrivals = queryReservations(mockReservations).items.map((r) => r.arrival);
    expect(arrivals).toEqual([...arrivals].sort());
  });
  it('sorts descending and by other fields', () => {
    expect(ids({ sort: { field: 'arrival', direction: 'desc' } })[0]).toBe('res-1006');
    expect(ids({ sort: { field: 'guestName', direction: 'asc' } })[0]).toBe('res-1004');
  });
  it('pages with cursors and reports total and nextCursor', () => {
    const first = queryReservations(mockReservations, { limit: 4 });
    expect(first.items).toHaveLength(4);
    expect(first.total).toBe(6);
    expect(first.nextCursor).toBe('4');
    const second = queryReservations(mockReservations, { limit: 4, cursor: first.nextCursor });
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeUndefined();
    const all = [...first.items, ...second.items].map((r) => r.id);
    expect(new Set(all).size).toBe(6);
  });
  it('clamps the limit and rejects bad cursors', () => {
    expect(queryReservations(mockReservations, { limit: 0 }).items.length).toBeGreaterThan(0);
    expect(queryReservations(mockReservations, { limit: 1000 }, 20, 3).items).toHaveLength(3);
    expect(() => queryReservations(mockReservations, { cursor: 'abc' })).toThrow(/cursor/);
    expect(() => queryReservations(mockReservations, { cursor: '-1' })).toThrow(/cursor/);
  });
  it('returns an empty page past the end', () => {
    expect(queryReservations(mockReservations, { cursor: '99' })).toEqual({ items: [], total: 6 });
  });
  it('returns copies', () => {
    const page = queryReservations(mockReservations);
    page.items[0].guestName = 'X';
    expect(mockReservations.some((r) => r.guestName === 'X')).toBe(false);
  });
});
