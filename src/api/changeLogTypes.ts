// Change Log of the Admin Setup pages (ticket 7.10; Figma 16718:6217). Types of the typed API.
import type { IsoDate, Page, RequestOptions } from './types';

/** The admin setup pages that keep a change log; the overlay shows only the page it was opened from. */
export const CHANGE_LOG_PAGES = [
  { id: 'system-settings', label: 'System Settings' },
  { id: 'booking-rules', label: 'Booking Rules' },
  { id: 'room-types', label: 'Room Types' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'add-on-items', label: 'Add-On Items' },
  { id: 'rate-categories', label: 'Rate Categories' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'keycard-integration', label: 'Keycard Integration' },
  { id: 'locations', label: 'Locations' },
  { id: 'room-options', label: 'Room Options' },
  { id: 'employees', label: 'Employees' },
] as const;

export type ChangeLogPageId = (typeof CHANGE_LOG_PAGES)[number]['id'];

export const CHANGE_LOG_SORT_FIELDS = ['date', 'time', 'changeType', 'actionBy'] as const;
export type ChangeLogSortField = (typeof CHANGE_LOG_SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export interface ChangeLogSort {
  field: ChangeLogSortField;
  direction: SortDirection;
}

/** One recorded change. Date and time are the club's local time, as the backend formats them. */
export interface ChangeLogEntry {
  id: string;
  date: IsoDate;
  /** 24-hour `HH:mm`. */
  time: string;
  /** Id of an event type. */
  changeType: string;
  description: string;
  /** Employee name. */
  actionBy: string;
  /** The setup record (room, room type, add-on, rate category) the change is about; page-wide changes have none. */
  recordId?: string;
}

/** An event type; the Change Type filter offers exactly these. */
export interface ChangeEventType {
  id: string;
  label: string;
}

export interface ChangeLogQuery {
  page: ChangeLogPageId;
  /**
   * Only the changes of this one record of the page (the three-dot menu's Change Log). Like the legacy
   * log, which scopes by the record's id (`reservationId`). Unset: the whole page.
   */
  recordId?: string;
  /** Default: newest first (date descending, then time descending). */
  sort?: ChangeLogSort;
  dateFrom?: IsoDate;
  dateTo?: IsoDate;
  /** 24-hour `HH:mm`, inclusive, compared with the time of day only. */
  timeFrom?: string;
  timeTo?: string;
  changeTypes?: string[];
  /** Case-insensitive part of the employee name. */
  actionBy?: string;
  /** Case-insensitive part of the description. */
  search?: string;
  /** 1-based. */
  pageNumber?: number;
  limit?: number;
}

export interface ChangeLogApi {
  /**
   * One page of the page's changes. The backend keeps one year only: it never returns an entry older
   * than a year before today.
   */
  list(query: ChangeLogQuery, options?: RequestOptions): Promise<Page<ChangeLogEntry>>;
  listEventTypes(options?: RequestOptions): Promise<ChangeEventType[]>;
}
