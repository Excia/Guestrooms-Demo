import { mockSystemSettings } from '../api/systemSettingsData';
import type { SystemSettings } from '../api/types';
import {
  firstErrorField,
  formatTime12,
  durationMinutes,
  isDirty,
  isOnTimeStep,
  lateCheckoutOffsetMinutes,
  lateCheckoutOptions,
  logoFileProblem,
  MESSAGES,
  parseTime,
  validateSystemSettings,
  withLateCheckoutInRange,
} from './systemSettings';

const h = (amount: number) => ({ amount, unit: 'hours' as const });
const base = (over: Partial<SystemSettings> = {}): SystemSettings => ({
  ...mockSystemSettings(),
  ...over,
});

describe('times', () => {
  it('parses HH:mm and rejects anything else', () => {
    expect(parseTime('16:05')).toBe(16 * 60 + 5);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('7:00')).toBeNull();
    expect(parseTime('')).toBeNull();
  });

  it('formats 12-hour times', () => {
    expect(formatTime12('16:00')).toBe('4:00 PM');
    expect(formatTime12('00:05')).toBe('12:05 AM');
    expect(formatTime12('12:00')).toBe('12:00 PM');
  });

  it('accepts only 5-minute steps', () => {
    expect(isOnTimeStep('16:05')).toBe(true);
    expect(isOnTimeStep('16:03')).toBe(false);
  });

  it('offers late checkout times after checkout up to check in, in 5-minute steps', () => {
    const options = lateCheckoutOptions('12:00', '16:00');
    expect(options[0]).toBe('12:05');
    expect(options.at(-1)).toBe('16:00');
    expect(options).not.toContain('12:00');
    expect(options).toHaveLength(48);
    expect(lateCheckoutOptions('16:00', '12:00')).toEqual([]);
  });

  it('measures the late checkout offset in minutes', () => {
    expect(lateCheckoutOffsetMinutes('12:00', '15:00')).toBe(180);
    expect(lateCheckoutOffsetMinutes('12:00', '11:00')).toBe(23 * 60);
  });

  it('moves the late checkout time into range when check in or checkout changes', () => {
    const moved = withLateCheckoutInRange(base({ checkInTime: '14:00' }));
    expect(moved.lateCheckOutTime).toBe('12:05');
    const kept = withLateCheckoutInRange(base());
    expect(kept.lateCheckOutTime).toBe('15:00');
  });
});

describe('validateSystemSettings', () => {
  it('accepts the Figma values', () => {
    expect(validateSystemSettings(base())).toEqual({});
  });

  it('requires Close Settled Folios to be larger than the MPOS visibility after checkout', () => {
    const errors = validateSystemSettings(
      base({ mposVisibleAfter: h(6), closeSettledFolios: h(6), earlyLateEnabled: false }),
    );
    expect(errors.closeSettledFolios).toEqual([MESSAGES.closeAfterMpos]);
    expect(
      validateSystemSettings(
        base({ mposVisibleAfter: h(6), closeSettledFolios: h(7), earlyLateEnabled: false }),
      ),
    ).toEqual({});
  });

  it('requires Close Settled Folios to extend past the Late Checkout Time', () => {
    // Late checkout is 3 hours after checkout; closing after 3 hours is not past it.
    const errors = validateSystemSettings(
      base({ mposVisibleAfter: h(1), closeSettledFolios: h(3) }),
    );
    expect(errors.closeSettledFolios).toEqual([MESSAGES.closeAfterLate]);
    expect(
      validateSystemSettings(base({ mposVisibleAfter: h(1), closeSettledFolios: h(4) }))
        .closeSettledFolios,
    ).toBeUndefined();
  });

  it('reports both Close Settled Folios rules at once (Figma error state)', () => {
    const errors = validateSystemSettings(base({ closeSettledFolios: h(1) }));
    expect(errors.closeSettledFolios).toEqual([MESSAGES.closeAfterMpos, MESSAGES.closeAfterLate]);
  });

  it('requires folio visibility after checkout to extend past the Late Checkout Time', () => {
    const errors = validateSystemSettings(
      base({ mposVisibleAfter: h(3), closeSettledFolios: h(10) }),
    );
    expect(errors.mposVisibleAfter).toEqual([MESSAGES.mposAfterLate]);
    expect(
      validateSystemSettings(base({ mposVisibleAfter: h(4), closeSettledFolios: h(10) })),
    ).toEqual({});
  });

  it('ignores the late checkout rules while early/late is off', () => {
    const errors = validateSystemSettings(
      base({
        earlyLateEnabled: false,
        lateCheckOutTime: '23:00',
        mposVisibleAfter: h(1),
        closeSettledFolios: h(2),
      }),
    );
    expect(errors).toEqual({});
  });

  it('keeps the late checkout time between checkout and check in', () => {
    expect(
      validateSystemSettings(base({ lateCheckOutTime: '17:00' })).lateCheckOutTime,
    ).toBeDefined();
    expect(
      validateSystemSettings(base({ lateCheckOutTime: '12:00' })).lateCheckOutTime,
    ).toBeDefined();
    expect(
      validateSystemSettings(base({ lateCheckOutTime: '16:00' })).lateCheckOutTime,
    ).toBeUndefined();
  });

  it('rejects times off the 5-minute step', () => {
    expect(validateSystemSettings(base({ checkInTime: '16:03' })).checkInTime).toBeDefined();
  });

  it('checks the hour and night ranges', () => {
    expect(
      validateSystemSettings(base({ mposVisibleBefore: h(32) })).mposVisibleBefore,
    ).toBeDefined();
    expect(
      validateSystemSettings(base({ closeSettledFolios: h(0) })).closeSettledFolios,
    ).toBeDefined();
    const alt = validateSystemSettings(
      base({ alternativeBaseRate1: { enabled: true, minNights: 1 } }),
    );
    expect(alt.alternativeBaseRate1).toBeDefined();
    // A disabled rate is not checked.
    expect(
      validateSystemSettings(base({ alternativeBaseRate2: { enabled: false, minNights: 1 } })),
    ).toEqual({});
  });

  it('limits the service charge label to 15 characters and requires it', () => {
    expect(
      validateSystemSettings(base({ serviceChargeLabel: 'x'.repeat(16) })).serviceChargeLabel,
    ).toBeDefined();
    expect(
      validateSystemSettings(base({ serviceChargeLabel: 'x'.repeat(15) })).serviceChargeLabel,
    ).toBeUndefined();
    expect(
      validateSystemSettings(base({ serviceChargeLabel: '  ' })).serviceChargeLabel,
    ).toBeDefined();
  });

  it('validates the folio details', () => {
    const s = base();
    const errors = validateSystemSettings({
      ...s,
      folio: { ...s.folio, email: 'nope', customText: 'x'.repeat(401), zip: '1'.repeat(11) },
    });
    expect(errors['folio.email']).toBeDefined();
    expect(errors['folio.customText']).toBeDefined();
    expect(errors['folio.zip']).toBeDefined();
    expect(errors['folio.city']).toBeUndefined();
    expect(validateSystemSettings({ ...s, folio: { ...s.folio, email: '' } })).toEqual({});
  });

  it('finds the first error in page order', () => {
    expect(firstErrorField({ 'folio.city': ['x'], closeSettledFolios: ['y'] })).toBe(
      'closeSettledFolios',
    );
    expect(firstErrorField({})).toBeNull();
  });
});

describe('durations and the doc rules', () => {
  it('compares days with hours', () => {
    // 1 day after checkout extends past a late checkout 3 hours after checkout.
    const errors = validateSystemSettings(
      base({ mposVisibleAfter: h(2), closeSettledFolios: { amount: 1, unit: 'days' } }),
    );
    expect(errors.closeSettledFolios).toBeUndefined();
    expect(
      validateSystemSettings(
        base({ mposVisibleAfter: { amount: 1, unit: 'days' }, closeSettledFolios: h(20) }),
      ).closeSettledFolios,
    ).toEqual([MESSAGES.closeAfterMpos]);
  });

  it('allows 0 to 31 hours or days only', () => {
    expect(
      validateSystemSettings(base({ mposVisibleBefore: h(0) })).mposVisibleBefore,
    ).toBeUndefined();
    expect(
      validateSystemSettings(base({ mposVisibleBefore: h(32) })).mposVisibleBefore,
    ).toBeDefined();
    expect(durationMinutes({ amount: 2, unit: 'days' })).toBe(2880);
  });

  it('needs a run time on the 5-minute step only for an automatic night audit', () => {
    expect(validateSystemSettings(base({ nightAuditRunTime: '02:03' }))).toEqual({});
    expect(
      validateSystemSettings(base({ nightAudit: 'automatic', nightAuditRunTime: '02:03' }))
        .nightAuditRunTime,
    ).toBeDefined();
  });

  it('chains the alternative base rates up to 99 nights', () => {
    const rates = (n1: number, n2: number) =>
      validateSystemSettings(
        base({
          alternativeBaseRate1: { enabled: true, minNights: n1 },
          alternativeBaseRate2: { enabled: true, minNights: n2 },
        }),
      );
    expect(rates(7, 14)).toEqual({});
    expect(rates(7, 7).alternativeBaseRate2).toBeDefined();
    expect(rates(7, 99).alternativeBaseRate2).toBeUndefined();
    expect(rates(7, 100).alternativeBaseRate2).toBeDefined();
  });
});

describe('isDirty', () => {
  it('compares the draft with the saved settings', () => {
    const saved = base();
    expect(isDirty(saved, structuredClone(saved))).toBe(false);
    expect(isDirty(saved, { ...saved, serviceChargeLabel: 'Fee' })).toBe(true);
  });
});

describe('logoFileProblem', () => {
  it('accepts small images and refuses other types and large files', () => {
    expect(logoFileProblem({ type: 'image/png', size: 1000 })).toBeNull();
    expect(logoFileProblem({ type: 'application/pdf', size: 1000 })).toMatch(/PNG, JPG or SVG/);
    expect(logoFileProblem({ type: 'image/png', size: 3 * 1024 * 1024 })).toMatch(/2 MB/);
  });
});
