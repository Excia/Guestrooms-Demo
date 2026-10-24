// Checks a Change Log query before it is sent or answered (ticket 7.10), like the other `assert*`.
import { CHANGE_LOG_PAGES, CHANGE_LOG_SORT_FIELDS, type ChangeLogQuery } from './changeLogTypes';
import { ApiError } from './types';

export function assertChangeLogQuery(q: ChangeLogQuery): void {
  const iso = (v: unknown) =>
    v === undefined || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));
  const hhmm = (v: unknown) =>
    v === undefined || (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v));
  const text = (v: unknown) => v === undefined || (typeof v === 'string' && v.length <= 200);
  if (
    !CHANGE_LOG_PAGES.some((p) => p.id === q.page) ||
    !iso(q.dateFrom) ||
    !iso(q.dateTo) ||
    !hhmm(q.timeFrom) ||
    !hhmm(q.timeTo) ||
    !text(q.actionBy) ||
    !text(q.search) ||
    (q.changeTypes !== undefined &&
      !(Array.isArray(q.changeTypes) && q.changeTypes.every((t) => typeof t === 'string'))) ||
    (q.sort !== undefined &&
      (!CHANGE_LOG_SORT_FIELDS.includes(q.sort.field) ||
        (q.sort.direction !== 'asc' && q.sort.direction !== 'desc'))) ||
    (q.pageNumber !== undefined && (!Number.isInteger(q.pageNumber) || q.pageNumber < 1)) ||
    (q.limit !== undefined && (!Number.isInteger(q.limit) || q.limit < 1 || q.limit > 200))
  ) {
    throw new ApiError(400, 'Invalid change log query', { code: 'invalid-query' });
  }
}
