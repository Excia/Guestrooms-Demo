import type { AudienceRules, BookingRules, BookingRulesOptions } from './types';

// PLACEHOLDER sample data until the backend exists (see docs/requirements/placeholders.md).
export const MOCK_BOOKING_RULES_OPTIONS: BookingRulesOptions = {
  roomTypes: [
    { id: 'king-deluxe', label: 'King Deluxe' },
    { id: 'queen-standard', label: 'Queen Standard' },
    { id: 'suite', label: 'Suite' },
    { id: 'cottage', label: 'Two-Bedroom Cottage' },
  ],
  memberTypes: [
    { id: 'full', label: 'Full Member' },
    { id: 'social', label: 'Social Member' },
    { id: 'junior', label: 'Junior Member' },
    { id: 'honorary', label: 'Honorary Member' },
  ],
};

const online = (over: Partial<AudienceRules>): AudienceRules => ({
  requireMemberReserver: false,
  namedOccupants: 'lead',
  contactInfo: 'email-and-phone',
  opens: { amount: 6, unit: 'months' },
  closes: { amount: 6, unit: 'days' },
  cancellation: { amount: 6, unit: 'days' },
  holdMinutes: 10,
  payment: 'on-file',
  depositCents: null,
  roomSelection: 'room-optional',
  excludedRoomTypeIds: [],
  maxRoomsPerReservation: 6,
  addOnPopup: false,
  ...over,
});

/** Starting values; the hold minutes match the earlier booking hold placeholder (15, 10, 10). */
export const mockBookingRules = (): BookingRules => ({
  employee: online({
    requireMemberReserver: false,
    namedOccupants: 'all',
    contactInfo: 'email',
    opens: { amount: 12, unit: 'months' },
    closes: null,
    cancellation: null,
    holdMinutes: 15,
    excludedRoomTypeIds: null,
    maxRoomsPerReservation: 20,
    addOnPopup: null,
  }),
  member: online({
    requireMemberReserver: false,
    namedOccupants: 'lead',
    contactInfo: 'email-and-phone',
    payment: 'deposit',
    depositCents: 9900,
    roomSelection: 'room-only',
    excludedRoomTypeIds: ['suite'],
  }),
  nonMember: online({
    requireMemberReserver: null,
    namedOccupants: 'none',
    contactInfo: 'email-or-phone',
    payment: 'prepayment',
    roomSelection: 'room-type-only',
    excludedRoomTypeIds: ['suite', 'cottage'],
  }),
  uniqueMemberTypeRules: true,
  memberTypeRules: [
    {
      id: 'rule-junior',
      memberTypeId: 'junior',
      excludeFromOnlineBooking: false,
      excludedRoomTypeIds: ['suite'],
      opens: { amount: 3, unit: 'months' },
      closes: { amount: 2, unit: 'days' },
    },
  ],
});
