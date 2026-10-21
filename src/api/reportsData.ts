import type { CustomReportSummary } from './types';

// PLACEHOLDER: invented sample reports; the Figma frame (310:7003) only shows "[Custom Report Name]".
export const mockCustomReports = (): CustomReportSummary[] => [
  {
    id: 'cr-1',
    name: 'Weekend Occupancy by Room Type',
    creatorName: 'Dana Whitfield',
    updatedAt: '2026-10-15T14:30:00Z',
  },
  {
    id: 'cr-2',
    name: 'Member vs. Guest Revenue',
    creatorName: 'Marcus Lee',
    updatedAt: '2026-10-12T09:05:00Z',
  },
  {
    id: 'cr-3',
    name: 'Tournament Week Arrivals',
    creatorName: 'Dana Whitfield',
    updatedAt: '2026-10-01T17:45:00Z',
  },
  {
    id: 'cr-4',
    name: 'Cancellations Last 30 Days',
    creatorName: 'Priya Natarajan',
    updatedAt: '2026-09-22T11:20:00Z',
  },
  {
    id: 'cr-5',
    name: 'Open Balances by Member',
    creatorName: 'Marcus Lee',
    updatedAt: '2026-09-08T16:00:00Z',
  },
];
