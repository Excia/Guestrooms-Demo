// Report registry and rules for the Reporting landing page (ticket 6.1). The standard report
// tickets (6.2 and the per-report ones) add their definitions under the same ids.
import type { CustomReportSummary } from '../api';

export const REPORTING_PATH = '/reporting';
/** Custom builder with no saved report (NEW REPORT, ticket 6.3). */
export const NEW_CUSTOM_REPORT_PATH = '/reporting/custom/new';

export const standardReportPath = (id: string) =>
  `${REPORTING_PATH}/standard/${encodeURIComponent(id)}`;
export const customReportPath = (id: string) =>
  `${REPORTING_PATH}/custom/${encodeURIComponent(id)}`;

export type StandardReportIcon =
  | 'housekeeping'
  | 'room-type'
  | 'month-end'
  | 'arrival'
  | 'occupancy-summary'
  | 'cancelation'
  | 'folio-balance'
  | 'daily-occupancy'
  | 'departure'
  | 'guest-list'
  | 'rooms-sold'
  | 'sales-forecast';

export interface StandardReport {
  id: string;
  /** Tile label as Figma shows it (see Q-57-1 for the names still to confirm). */
  label: string;
  icon: StandardReportIcon;
  path: string;
}

const standard = (id: string, label: string, icon: StandardReportIcon): StandardReport => ({
  id,
  label,
  icon,
  path: standardReportPath(id),
});

/** Tile order is Figma's (310:7008), left to right, top to bottom. */
export const STANDARD_REPORTS: readonly StandardReport[] = [
  standard('housekeeping', 'Housekeeping', 'housekeeping'),
  standard('reservations-by-room-type', 'Reservations by Room Type', 'room-type'),
  standard('month-end', 'Month End', 'month-end'),
  standard('room-arrival-list', 'Room Arrival List', 'arrival'),
  standard('occupancy-summary', 'Occupancy Summary', 'occupancy-summary'),
  standard('room-cancelation-list', 'Room Cancelation List', 'cancelation'),
  standard('outstanding-folio-balance', 'Outstanding Folio Balance', 'folio-balance'),
  standard('room-daily-occupancy', 'Room Daily Occupancy', 'daily-occupancy'),
  standard('room-departure-list', 'Room Departure List', 'departure'),
  standard('rooms-guest-list', 'Rooms Guest List', 'guest-list'),
  standard('rooms-sold', 'Rooms Sold', 'rooms-sold'),
  standard('sales-forecast', 'Sales Forecast', 'sales-forecast'),
];

/** Most recently updated first; ties keep name order so the list is stable. */
export function sortCustomReports(reports: readonly CustomReportSummary[]): CustomReportSummary[] {
  return [...reports].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.name.localeCompare(b.name),
  );
}

/** Case-insensitive match on the name or the creator; a blank query keeps everything. */
export function filterCustomReports(
  reports: readonly CustomReportSummary[],
  query: string,
): CustomReportSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...reports];
  return reports.filter(
    (r) => r.name.toLowerCase().includes(needle) || r.creatorName.toLowerCase().includes(needle),
  );
}

/** "12/03/26 2:30 PM" in the viewer's local time (Figma: "XX/XX/XX  XX:XX XM"; HTML collapses its double space). */
export function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  const hours = d.getHours();
  const clock = `${hours % 12 || 12}:${p(d.getMinutes())} ${hours < 12 ? 'AM' : 'PM'}`;
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${p(d.getFullYear() % 100)} ${clock}`;
}

/** Second line of a custom report row: "Dana Whitfield | Updated: 10/15/26  2:30 PM". */
export function customReportSubtitle(report: CustomReportSummary): string {
  return `${report.creatorName} | Updated: ${formatUpdated(report.updatedAt)}`;
}
