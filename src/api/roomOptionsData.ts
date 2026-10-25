import type { RoomOptions } from './types';

// PLACEHOLDER sample data until the backend exists (see entries/183-room-options.md). This is the
// one definition of the club's Features and Bed Sizes: the room setup options, the Schedule's Room
// Features filter and the Room Options page all read it. Ids are stable: seeds and tests use them.
export const MOCK_ROOM_OPTIONS: RoomOptions = {
  features: [
    { id: 'feature-fridge', label: 'Mini fridge' },
    { id: 'feature-coffee', label: 'Coffee maker' },
    { id: 'feature-balcony', label: 'Balcony' },
    { id: 'feature-view', label: 'Golf course view' },
    { id: 'feature-tub', label: 'Soaking tub' },
  ],
  // Figma "Bed Types": King, Queen, Double, Twin.
  bedSizes: [
    { id: 'bed-king', label: 'King' },
    { id: 'bed-queen', label: 'Queen' },
    { id: 'bed-double', label: 'Double' },
    { id: 'bed-twin', label: 'Twin' },
  ],
};

export const mockRoomOptions = (): RoomOptions => structuredClone(MOCK_ROOM_OPTIONS);
