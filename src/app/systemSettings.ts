// Business rules of System Settings (ticket 7.1): times, hour ranges and cross-field validation.
// Pure functions; the page and the settings context only call them.
import type { Duration, FolioDetails, SystemSettings } from '../api/types';
import { customTextProblem } from './registrationCard';

export const TIME_STEP_MINUTES = 5;
const MINUTES_PER_DAY = 24 * 60;

// Ranges from the functional requirements (6.2, 6.3 and 6.5); Figma does not state them.
/** Amount of the MPOS visibility and Close Settled Folios settings, in hours or days. */
export const DURATION_AMOUNT = { min: 0, max: 31 } as const;
export const ALT_RATE_NIGHTS = { min: 2, max: 99 } as const;

export const durationMinutes = ({ amount, unit }: Duration): number =>
  amount * (unit === 'days' ? MINUTES_PER_DAY : 60);

export const SERVICE_CHARGE_LABEL_MAX = 15;
export const FOLIO_LIMITS = {
  streetAddress: 100,
  city: 75,
  zip: 10,
  phone: 20,
  email: 100,
  customText: 400,
} as const;

/** `HH:mm` to minutes after midnight; null when it is not a valid time. */
export function parseTime(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export function formatTimeValue(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "16:00" becomes "4:00 PM". Invalid input is returned unchanged. */
export function formatTime12(value: string): string {
  const total = parseTime(value);
  if (total === null) return value;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const isOnTimeStep = (value: string): boolean => {
  const total = parseTime(value);
  return total !== null && total % TIME_STEP_MINUTES === 0;
};

/**
 * Late Checkout Time options: every 5 minutes from the standard checkout time (exclusive) to the
 * standard check-in time (inclusive), as the Figma annotation says. Empty when check-in is not
 * later than checkout.
 */
export function lateCheckoutOptions(checkOut: string, checkIn: string): string[] {
  const from = parseTime(checkOut);
  const to = parseTime(checkIn);
  if (from === null || to === null || to <= from) return [];
  const options: string[] = [];
  for (let t = from + TIME_STEP_MINUTES; t <= to; t += TIME_STEP_MINUTES) {
    options.push(formatTimeValue(t));
  }
  return options;
}

/** Whole minutes the late checkout time lies after the standard checkout time (0 when not later). */
export function lateCheckoutOffsetMinutes(checkOut: string, late: string): number {
  const out = parseTime(checkOut);
  const l = parseTime(late);
  if (out === null || l === null) return 0;
  return Math.max(0, (l - out + MINUTES_PER_DAY) % MINUTES_PER_DAY);
}

export type SystemSettingsField =
  | 'checkInTime'
  | 'checkOutTime'
  | 'lateCheckOutTime'
  | 'mposVisibleBefore'
  | 'mposVisibleAfter'
  | 'closeSettledFolios'
  | 'nightAuditRunTime'
  | 'alternativeBaseRate1'
  | 'alternativeBaseRate2'
  | 'serviceChargeLabel'
  | 'folio.streetAddress'
  | 'folio.city'
  | 'folio.zip'
  | 'folio.email'
  | 'folio.phone'
  | 'folio.customText'
  | 'registrationCard.customText';

/** Messages per field; Close Settled Folios can break two rules at once, as Figma shows. */
export type SystemSettingsErrors = Partial<Record<SystemSettingsField, string[]>>;

export const MESSAGES = {
  closeAfterMpos:
    'Close Settled Folios value must be larger than the MPOS Visibility setting after checkout.',
  closeAfterLate: 'Close Settled Folios value must extend past Late Checkout Time.',
  mposAfterLate: 'Folio visibility must extend past Late Checkout Time.',
} as const;

const inRange = (n: number, r: { min: number; max: number }) =>
  Number.isInteger(n) && n >= r.min && n <= r.max;

/**
 * Every rule that stops a save. The rules from the Figma annotations:
 * - Close Settled Folios must be later than "Folio is no longer visible" (MPOS, after checkout).
 * - Both must extend past the Late Checkout Time while early/late is on (hours after the standard
 *   checkout time compared with the late checkout time's offset; strictly later).
 * - Late Checkout Time lies after the checkout time and no later than the check-in time.
 */
export function validateSystemSettings(s: SystemSettings): SystemSettingsErrors {
  const errors: SystemSettingsErrors = {};
  const add = (field: SystemSettingsField, message: string) => {
    (errors[field] ??= []).push(message);
  };

  if (!isOnTimeStep(s.checkInTime)) add('checkInTime', 'Enter a time in 5-minute steps.');
  if (!isOnTimeStep(s.checkOutTime)) add('checkOutTime', 'Enter a time in 5-minute steps.');

  let lateOffset = 0;
  if (s.earlyLateEnabled) {
    if (!lateCheckoutOptions(s.checkOutTime, s.checkInTime).includes(s.lateCheckOutTime)) {
      add(
        'lateCheckOutTime',
        'Late Checkout Time must be after the checkout time and no later than the check in time.',
      );
    } else {
      lateOffset = lateCheckoutOffsetMinutes(s.checkOutTime, s.lateCheckOutTime);
    }
  }

  const validDuration = (d: Duration) =>
    inRange(d.amount, DURATION_AMOUNT) && (d.unit === 'hours' || d.unit === 'days');
  const rangeMessage = `Choose ${DURATION_AMOUNT.min} to ${DURATION_AMOUNT.max}.`;
  if (!validDuration(s.mposVisibleBefore)) add('mposVisibleBefore', rangeMessage);
  if (!validDuration(s.mposVisibleAfter)) {
    add('mposVisibleAfter', rangeMessage);
  } else if (s.earlyLateEnabled && durationMinutes(s.mposVisibleAfter) <= lateOffset) {
    add('mposVisibleAfter', MESSAGES.mposAfterLate);
  }

  if (!validDuration(s.closeSettledFolios)) {
    add('closeSettledFolios', rangeMessage);
  } else {
    const close = durationMinutes(s.closeSettledFolios);
    if (validDuration(s.mposVisibleAfter) && close <= durationMinutes(s.mposVisibleAfter)) {
      add('closeSettledFolios', MESSAGES.closeAfterMpos);
    }
    if (s.earlyLateEnabled && close <= lateOffset)
      add('closeSettledFolios', MESSAGES.closeAfterLate);
  }

  if (s.nightAudit === 'automatic' && !isOnTimeStep(s.nightAuditRunTime)) {
    add('nightAuditRunTime', 'Enter the run time in 5-minute steps.');
  }

  for (const key of ['alternativeBaseRate1', 'alternativeBaseRate2'] as const) {
    if (s[key].enabled && !inRange(s[key].minNights, ALT_RATE_NIGHTS)) {
      add(key, `Choose ${ALT_RATE_NIGHTS.min} to ${ALT_RATE_NIGHTS.max} nights.`);
    }
  }

  // The two ranges chain (1-6 standard, 7-13 alternative 1, 14+ alternative 2), so 2 starts later.
  if (
    s.alternativeBaseRate1.enabled &&
    s.alternativeBaseRate2.enabled &&
    s.alternativeBaseRate2.minNights <= s.alternativeBaseRate1.minNights &&
    !errors.alternativeBaseRate2
  ) {
    add(
      'alternativeBaseRate2',
      'Alternative Base Rate 2 must start after Alternative Base Rate 1.',
    );
  }

  const label = s.serviceChargeLabel.trim();
  if (label === '') add('serviceChargeLabel', 'Enter a service charge label.');
  else if (label.length > SERVICE_CHARGE_LABEL_MAX) {
    add('serviceChargeLabel', `Use ${SERVICE_CHARGE_LABEL_MAX} characters or fewer.`);
  }

  for (const [field, message] of Object.entries(validateFolioDetails(s.folio))) {
    add(field as SystemSettingsField, message[0]);
  }
  const cardText = customTextProblem(s.registrationCard.customText);
  if (cardText) add('registrationCard.customText', cardText);
  return errors;
}

export function validateFolioDetails(f: FolioDetails): SystemSettingsErrors {
  const errors: SystemSettingsErrors = {};
  const tooLong = (field: SystemSettingsField, value: string, key: keyof typeof FOLIO_LIMITS) => {
    if (value.length > FOLIO_LIMITS[key]) {
      errors[field] = [`Use ${FOLIO_LIMITS[key]} characters or fewer.`];
    }
  };
  tooLong('folio.streetAddress', f.streetAddress, 'streetAddress');
  tooLong('folio.city', f.city, 'city');
  tooLong('folio.zip', f.zip, 'zip');
  tooLong('folio.phone', f.phone, 'phone');
  tooLong('folio.customText', f.customText, 'customText');
  const email = f.email.trim();
  if (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors['folio.email'] = ['Enter a valid email address.'];
  } else {
    tooLong('folio.email', f.email, 'email');
  }
  return errors;
}

/** Fields in page order, so the first error can take focus. */
export const FIELD_ORDER: readonly SystemSettingsField[] = [
  'checkInTime',
  'checkOutTime',
  'lateCheckOutTime',
  'mposVisibleBefore',
  'mposVisibleAfter',
  'closeSettledFolios',
  'nightAuditRunTime',
  'alternativeBaseRate1',
  'alternativeBaseRate2',
  'serviceChargeLabel',
  'folio.streetAddress',
  'folio.city',
  'folio.zip',
  'folio.email',
  'folio.phone',
  'folio.customText',
  'registrationCard.customText',
];

export const isRegistrationCardField = (field: SystemSettingsField) =>
  field.startsWith('registrationCard.');

export const isFolioField = (field: SystemSettingsField) => field.startsWith('folio.');

export function firstErrorField(errors: SystemSettingsErrors): SystemSettingsField | null {
  return FIELD_ORDER.find((f) => errors[f]) ?? null;
}

/** True when the draft differs from what was last saved. */
export const isDirty = (saved: SystemSettings, draft: SystemSettings): boolean =>
  JSON.stringify(saved) !== JSON.stringify(draft);

/**
 * Changing the checkout or check-in time can leave the late checkout time outside its options;
 * it then moves to the nearest valid option (the first, when the previous one is gone).
 */
export function withLateCheckoutInRange(s: SystemSettings): SystemSettings {
  const options = lateCheckoutOptions(s.checkOutTime, s.checkInTime);
  if (options.length === 0 || options.includes(s.lateCheckOutTime)) return s;
  return { ...s, lateCheckOutTime: options[0] };
}

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'] as const;

/** Why a chosen logo file is refused, or null when it is fine. */
export function logoFileProblem(file: { type: string; size: number }): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
    return 'The logo must be a PNG, JPG or SVG image.';
  }
  if (file.size > LOGO_MAX_BYTES) return 'The logo must be smaller than 2 MB.';
  return null;
}
