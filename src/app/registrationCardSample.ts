// Sample reservation for the Registration Card preview (PLACEHOLDER P-95-1): shared by the in-app
// preview dialog and the mock backend, so both show the same card.
import type { RegistrationCardReservation } from '../api/registrationCardTypes';

/** The club's name in the card header until the backend supplies it (Q-95-4). */
export const SAMPLE_SYSTEM_NAME = 'Pine Ridge Club';

/** A sample stay that exercises every item: early and late flags, a unique reserver, notes. */
export const SAMPLE_RESERVATION: RegistrationCardReservation = {
  confirmationNumber: '123456',
  checkIn: '2026-10-21',
  checkOut: '2026-10-24',
  earlyCheckIn: true,
  lateCheckOut: true,
  roomNumber: 'Room 204',
  roomType: 'King Suite',
  adults: 2,
  children: 2,
  stayTotalCents: 112_500,
  nights: 3,
  leadOccupant: {
    name: 'Jordan Rivers',
    memberNumber: 'M-10482',
    phone: '555-010-2200',
    address: { street: '123 Address Street', city: 'Cincinnati', state: 'OH', zip: '45238' },
  },
  reserver: { name: 'Sam Ortega', memberNumber: 'M-20931', phone: '555-010-3300' },
  publicNotes: 'Late arrival expected after 9 PM.',
};
