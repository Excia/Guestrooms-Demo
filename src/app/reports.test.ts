import { describe, expect, it } from 'vitest';
import type { CustomReportSummary } from '../api';
import {
  STANDARD_REPORTS,
  customReportPath,
  customReportSubtitle,
  filterCustomReports,
  formatUpdated,
  sortCustomReports,
  standardReportPath,
} from './reports';

const local = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(y, m - 1, d, h, min).toISOString();

const report = (
  id: string,
  name: string,
  updatedAt: string,
  creatorName = 'Dana',
): CustomReportSummary => ({
  id,
  name,
  creatorName,
  updatedAt,
});

describe('STANDARD_REPORTS', () => {
  it('lists the twelve Figma tiles in order with unique ids and paths', () => {
    expect(STANDARD_REPORTS.map((r) => r.label)).toEqual([
      'Housekeeping',
      'Reservations by Room Type',
      'Month End',
      'Room Arrival List',
      'Occupancy Summary',
      'Room Cancelation List',
      'Outstanding Folio Balance',
      'Room Daily Occupancy',
      'Room Departure List',
      'Rooms Guest List',
      'Rooms Sold',
      'Sales Forecast',
    ]);
    expect(new Set(STANDARD_REPORTS.map((r) => r.id)).size).toBe(12);
    expect(new Set(STANDARD_REPORTS.map((r) => r.path)).size).toBe(12);
  });
});

describe('report paths', () => {
  it('encodes ids', () => {
    expect(standardReportPath('rooms-sold')).toBe('/reporting/standard/rooms-sold');
    expect(customReportPath('a/b')).toBe('/reporting/custom/a%2Fb');
  });
});

describe('sortCustomReports', () => {
  it('puts the most recently updated first without mutating the input', () => {
    const input = [
      report('1', 'Old', '2026-01-01T00:00:00Z'),
      report('2', 'New', '2026-03-01T00:00:00Z'),
      report('3', 'Mid', '2026-02-01T00:00:00Z'),
    ];
    expect(sortCustomReports(input).map((r) => r.id)).toEqual(['2', '3', '1']);
    expect(input.map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('breaks ties by name', () => {
    const t = '2026-01-01T00:00:00Z';
    expect(
      sortCustomReports([report('b', 'Beta', t), report('a', 'Alpha', t)]).map((r) => r.id),
    ).toEqual(['a', 'b']);
  });
});

describe('filterCustomReports', () => {
  const list = [
    report('1', 'Weekend Occupancy', '2026-01-01T00:00:00Z', 'Dana'),
    report('2', 'Cancellations', '2026-01-02T00:00:00Z', 'Marcus'),
  ];
  it('matches name or creator, ignoring case and surrounding spaces', () => {
    expect(filterCustomReports(list, ' occupancy ').map((r) => r.id)).toEqual(['1']);
    expect(filterCustomReports(list, 'MARCUS').map((r) => r.id)).toEqual(['2']);
  });
  it('keeps everything for a blank query and nothing for no match', () => {
    expect(filterCustomReports(list, '  ')).toHaveLength(2);
    expect(filterCustomReports(list, 'zzz')).toEqual([]);
  });
});

describe('formatUpdated', () => {
  it('formats local date and 12-hour time', () => {
    expect(formatUpdated(local(2026, 10, 5, 14, 30))).toBe('10/05/26 2:30 PM');
    expect(formatUpdated(local(2026, 1, 2, 0, 5))).toBe('01/02/26 12:05 AM');
    expect(formatUpdated(local(2026, 1, 2, 12, 0))).toBe('01/02/26 12:00 PM');
  });
  it('shows an em dash for an invalid instant', () => {
    expect(formatUpdated('nope')).toBe('—');
  });
  it('builds the row subtitle', () => {
    expect(customReportSubtitle(report('1', 'X', local(2026, 10, 5, 9, 7), 'Dana W'))).toBe(
      'Dana W | Updated: 10/05/26 9:07 AM',
    );
  });
});
