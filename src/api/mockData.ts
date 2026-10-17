import { totalsFor } from './stats';
import type {
  DashboardStats,
  PermissionGrant,
  RateCategoryStat,
  Reservation,
  RoomBlock,
} from './types';

export const MOCK_TODAY = '2026-10-16';

export const rateCategories: RateCategoryStat[] = [
  { id: 'member', name: 'Member Rate', nights: 18, revenue: 2_880_000 },
  { id: 'reciprocal', name: 'Reciprocal Club', nights: 7, revenue: 1_365_000 },
  { id: 'guest-of-member', name: 'Guest of Member', nights: 9, revenue: 2_025_000 },
  { id: 'event', name: 'Event Package', nights: 4, revenue: 980_000 },
];

export const roomBlocks: RoomBlock[] = [
  {
    id: 'blk-1',
    roomName: 'Room 204',
    startDate: '2026-10-14',
    endDate: '2026-10-18',
    reason: 'Carpet replacement',
  },
  {
    id: 'blk-2',
    roomName: 'Room 112',
    startDate: '2026-10-16',
    endDate: '2026-10-17',
    reason: 'Plumbing repair',
  },
  {
    id: 'blk-3',
    roomName: 'Suite 301',
    startDate: '2026-10-24',
    endDate: '2026-10-26',
    reason: 'Member event hold',
  },
];

export const mockStats: DashboardStats = {
  date: MOCK_TODAY,
  arrivalsToday: 6,
  departuresToday: 4,
  inHouse: 17,
  occupancyPercent: 68.5,
  rateCategories,
  roomBlocks,
  unassignedChargesCount: 3,
  ...totalsFor(rateCategories),
};

export const emptyStats: DashboardStats = {
  date: MOCK_TODAY,
  arrivalsToday: 0,
  departuresToday: 0,
  inHouse: 0,
  occupancyPercent: 0,
  rateCategories: [],
  roomBlocks: [],
  unassignedChargesCount: 0,
  ...totalsFor([]),
};

export const mockReservations: Reservation[] = [
  {
    id: 'res-1001',
    confirmationNumber: 'GR-48213',
    guestName: 'Margaret Ellison',
    roomType: 'King Deluxe',
    roomNumber: '210',
    arrival: '2026-10-16',
    departure: '2026-10-19',
    adults: 2,
    children: 0,
    status: 'confirmed',
    rateCategoryId: 'member',
    hasUnassignedCharges: false,
  },
  {
    id: 'res-1002',
    confirmationNumber: 'GR-48214',
    guestName: 'Thomas Okafor',
    roomType: 'Queen Standard',
    roomNumber: null,
    arrival: '2026-10-16',
    departure: '2026-10-17',
    adults: 1,
    children: 0,
    status: 'pending',
    rateCategoryId: 'reciprocal',
    hasUnassignedCharges: false,
  },
  {
    id: 'res-1003',
    confirmationNumber: 'GR-48190',
    guestName: 'Priya Raman',
    roomType: 'Suite',
    roomNumber: '301',
    arrival: '2026-10-14',
    departure: '2026-10-17',
    adults: 2,
    children: 2,
    status: 'checked-in',
    rateCategoryId: 'guest-of-member',
    hasUnassignedCharges: true,
  },
  {
    id: 'res-1004',
    confirmationNumber: 'GR-48177',
    guestName: 'Daniel Whitfield',
    roomType: 'King Deluxe',
    roomNumber: '208',
    arrival: '2026-10-12',
    departure: '2026-10-16',
    adults: 2,
    children: 0,
    status: 'checked-in',
    rateCategoryId: 'member',
    hasUnassignedCharges: true,
  },
  {
    id: 'res-1005',
    confirmationNumber: 'GR-48102',
    guestName: 'Sofia Marchetti',
    roomType: 'Queen Standard',
    roomNumber: '115',
    arrival: '2026-10-09',
    departure: '2026-10-12',
    adults: 2,
    children: 1,
    status: 'checked-out',
    rateCategoryId: 'event',
    hasUnassignedCharges: false,
  },
  {
    id: 'res-1006',
    confirmationNumber: 'GR-48230',
    guestName: 'Henry Lowell',
    roomType: 'King Deluxe',
    roomNumber: null,
    arrival: '2026-10-22',
    departure: '2026-10-25',
    adults: 2,
    children: 0,
    status: 'cancelled',
    rateCategoryId: 'member',
    hasUnassignedCharges: false,
  },
];

export const fullGrant: PermissionGrant = { role: 'Club Manager', permissions: 'all' };
export const noGrant: PermissionGrant = { role: 'No access', permissions: [] };
