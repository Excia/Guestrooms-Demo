// Business rules of the Online Booking tab of System Settings (ticket 7.9): limits, URL check and
// what the online booking flow (Epic 5) reads. Pure functions; the tab and the settings call them.
import type { OnlineBookingSettings } from '../api/types';

export const ONLINE_BOOKING_LIMITS = {
  globalMessage: 150,
  cancellationAgreement: 300,
  policyUrl: 2000,
} as const;

export type OnlineBookingField =
  'onlineBooking.globalMessage' | 'onlineBooking.cancellationAgreement' | 'onlineBooking.policyUrl';

export const ONLINE_BOOKING_FIELD_ORDER: readonly OnlineBookingField[] = [
  'onlineBooking.globalMessage',
  'onlineBooking.cancellationAgreement',
  'onlineBooking.policyUrl',
];

export const isOnlineBookingField = (field: string): field is OnlineBookingField =>
  field.startsWith('onlineBooking.');

/** Every policy link must be an absolute http or https address with a host and no embedded credentials. */
export function isValidPolicyUrl(value: string): boolean {
  const text = value.trim();
  if (text === '' || /\s/.test(text)) return false;
  try {
    const url = new URL(text);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.hostname.includes('.') &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}

/** One message per invalid field. The URL is only checked while the link switch is on. */
export function validateOnlineBooking(
  s: OnlineBookingSettings,
): Partial<Record<OnlineBookingField, string>> {
  const errors: Partial<Record<OnlineBookingField, string>> = {};
  if (s.globalMessage.length > ONLINE_BOOKING_LIMITS.globalMessage) {
    errors['onlineBooking.globalMessage'] =
      `Use ${ONLINE_BOOKING_LIMITS.globalMessage} characters or fewer.`;
  }
  if (s.cancellationAgreement.length > ONLINE_BOOKING_LIMITS.cancellationAgreement) {
    errors['onlineBooking.cancellationAgreement'] =
      `Use ${ONLINE_BOOKING_LIMITS.cancellationAgreement} characters or fewer.`;
  }
  if (s.includePolicyLink) {
    const url = s.policyUrl.trim();
    if (url === '') {
      errors['onlineBooking.policyUrl'] = 'Enter the address of the full policy.';
    } else if (url.length > ONLINE_BOOKING_LIMITS.policyUrl) {
      errors['onlineBooking.policyUrl'] =
        `Use ${ONLINE_BOOKING_LIMITS.policyUrl} characters or fewer.`;
    } else if (!isValidPolicyUrl(url)) {
      errors['onlineBooking.policyUrl'] =
        'Enter a full web address, such as https://www.example.com/policy.';
    }
  }
  return errors;
}

/** The settings as stored: the policy link is saved without surrounding spaces. */
export const normalizeOnlineBooking = (s: OnlineBookingSettings): OnlineBookingSettings => ({
  ...s,
  policyUrl: s.policyUrl.trim(),
});

/** What online booking shows with the search fields; null when the message is empty. */
export function globalBookingMessage(s: OnlineBookingSettings): string | null {
  const text = s.globalMessage.trim();
  return text === '' ? null : text;
}

export interface CancellationNotice {
  text: string;
  /** The full policy link, only when the switch is on and the address is valid. */
  policyUrl: string | null;
}

/** The short policy beside the agreement checkbox; null when none was written. */
export function cancellationNotice(s: OnlineBookingSettings): CancellationNotice | null {
  const text = s.cancellationAgreement.trim();
  if (text === '') return null;
  const link = s.includePolicyLink && isValidPolicyUrl(s.policyUrl) ? s.policyUrl.trim() : null;
  return { text, policyUrl: link };
}

/**
 * Whether the add-ons popup follows room selection. This switch is the club-wide master; the
 * per-audience "Display Add-On Popup" row of Booking Rules (7.5) narrows it (Q-96-1). A null row
 * (N/A, employee booking) does not narrow.
 */
export const showAddOnsPopup = (s: OnlineBookingSettings, audienceRule: boolean | null): boolean =>
  s.showAddOnsPopup && audienceRule !== false;
