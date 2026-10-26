import { changeLogParams, parseChangeEventTypes, parseChangeLogPage } from './httpChangeLog';

describe('changeLogParams', () => {
  it('maps the query to URL parameters', () => {
    expect(
      changeLogParams({
        page: 'rooms',
        sort: { field: 'time', direction: 'asc' },
        dateFrom: '2026-01-01',
        changeTypes: ['created', 'deleted'],
        actionBy: ' Sam ',
        pageNumber: 2,
        limit: 25,
      }),
    ).toMatchObject({
      page: 'rooms',
      sort: 'time:asc',
      dateFrom: '2026-01-01',
      changeTypes: 'created,deleted',
      actionBy: 'Sam',
      pageNumber: '2',
      limit: '25',
    });
  });
  it('sends the record id', () => {
    expect(changeLogParams({ page: 'rooms', recordId: 'room-100' })).toMatchObject({
      recordId: 'room-100',
    });
  });
  it('leaves unset values out', () => {
    expect(changeLogParams({ page: 'rooms' })).toMatchObject({
      sort: undefined,
      changeTypes: undefined,
      pageNumber: undefined,
    });
  });
});

describe('answers', () => {
  const entry = {
    id: '1',
    date: '2026-01-01',
    time: '09:00',
    changeType: 'created',
    description: 'x',
    actionBy: 'Sam',
  };
  it('accepts a well-formed page and event types', () => {
    expect(parseChangeLogPage({ items: [entry], total: 1 }, 200).total).toBe(1);
    expect(parseChangeEventTypes([{ id: 'created', label: 'Created' }], 200)).toHaveLength(1);
  });
  it('refuses a malformed page or list with invalid-response', () => {
    expect(() => parseChangeLogPage({ items: [{ id: 1 }], total: 1 }, 200)).toThrow(
      expect.objectContaining({ code: 'invalid-response' }),
    );
    expect(() => parseChangeLogPage({ items: [] }, 200)).toThrow();
    expect(() => parseChangeEventTypes([{ id: 'x' }], 200)).toThrow();
  });
});
