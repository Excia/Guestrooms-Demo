import { mockOnlineBookingSettings } from '../api/systemSettingsData';
import type { OnlineBookingSettings } from '../api/types';
import {
  cancellationNotice,
  globalBookingMessage,
  isValidPolicyUrl,
  normalizeOnlineBooking,
  showAddOnsPopup,
  validateOnlineBooking,
} from './onlineBookingSettings';

const base = (over: Partial<OnlineBookingSettings> = {}): OnlineBookingSettings => ({
  ...mockOnlineBookingSettings(),
  ...over,
});

describe('policy url', () => {
  it('accepts absolute http and https addresses', () => {
    expect(isValidPolicyUrl('https://www.clubname.com/guestroomspolicy')).toBe(true);
    expect(isValidPolicyUrl(' http://club.org/p ')).toBe(true);
  });
  it('rejects other schemes, bare words, blanks and spaces', () => {
    for (const bad of [
      '',
      'clubname',
      'www.club.com',
      'javascript:alert(1)',
      'ftp://a.com/x',
      'https://a b.com',
      'https://localhost',
      'https://user:pass@club.com/p',
      'https://user@club.com/p',
    ]) {
      expect(isValidPolicyUrl(bad)).toBe(false);
    }
  });
});

describe('validateOnlineBooking', () => {
  it('passes the default values', () => {
    expect(validateOnlineBooking(base())).toEqual({});
  });
  it('limits the message to 150 and the agreement to 300 characters', () => {
    expect(validateOnlineBooking(base({ globalMessage: 'a'.repeat(150) }))).toEqual({});
    expect(validateOnlineBooking(base({ globalMessage: 'a'.repeat(151) }))).toHaveProperty([
      'onlineBooking.globalMessage',
    ]);
    expect(validateOnlineBooking(base({ cancellationAgreement: 'a'.repeat(300) }))).toEqual({});
    expect(validateOnlineBooking(base({ cancellationAgreement: 'a'.repeat(301) }))).toHaveProperty([
      'onlineBooking.cancellationAgreement',
    ]);
  });
  it('requires a valid url only while the link switch is on', () => {
    expect(validateOnlineBooking(base({ includePolicyLink: true, policyUrl: '' }))).toHaveProperty([
      'onlineBooking.policyUrl',
    ]);
    expect(
      validateOnlineBooking(base({ includePolicyLink: true, policyUrl: 'nope' })),
    ).toHaveProperty(['onlineBooking.policyUrl']);
    expect(validateOnlineBooking(base({ includePolicyLink: false, policyUrl: 'nope' }))).toEqual(
      {},
    );
  });
});

describe('what online booking reads', () => {
  it('hides an empty global message', () => {
    expect(globalBookingMessage(base({ globalMessage: '   ' }))).toBeNull();
    expect(globalBookingMessage(base({ globalMessage: ' Call us ' }))).toBe('Call us');
  });
  it('adds the policy link only when on and valid', () => {
    const on = base({ includePolicyLink: true, policyUrl: 'https://a.com/p' });
    expect(cancellationNotice(on)?.policyUrl).toBe('https://a.com/p');
    expect(cancellationNotice({ ...on, includePolicyLink: false })?.policyUrl).toBeNull();
    expect(cancellationNotice({ ...on, policyUrl: 'x' })?.policyUrl).toBeNull();
    expect(cancellationNotice(base({ cancellationAgreement: '' }))).toBeNull();
  });
  it('narrows the popup by the Booking Rules row', () => {
    const on = base({ showAddOnsPopup: true });
    expect(showAddOnsPopup(on, null)).toBe(true);
    expect(showAddOnsPopup(on, true)).toBe(true);
    expect(showAddOnsPopup(on, false)).toBe(false);
    expect(showAddOnsPopup({ ...on, showAddOnsPopup: false }, true)).toBe(false);
  });
});

describe('trimmed policy url', () => {
  it('validates the trimmed length and saves the trimmed value', () => {
    const padded = `  https://club.com/${'a'.repeat(1980)}  `;
    expect(padded.length).toBeGreaterThan(2000);
    expect(validateOnlineBooking(base({ includePolicyLink: true, policyUrl: padded }))).toEqual({});
    expect(normalizeOnlineBooking(base({ policyUrl: '  https://club.com/p ' })).policyUrl).toBe(
      'https://club.com/p',
    );
  });
});
