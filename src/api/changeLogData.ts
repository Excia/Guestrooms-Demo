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
import { mockAddOns } from './addOnData';
import { mockRateCategories } from './rateCategoryData';
import { mockRoomTypes, mockRooms } from './roomSetupData';
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
    ['setting-changed', 'Training Mode turned on'],
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
  'room-options': [
    ['created', 'Feature "Fireplace" added'],
    ['updated', 'Bed Size "Queen" renamed to "Queen Plus"'],
    ['deleted', 'Feature "Rollaway Access" removed'],
  ],
  'keycard-integration': [
    ['updated', 'Encoder Key list updated'],
    ['deleted', 'All encoder keys removed'],
  ],
  locations: [
    ['created', 'Location "Lakeside Cottages" created'],
    ['updated', 'Location "Main Clubhouse" area changed to Guest Rooms'],
    ['deleted', 'Location "Pool House" removed'],
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
  addRecordEntries(out, today);
  return out;
}

/** PLACEHOLDER: a few changes per seeded setup record, so each item's own Change Log has rows. */
function addRecordEntries(out: Record<ChangeLogPageId, ChangeLogEntry[]>, today: string) {
  const types = mockRoomTypes();
  const records: [ChangeLogPageId, string, { id: string; name: string }[]][] = [
    ['rooms', 'Room', mockRooms(types)],
    ['room-types', 'Room Type', types],
    ['add-on-items', 'Add-On', mockAddOns()],
    ['rate-categories', 'Rate Category', mockRateCategories()],
  ];
  const steps: [string, (noun: string, name: string) => string][] = [
    ['created', (noun, name) => `${noun} "${name}" created`],
    ['updated', (noun, name) => `${noun} "${name}" description updated`],
    ['updated', (noun, name) => `${noun} "${name}" active dates changed`],
  ];
  records.forEach(([page, noun, list], pageIndex) => {
    list.forEach((record, r) => {
      steps.forEach(([changeType, text], i) => {
        const minutes = (r * 97 + i * 211 + pageIndex * 31) % (24 * 60);
        out[page].push({
          id: `${page}-rec-${record.id}-${i + 1}`,
          recordId: record.id,
          date: addDays(today, -(10 + i * 40 + r * 7)),
          time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
          changeType,
          description: text(noun, record.name),
          actionBy: EMPLOYEES[(r + i) % EMPLOYEES.length],
        });
      });
    });
  });
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
      (q.recordId === undefined || e.recordId === q.recordId) &&
      (!types || types.has(e.changeType)) &&
      includes(e.actionBy, q.actionBy) &&
      includes(e.description, q.search),
  );
  const sign = sort.direction === 'asc' ? 1 : -1;
  // Ties fall back to the id in the same direction, so reversing the sort reverses the whole list.
  rows.sort(
    (a, b) =>
      sign *
      (cmp(sortKey(a, sort.field, labels), sortKey(b, sort.field, labels)) || cmp(a.id, b.id)),
  );
  const limit = q.limit ?? CHANGE_LOG_ROWS_PER_PAGE;
  const start = ((q.pageNumber ?? 1) - 1) * limit;
  return { items: structuredClone(rows.slice(start, start + limit)), total: rows.length };
}
