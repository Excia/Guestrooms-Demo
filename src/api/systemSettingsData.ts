import type { SystemSettings, SystemSettingsOptions } from './types';

// PLACEHOLDER sample data until the backend exists (see docs/requirements/placeholders.md).
export const MOCK_SYSTEM_SETTINGS_OPTIONS: SystemSettingsOptions = {
  timeZones: [
    { id: 'America/New_York', label: 'Eastern Standard Time' },
    { id: 'America/Chicago', label: 'Central Standard Time' },
    { id: 'America/Denver', label: 'Mountain Standard Time' },
    { id: 'America/Los_Angeles', label: 'Pacific Standard Time' },
  ],
  cardReaders: [
    { id: 'reader-1', label: '[Card Reader Name]' },
    { id: 'reader-2', label: 'Front Desk Reader' },
  ],
  items: [
    { id: 'item-transfer', label: 'Folio Transfer' },
    { id: 'item-misc', label: 'Miscellaneous Charge' },
    { id: 'item-room', label: 'Room Charge' },
  ],
  areas: [
    { id: 'area-hotel', label: 'Hotel' },
    { id: 'area-pool', label: 'Pool' },
    { id: 'area-spa', label: 'Spa' },
  ],
  members: [
    { id: 'member-1', label: 'First Last (Member)' },
    { id: 'member-2', label: 'Jordan Rivers (Member)' },
    { id: 'member-3', label: 'Sam Ortega (Member)' },
  ],
};

/** Values from Figma 11895:16081 and 11964:11725. */
export const mockSystemSettings = (): SystemSettings => ({
  timeZone: 'America/New_York',
  checkInTime: '16:00',
  checkOutTime: '12:00',
  earlyLateEnabled: true,
  lateCheckOutTime: '15:00',
  mposVisibleBefore: { amount: 1, unit: 'hours' },
  mposVisibleAfter: { amount: 6, unit: 'hours' },
  closeSettledFolios: { amount: 8, unit: 'hours' },
  nightAudit: 'manual',
  nightAuditRunTime: '02:00',
  alternativeBaseRate1: { enabled: true, minNights: 7 },
  alternativeBaseRate2: { enabled: false, minNights: 14 },
  creditCardAuthorization: false,
  cardPresentEnabled: true,
  defaultCardReaderId: 'reader-1',
  rateChangeHandling: 'time-of-booking',
  roomOwnerFieldEnabled: false,
  serviceChargeLabel: 'Service Charge',
  transferItem: { id: 'item-transfer', label: 'Folio Transfer' },
  guestRoomsArea: { id: 'area-hotel', label: 'Hotel' },
  guestMember: { id: 'member-1', label: 'First Last (Member)' },
  folio: {
    streetAddress: '4111 Clubessential Drive',
    city: 'Cincinnati',
    state: 'OH',
    zip: '45238',
    email: 'email@email.com',
    phone: 'XXX-XXX-XXXX',
    customText: '',
    logo: null,
  },
});
