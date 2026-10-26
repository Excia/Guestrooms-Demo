import { createMockClient } from './mock';
import { MAX_FAILED_PINS, MOCK_MANAGER_PIN, MOCK_STAFF_PIN } from './overridePin';
import { UNLOCK_PERMISSION } from '../app/overrideUnlock';
import type { ApiClient, ChangeRoomRequest, PermissionGrant } from './types';

const T = '2026-10-16';
const window = { startDate: '2026-10-06', days: 30 } as const;
// Victor Almeida (rr-14): rm-301 Suite, checked in, nights 10/16 to 10/19 can change; rm-110 is a free Suite.
const NIGHTS = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];

const grant = (...permissions: string[]) => ({ role: 'Staff', permissions }) as PermissionGrant;
const EDIT_ONLY = grant('reservation.edit');
const ALL_FUNCTIONS = grant('reservation.edit', ...Object.values(UNLOCK_PERMISSION));

let n = 0;
async function request(c: ApiClient, over: Partial<ChangeRoomRequest> = {}) {
  const b = (await c.schedule.get(window)).blocks.find((x) => x.id === 'rr-14')!;
  return {
    requestId: `unlock-${++n}-test`,
    reservationRoomId: 'rr-14',
    fromRoomId: b.roomId,
    version: b.version,
    nights: NIGHTS.map((date) => ({ date, roomId: date === '2026-10-19' ? 'rm-110' : b.roomId })),
    rateChoice: 'update',
    ...over,
  } as ChangeRoomRequest;
}
const mk = (g: PermissionGrant) => createMockClient({ today: T, grant: g });

const BOTH = (pin: string) => ({ room: pin, location: pin });

describe('mock room change and the Change Reservation functions', () => {
  // The default plan moves the last night to rm-110: another room in another location (same type), so
  // it needs the Room and the Location function.
  it('a user who holds every function needs no code', async () => {
    const c = mk(ALL_FUNCTIONS);
    await expect(c.reservations.changeRoomDuringStay(await request(c))).resolves.toBeDefined();
  });

  it('refuses a change without the function and without a code (override-required)', async () => {
    const c = mk(EDIT_ONLY);
    await expect(c.reservations.changeRoomDuringStay(await request(c))).rejects.toMatchObject({
      status: 403,
      code: 'override-required',
    });
  });

  it('needs a code for every field the change touches, not just one', async () => {
    const c = mk(EDIT_ONLY);
    await expect(
      c.reservations.changeRoomDuringStay(
        await request(c, { overrideCodes: { room: MOCK_MANAGER_PIN } }),
      ),
    ).rejects.toMatchObject({ status: 403, code: 'override-required' });
  });

  it('refuses a wrong PIN and the PIN of someone without the function (override-invalid)', async () => {
    const c = mk(EDIT_ONLY);
    for (const pin of ['0000', MOCK_STAFF_PIN]) {
      await expect(
        c.reservations.changeRoomDuringStay(await request(c, { overrideCodes: BOTH(pin) })),
      ).rejects.toMatchObject({ status: 403, code: 'override-invalid' });
    }
    await expect(
      c.reservations.changeRoomDuringStay(
        await request(c, { overrideCodes: { room: MOCK_MANAGER_PIN, location: '0000' } }),
      ),
    ).rejects.toMatchObject({ status: 403, code: 'override-invalid' });
  });

  it('a room in the same location and type needs only the Room code', async () => {
    const c = mk(grant('reservation.edit', UNLOCK_PERMISSION.location, UNLOCK_PERMISSION.roomType));
    const req = await request(c, {
      nights: NIGHTS.map((date) => ({ date, roomId: date === '2026-10-16' ? 'rm-302' : 'rm-301' })),
    });
    await expect(c.reservations.changeRoomDuringStay(req)).rejects.toMatchObject({
      code: 'override-required',
    });
    await expect(
      c.reservations.changeRoomDuringStay({ ...req, overrideCodes: { room: MOCK_MANAGER_PIN } }),
    ).resolves.toBeDefined();
  });

  it('accepts the PINs of holders and applies the change; a replay with other codes conflicts', async () => {
    const c = mk(EDIT_ONLY);
    const req = await request(c, { overrideCodes: BOTH(MOCK_MANAGER_PIN) });
    const first = await c.reservations.changeRoomDuringStay(req);
    expect(await c.reservations.changeRoomDuringStay(req)).toEqual(first);
    await expect(
      c.reservations.changeRoomDuringStay({ ...req, overrideCodes: BOTH('0000') }),
    ).rejects.toMatchObject({ code: 'idempotency-conflict' });
  });

  it('locks out after repeated wrong PINs (429 override-locked)', async () => {
    const c = mk(EDIT_ONLY);
    for (let i = 0; i < MAX_FAILED_PINS - 1; i++) {
      await c.reservations
        .changeRoomDuringStay(await request(c, { overrideCodes: BOTH('0000') }))
        .catch(() => undefined);
    }
    await expect(
      c.reservations.changeRoomDuringStay(await request(c, { overrideCodes: BOTH('0000') })),
    ).rejects.toMatchObject({ status: 429, code: 'override-locked' });
  });

  it('verify accepts each change function and needs reservation.edit', async () => {
    const c = mk(EDIT_ONLY);
    for (const permission of [
      'function.changeReservationRoom',
      'function.changeReservationRoomType',
      'function.changeReservationLocation',
    ] as const) {
      await expect(c.overrides.verifyPin({ permission, pin: MOCK_MANAGER_PIN })).resolves.toEqual({
        valid: true,
      });
    }
    await expect(
      mk(grant()).overrides.verifyPin({
        permission: 'function.changeReservationRoom',
        pin: MOCK_MANAGER_PIN,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
