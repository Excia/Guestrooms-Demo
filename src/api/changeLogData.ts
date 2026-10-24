// Mock Change Log (ticket 7.10): PLACEHOLDER entries and event types until the backend exists (see
// docs/requirements/entries/97-change-log.md), plus the filter, sort and paging the backend is
// expected to do. The mock enforces the one-year retention the way the backend must.
import {
  DEFAULT_CHANGE_LOG_SORT,
  CHANGE_LOG_ROWS_PER_PAGE,
  isWithinRetention,
} from '../app/changeLog';
import {
  CHANGE_LOG_PAGES,
  type ChangeEventType,
  type ChangeLogEntry,
  type ChangeLogPageId,
  type ChangeLogQuery,
  type ChangeLogSortField,
} from './changeLogTypes';
import type { Page } from './types';

/** Placeholder event types (the Figma reference table is an image of a spreadsheet; Q-97-2). */
export const MOCK_EVENT_TYPES: readonly ChangeEventType[] = [
  { id: 'created', label: 'Created' },
  { id: 'updated', label: 'Updated' },
  { id: 'deleted', label: 'Deleted' },
  { id: 'duplicated', label: 'Duplicated' },
  { id: 'activated', label: 'Activated' },
  { id: 'deactivated', label: 'Deactivated' },
  { id: 'setting-changed', label: 'Setting Changed' },
];

const EMPLOYEES = ['Jordan Rivers', 'Sam Ortega', 'Avery Chen', 'Morgan Blake'];

const DESCRIPTIONS: Record<ChangeLogPageId, readonly [string, string][]> = {
  'system-settings': [
    ['setting-changed', 'Check In Time changed from 3:00 PM to 4:00 PM'],
    ['setting-changed', 'Checkout Time changed from 11:00 AM to 12:00 PM'],
    ['setting-changed', 'Night Audit changed from Run Manually to Run Automatically'],
    ['updated', 'Folio Details: property address updated'],
    ['setting-changed', 'Service Charge Label changed to "Service Charge"'],
    ['setting-changed', 'Enable Early Check In and Late Check Out turned on'],
  ],
  'booking-rules': [
    ['updated', 'Reservation Hold for Member Online Booking changed from 10 to 15 minutes'],
    ['updated', 'Cancellation Period for Non-Member Online Booking changed to 2 days'],
    ['created', 'Unique Member Type Rule added for Junior'],
    ['deleted', 'Unique Member Type Rule removed for Social'],
  ],
  'room-types': [
    ['created', 'Room Type "King Suite" created'],
    ['updated', 'Room Type "Queen Room" description updated'],
    ['deactivated', 'Room Type "Garden Room" deactivated'],
    ['duplicated', 'Room Type "King Suite" duplicated as "Copy of King Suite"'],
  ],
  rooms: [
    ['created', 'Room "Room 204" created'],
    ['updated', 'Room "Room 101" Room Owner changed'],
    ['activated', 'Room "Room 305" activated'],
    ['deleted', 'Room "Room 12" deleted'],
  ],
  'add-on-items': [
    ['created', 'Add-On "Breakfast Basket" created'],
    ['updated', 'Add-On "Late Checkout" Nightly Qty changed to 4'],
    ['deleted', 'Add-On "Welcome Gift" deleted'],
  ],
  'rate-categories': [
    ['created', 'Rate Category "Owner Rate" created'],
    ['updated', 'Rate Category "Member Rate" updated'],
  ],
  notifications: [
    ['created', 'Notification "Reservation Confirmation" created'],
    ['updated', 'Notification "Check In Reminder" content updated'],
  ],
  'keycard-integration': [
    ['updated', 'Encoder Key list updated'],
    ['deleted', 'All encoder keys removed'],
  ],
};

const pad = (n: number) => String(n).padStart(2, '0');

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/**
 * Deterministic entries for every page, spread over about 14 months before `today`, so the oldest
 * ones fall outside the one-year retention and prove the mock drops them.
 */
export function mockChangeLog(today: string): Record<ChangeLogPageId, ChangeLogEntry[]> {
  const out = {} as Record<ChangeLogPageId, ChangeLogEntry[]>;
  CHANGE_LOG_PAGES.forEach((page, pageIndex) => {
    const descriptions = DESCRIPTIONS[page.id];
    const count = page.id === 'system-settings' ? 60 : 14;
    out[page.id] = Array.from({ length: count }, (_, i) => {
      const [changeType, description] = descriptions[(i + pageIndex) % descriptions.length];
      const minutes = (i * 137 + pageIndex * 41) % (24 * 60);
      return {
        id: `${page.id}-${i + 1}`,
        date: addDays(today, -Math.floor((i * 430) / count)),
        time: `${pad(Math.floor(minutes / 60))}:${pad(minutes - Math.floor(minutes / 60) * 60)}`,
        changeType,
        description,
        actionBy: EMPLOYEES[(i + pageIndex) % EMPLOYEES.length],
      };
    });
  });
  return out;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function sortKey(
  e: ChangeLogEntry,
  field: ChangeLogSortField,
  labels: Map<string, string>,
): string {
  switch (field) {
    case 'date':
      return e.date + e.time;
    case 'time':
      return e.time + e.date;
    case 'changeType':
      return (labels.get(e.changeType) ?? e.changeType).toLowerCase();
    case 'actionBy':
      return e.actionBy.toLowerCase();
  }
}

const includes = (value: string, needle: string | undefined) => {
  const n = needle?.trim().toLowerCase();
  return !n || value.toLowerCase().includes(n);
};

/** Keeps entries within retention, applies the filters, sorts (newest first by default) and pages. */
export function queryChangeLog(
  all: readonly ChangeLogEntry[],
  q: ChangeLogQuery,
  today: string,
  eventTypes: readonly ChangeEventType[] = MOCK_EVENT_TYPES,
): Page<ChangeLogEntry> {
  const labels = new Map(eventTypes.map((t) => [t.id, t.label]));
  const sort = q.sort ?? DEFAULT_CHANGE_LOG_SORT;
  const types = q.changeTypes?.length ? new Set(q.changeTypes) : null;
  const rows = all.filter(
    (e) =>
      isWithinRetention(e.date, today) &&
      (!q.dateFrom || e.date >= q.dateFrom) &&
      (!q.dateTo || e.date <= q.dateTo) &&
      (!q.timeFrom || e.time >= q.timeFrom) &&
      (!q.timeTo || e.time <= q.timeTo) &&
      (!types || types.has(e.changeType)) &&
      includes(e.actionBy, q.actionBy) &&
      includes(e.description, q.search),
  );
  const sign = sort.direction === 'asc' ? 1 : -1;
  rows.sort(
    (a, b) =>
      sign * cmp(sortKey(a, sort.field, labels), sortKey(b, sort.field, labels)) || cmp(b.id, a.id),
  );
  const limit = q.limit ?? CHANGE_LOG_ROWS_PER_PAGE;
  const start = ((q.pageNumber ?? 1) - 1) * limit;
  return { items: rows.slice(start, start + limit), total: rows.length };
}
