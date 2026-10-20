import {
  ADMIN_HOLD_AUDIENCE,
  describeHold,
  formatHold,
  HOLD_WARNING_MS,
  holdMinutes,
  holdStatus,
} from './holdTimer';

const MIN = 60_000;

describe('hold timer', () => {
  it('uses the audience own minutes; admin-created reservations use the employee hold', () => {
    const hold = { employee: 15, member: 10, nonMember: 7 };
    expect(holdMinutes(hold, ADMIN_HOLD_AUDIENCE)).toBe(15);
    expect(holdMinutes(hold, 'member')).toBe(10);
    expect(holdMinutes(hold, 'nonMember')).toBe(7);
  });

  it('counts down from the moment the hold starts', () => {
    const t0 = 1_000_000;
    expect(holdStatus(t0, 15, t0)).toEqual({ phase: 'running', remainingMs: 15 * MIN });
    expect(holdStatus(t0, 15, t0 + 5 * MIN).remainingMs).toBe(10 * MIN);
  });

  it('warns under a minute and expires at zero, never going negative', () => {
    const t0 = 0;
    expect(holdStatus(t0, 2, 2 * MIN - HOLD_WARNING_MS).phase).toBe('running');
    expect(holdStatus(t0, 2, 2 * MIN - HOLD_WARNING_MS + 1).phase).toBe('warning');
    expect(holdStatus(t0, 2, 2 * MIN)).toEqual({ phase: 'expired', remainingMs: 0 });
    expect(holdStatus(t0, 2, 9 * MIN).remainingMs).toBe(0);
  });

  it('formats mm:ss, rounding partial seconds up', () => {
    expect(formatHold(15 * MIN)).toBe('15:00');
    expect(formatHold(9 * MIN + 42_000)).toBe('09:42');
    expect(formatHold(500)).toBe('00:01');
    expect(formatHold(0)).toBe('00:00');
    expect(formatHold(-5)).toBe('00:00');
  });

  it('describes the time left for announcements', () => {
    expect(describeHold(60_000)).toBe('1 minute');
    expect(describeHold(5 * MIN)).toBe('5 minutes');
    expect(describeHold(30_000)).toBe('30 seconds');
    expect(describeHold(1000)).toBe('1 second');
  });
});
