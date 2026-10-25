import { PLACEHOLDER_LOCATIONS } from '../app/placeholderLocations';
import type { AddOnOptions, AddOnSetup, LookupRef } from './types';

// PLACEHOLDER sample data until the backend exists (see entries/73-add-on-items.md).
export const MOCK_ADD_ON_SKUS: LookupRef[] = [
  { id: 'sku-rollaway', label: 'Rollaway bed' },
  { id: 'sku-crib', label: 'Crib' },
  { id: 'sku-late', label: 'Late checkout fee' },
  { id: 'sku-welcome', label: 'Welcome package' },
];

/** Locations and room types come from the live mock stores. */
export function mockAddOnOptions(
  roomTypes: readonly LookupRef[],
  locations: readonly { id: string; name: string }[],
): AddOnOptions {
  return {
    skus: structuredClone(MOCK_ADD_ON_SKUS),
    locations: locations.map((l) => ({ id: l.id, label: l.name })),
    roomTypes: roomTypes.map((t) => ({ id: t.id, label: t.label })),
  };
}

// The ids match the add-ons the Room Types page offers (roomSetupData.ts).
export function mockAddOns(): AddOnSetup[] {
  const all = {
    startDate: '2024-01-01',
    endDate: null,
    onlineBooking: true,
    description: '',
    photos: [],
    locationIds: PLACEHOLDER_LOCATIONS.map((l) => l.id),
    roomTypeIds: ['rt-double-queen', 'rt-king'],
  };
  return [
    {
      ...all,
      id: 'addon-rollaway',
      name: 'Rollaway bed',
      kind: 'item',
      sku: MOCK_ADD_ON_SKUS[0],
      trackNightly: true,
      nightlyQty: 5,
      description: 'A rollaway bed set up in the room before arrival.',
      photos: [{ id: 'photo-rollaway', name: 'rollaway.jpg', url: '' }],
    },
    {
      ...all,
      id: 'addon-crib',
      name: 'Crib',
      kind: 'item',
      sku: MOCK_ADD_ON_SKUS[1],
      trackNightly: true,
      nightlyQty: 2,
    },
    {
      ...all,
      id: 'addon-late',
      name: 'Late checkout',
      kind: 'item',
      sku: MOCK_ADD_ON_SKUS[2],
      onlineBooking: false,
      trackNightly: false,
      nightlyQty: 1,
    },
    {
      ...all,
      id: 'addon-welcome',
      name: 'Welcome package',
      kind: 'combo',
      sku: MOCK_ADD_ON_SKUS[3],
      trackNightly: false,
      nightlyQty: 1,
      locationIds: ['main-clubhouse'],
    },
    {
      ...all,
      id: 'addon-holiday',
      name: 'Holiday decorations (retired)',
      kind: 'item',
      sku: MOCK_ADD_ON_SKUS[2],
      startDate: '2021-11-20',
      endDate: '2021-12-31',
      trackNightly: false,
      nightlyQty: 1,
    },
  ];
}
