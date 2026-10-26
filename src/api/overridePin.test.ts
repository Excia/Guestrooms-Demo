import { createMockClient } from './mock';
import {
  createPinGuard,
  MAX_FAILED_PINS,
  MOCK_MANAGER_PIN,
  MOCK_PIN_HOLDERS,
  MOCK_STAFF_PIN,
  PIN_LOCKOUT_SECONDS,
} from './overridePin';
import type { CheckInReservationRequest, PermissionGrant } from './types';

const PERMISSION = 'reservation.check-in.any-time';

describe('createPinGuard holders without a permission set', () => {
  const now = () => new Date('2026-10-16T12:00:00Z');
  const holder = (over: object) => ({
    id: 'e',
    name: 'E',
    pin: '1111',
    grant: { role: 'x', permissions: [] } as PermissionGrant,
    ...over,
  });

  it('an employee with no set and no grant is never unrestricted', () => {
    const g = createPinGuard([holder({})], now);
    expect(g.check(PERMISSION, '1111')).toEqual({ kind: 'invalid' });
  });

  it('an unknown or missing set resolves to no grant, so the PIN is refused', () => {
    const resolve = () => null;
    const g = createPinGuard([holder({ permissionSetId: 'gone' })], now, undefined, resolve);
    expect(g.check(PERMISSION, '1111')).toEqual({ kind: 'invalid' });
  });
});

describe('createPinGuard', () => {
  let at = new Date('2026-10-16T12:00:00Z').getTime();
  const guard = () => createPinGuard(MOCK_PIN_HOLDERS, () => new Date(at));
  beforeEach(() => {
    at = new Date('2026-10-16T12:00:00Z').getTime();
  });

  it('accepts the PIN of an employee who holds the permission', () => {
    expect(guard().check(PERMISSION, MOCK_MANAGER_PIN)).toMatchObject({
      kind: 'valid',
      holder: { name: 'Morgan Reyes' },
    });
  });

  it('treats a holder without the permission like an unknown PIN', () => {
    const g = guard();
    expect(g.check(PERMISSION, MOCK_STAFF_PIN)).toEqual({ kind: 'invalid' });
    expect(g.check(PERMISSION, '0000')).toEqual({ kind: 'invalid' });
  });

  it('locks after the allowed wrong PINs and refuses even the right PIN while locked', () => {
    const g = guard();
    for (let i = 1; i < MAX_FAILED_PINS; i++)
      expect(g.check(PERMISSION, '0000').kind).toBe('invalid');
    expect(g.check(PERMISSION, '0000')).toEqual({
      kind: 'locked',
      retryAfterSeconds: PIN_LOCKOUT_SECONDS,
    });
    at += 60_000;
    expect(g.check(PERMISSION, MOCK_MANAGER_PIN)).toEqual({
      kind: 'locked',
      retryAfterSeconds: PIN_LOCKOUT_SECONDS - 60,
    });
    at += (PIN_LOCKOUT_SECONDS - 60) * 1000;
    expect(g.check(PERMISSION, MOCK_MANAGER_PIN).kind).toBe('valid');
  });

  it('a right PIN resets the count of wrong ones', () => {
    const g = guard();
    for (let i = 1; i < MAX_FAILED_PINS; i++) g.check(PERMISSION, '0000');
    expect(g.check(PERMISSION, MOCK_MANAGER_PIN).kind).toBe('valid');
    for (let i = 1; i < MAX_FAILED_PINS; i++)
      expect(g.check(PERMISSION, '0000').kind).toBe('invalid');
  });
});

describe('mock overrides.verifyPin', () => {
  const grant = (...permissions: string[]) => ({ role: 'Staff', permissions }) as PermissionGrant;
  const ARRIVAL = grant('reservation.edit', 'reservation.check-in.arrival-date');
  const mk = () => createMockClient({ today: '2026-10-16', grant: ARRIVAL });
  const ask = (c: ReturnType<typeof mk>, pin: string) =>
    c.overrides.verifyPin({ permission: PERMISSION, pin });

  it('answers valid, invalid and, after repeated wrong PINs, locked', async () => {
    const c = mk();
    expect(await ask(c, MOCK_MANAGER_PIN)).toEqual({ valid: true });
    expect(await ask(c, '9999')).toEqual({ valid: false });
    let last = await ask(c, '9999');
    for (let i = 3; i <= MAX_FAILED_PINS; i++) last = await ask(c, '9999');
    expect(last).toEqual({ valid: false, lockedForSeconds: PIN_LOCKOUT_SECONDS });
    expect(await ask(c, MOCK_MANAGER_PIN)).toMatchObject({
      valid: false,
      lockedForSeconds: expect.any(Number),
    });
  });

  it('the check in shares the lockout and answers 429 override-locked', async () => {
    const c = mk();
    for (let i = 0; i < MAX_FAILED_PINS; i++) await ask(c, '9999');
    const { version } = await c.reservations.getDetail('rs-31');
    const request: CheckInReservationRequest = {
      requestId: 'req-lock-in0000',
      reservationId: 'rs-31',
      version,
      reservationRoomIds: ['rr-28'],
      pastDateConfirmed: true,
      overrideCode: MOCK_MANAGER_PIN,
      checkOutAfter: false,
    };
    await expect(c.reservations.checkIn(request)).rejects.toMatchObject({
      status: 429,
      code: 'override-locked',
    });
  });

  it('the PIN of a holder without the permission is refused by the check in', async () => {
    const c = mk();
    const { version } = await c.reservations.getDetail('rs-31');
    await expect(
      c.reservations.checkIn({
        requestId: 'req-staff-in0000',
        reservationId: 'rs-31',
        version,
        reservationRoomIds: ['rr-28'],
        pastDateConfirmed: true,
        overrideCode: MOCK_STAFF_PIN,
        checkOutAfter: false,
      }),
    ).rejects.toMatchObject({ status: 403, code: 'override-invalid' });
  });
});
