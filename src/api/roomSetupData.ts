import { MOCK_ROOM_OPTIONS } from './roomOptionsData';
import type { RoomDetails, RoomSetup, RoomSetupOptions, RoomTypeSetup } from './types';

// PLACEHOLDER sample data until the backend exists (see docs/requirements/placeholders.md).
export const MOCK_ROOM_SETUP_OPTIONS: RoomSetupOptions = {
  skus: [
    { id: 'sku-king', label: 'Location A' },
    { id: 'sku-queen', label: 'Location B' },
    { id: 'sku-suite', label: 'Location C' },
  ],
  // Features and Bed Sizes have one source: Room Options (roomOptionsData.ts).
  features: MOCK_ROOM_OPTIONS.features,
  addOns: [
    { id: 'addon-rollaway', label: 'Rollaway bed' },
    { id: 'addon-crib', label: 'Crib' },
    { id: 'addon-late', label: 'Late checkout' },
  ],
  bedSizes: MOCK_ROOM_OPTIONS.bedSizes,
  members: [
    { id: 'member-1', label: 'First Last (Member)' },
    { id: 'member-2', label: 'Jordan Rivers (Member)' },
    { id: 'member-3', label: 'Sam Ortega (Member)' },
  ],
};

const details = (patch: Partial<RoomDetails>): RoomDetails => ({
  maxOccupancy: 2,
  bedrooms: 1,
  fullBaths: 1,
  halfBaths: 0,
  bedTypes: { 'bed-king': 0, 'bed-queen': 0, 'bed-double': 0, 'bed-twin': 0 },
  description: '',
  photos: [{ id: 'photo-seed', name: 'room.jpg', url: '' }],
  featureIds: [],
  addOnIds: [],
  ...patch,
});

/** Values follow Figma 11905:19464 ("Double Queen Room"). */
export function mockRoomTypes(): RoomTypeSetup[] {
  return [
    {
      id: 'rt-double-queen',
      name: 'Double Queen Room',
      startDate: '2024-01-01',
      endDate: null,
      sku: { id: 'sku-king', label: 'Location A' },
      onlineBooking: true,
      details: details({
        maxOccupancy: 4,
        bedTypes: { 'bed-king': 0, 'bed-queen': 2, 'bed-double': 0, 'bed-twin': 0 },
        description: 'Two queen beds, a work desk and a view of the first fairway.',
        featureIds: ['feature-fridge', 'feature-coffee'],
        addOnIds: ['addon-rollaway'],
      }),
    },
    {
      id: 'rt-king',
      name: 'King Room',
      startDate: '2024-01-01',
      endDate: null,
      sku: { id: 'sku-queen', label: 'Location B' },
      onlineBooking: false,
      details: details({
        bedTypes: { 'bed-king': 1, 'bed-queen': 0, 'bed-double': 0, 'bed-twin': 0 },
        featureIds: ['feature-fridge', 'feature-balcony'],
      }),
    },
    {
      id: 'rt-cottage',
      name: 'Cottage (retired)',
      startDate: '2020-01-01',
      endDate: '2022-12-31',
      sku: null,
      onlineBooking: false,
      details: details({ bedrooms: 2, halfBaths: 1 }),
    },
  ];
}

export function mockRooms(roomTypes: readonly RoomTypeSetup[]): RoomSetup[] {
  const type = (id: string) => roomTypes.find((t) => t.id === id) as RoomTypeSetup;
  const base = {
    owner: null,
    startDate: '2024-01-01',
    endDate: null,
    inheritDetails: true,
    inheritRates: true,
    onlineBooking: true,
  };
  return [
    {
      ...base,
      id: 'room-100',
      name: '100',
      roomTypeId: 'rt-double-queen',
      details: structuredClone(type('rt-double-queen').details),
      linkedRoomIds: ['room-101'],
      upcomingReservations: 2,
    },
    {
      ...base,
      id: 'room-101',
      name: '101',
      roomTypeId: 'rt-double-queen',
      details: structuredClone(type('rt-double-queen').details),
      linkedRoomIds: ['room-100'],
      upcomingReservations: 0,
    },
    {
      ...base,
      id: 'room-102',
      name: '102',
      roomTypeId: 'rt-double-queen',
      details: structuredClone(type('rt-double-queen').details),
      linkedRoomIds: [],
      upcomingReservations: 0,
    },
    {
      ...base,
      id: 'room-103',
      name: '103',
      roomTypeId: 'rt-double-queen',
      details: structuredClone(type('rt-double-queen').details),
      linkedRoomIds: [],
      upcomingReservations: 0,
    },
    {
      ...base,
      id: 'room-200',
      name: '200',
      owner: { id: 'member-2', label: 'Jordan Rivers (Member)' },
      roomTypeId: 'rt-king',
      inheritDetails: false,
      details: { ...structuredClone(type('rt-king').details), maxOccupancy: 3 },
      linkedRoomIds: [],
      upcomingReservations: 0,
    },
    {
      ...base,
      id: 'room-300',
      name: '300 (retired)',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      roomTypeId: 'rt-king',
      details: structuredClone(type('rt-king').details),
      linkedRoomIds: [],
      upcomingReservations: 0,
    },
  ];
}
