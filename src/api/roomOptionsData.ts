import type { RoomOptions } from './types';

/** The lists without their version (the version belongs to the mock's store). */
type RoomOptionLists = Omit<RoomOptions, 'version'>;

// PLACEHOLDER sample data until the backend exists (see entries/183-room-options.md). This is the
// one definition of the club's Features and Bed Sizes: the room setup options, the Schedule's Room
// Features filter and the Room Options page all read it. Ids are stable: seeds and tests use them.
export const MOCK_ROOM_OPTIONS: RoomOptionLists = {
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

export const mockRoomOptions = (): RoomOptions => ({
  ...structuredClone(MOCK_ROOM_OPTIONS),
  version: 'ro-1',
});
