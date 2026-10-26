// Wire mapping of the Change Log endpoints (ticket 7.10): query to URL parameters and light shape
// guards on the answers, like the rest of http.ts.
import type { ChangeEventType, ChangeLogEntry, ChangeLogQuery } from './changeLogTypes';
import type { Page } from './types';
import { ApiError } from './types';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';

const invalid = (status: number, what: string) =>
  new ApiError(status, `Malformed ${what} response`, { code: 'invalid-response' });

/** Lists are comma-separated; empty and unset values are left out by the caller's `request`. */
export function changeLogParams(q: ChangeLogQuery): Record<string, string | undefined> {
  return {
    page: q.page,
    recordId: q.recordId,
    sort: q.sort && `${q.sort.field}:${q.sort.direction}`,
    dateFrom: q.dateFrom,
    dateTo: q.dateTo,
    timeFrom: q.timeFrom,
    timeTo: q.timeTo,
    changeTypes: q.changeTypes?.length ? q.changeTypes.join(',') : undefined,
    actionBy: q.actionBy?.trim(),
    search: q.search?.trim(),
    pageNumber: q.pageNumber === undefined ? undefined : String(q.pageNumber),
    limit: q.limit === undefined ? undefined : String(q.limit),
  };
}

const isEntry = (v: unknown): v is ChangeLogEntry =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.date) &&
  isString(v.time) &&
  isString(v.changeType) &&
  isString(v.description) &&
  isString(v.actionBy) &&
  (v.recordId === undefined || isString(v.recordId));

export function parseChangeLogPage(body: unknown, status: number): Page<ChangeLogEntry> {
  if (
    !isObject(body) ||
    !Array.isArray(body.items) ||
    !body.items.every(isEntry) ||
    typeof body.total !== 'number' ||
    !Number.isFinite(body.total)
  ) {
    throw invalid(status, 'change log');
  }
  return body as unknown as Page<ChangeLogEntry>;
}

export function parseChangeEventTypes(body: unknown, status: number): ChangeEventType[] {
  if (
    !Array.isArray(body) ||
    !body.every((t) => isObject(t) && isString(t.id) && isString(t.label))
  ) {
    throw invalid(status, 'change event types');
  }
  return body as ChangeEventType[];
}
