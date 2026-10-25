import { defaultRegistrationCard } from '../app/registrationCard';
import type {
  LookupRef,
  OnlineBookingSettings,
  SystemSettings,
  SystemSettingsOptions,
} from './types';

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

// PLACEHOLDER (P-HA-1): invented house accounts until the backend exists.
export const MOCK_HOUSE_ACCOUNTS: readonly LookupRef[] = [
  { id: 'house-1', label: 'Club House Account' },
  { id: 'house-2', label: 'Banquet Comp Account' },
  { id: 'house-3', label: 'Events House Account' },
  { id: 'house-4', label: 'Golf Outings House Account' },
  { id: 'house-5', label: 'Guest Rooms Comp Account' },
  { id: 'house-6', label: 'Pro Shop Staff Account' },
];

export const HOUSE_ACCOUNT_RESULTS_MAX = 20;

/** Pure filter behind the mock lookup: name contains the query, by name, at most 20. */
export function searchHouseAccounts(query: string): LookupRef[] {
  const q = query.trim().toLowerCase();
  return MOCK_HOUSE_ACCOUNTS.filter((a) => a.label.toLowerCase().includes(q))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, HOUSE_ACCOUNT_RESULTS_MAX)
    .map((a) => ({ ...a }));
}

/** Values from Figma 15957:84617. */
export const mockOnlineBookingSettings = (): OnlineBookingSettings => ({
  globalMessage: 'To book more than 3 rooms, please contact group sales at ###-###-####.',
  cancellationAgreement:
    'Reservations may be cancelled without charge until the cancellation period begins. After that the first night is charged.',
  includePolicyLink: true,
  policyUrl: 'https://www.clubname.com/guestroomspolicy',
  chargeCancellationFee: false,
  showAddOnsPopup: false,
});

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
  houseAccount: { id: 'house-1', label: 'Club House Account' },
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
  registrationCard: {
    ...defaultRegistrationCard(),
    customText:
      'By signing, the guest agrees to the club policies, including the cancellation policy and charges for damages.',
  },
  onlineBooking: mockOnlineBookingSettings(),
});
