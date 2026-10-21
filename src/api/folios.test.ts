import { describe, expect, it } from 'vitest';
import { createMockClient } from './mock';
import { ApiError } from './types';

const client = () => createMockClient({ today: '2026-10-16' });

async function firstReservationIds() {
  const schedule = await client().schedule.get({ startDate: '2026-10-10', days: 14 });
  return [...new Set(schedule.blocks.map((b) => b.reservationId))];
}

describe('mock folios', () => {
  it('builds a folio for every scheduled reservation, with rooms, occupants and charges', async () => {
    const api = client();
    const ids = await firstReservationIds();
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids) {
      const folio = await api.folios.get(id);
      expect(folio.reservationId).toBe(id);
      expect(folio.rooms.length).toBeGreaterThan(0);
      expect(folio.occupants.length).toBeGreaterThan(0);
      expect(folio.charges.length).toBeGreaterThan(0);
      for (const c of folio.charges) {
        if (c.roomId) expect(folio.rooms.some((r) => r.id === c.roomId)).toBe(true);
        if (c.occupantId) expect(folio.occupants.some((o) => o.id === c.occupantId)).toBe(true);
        if (c.status === 'settled') expect(c.references.length).toBeGreaterThan(0);
      }
    }
  });

  it('is stable between calls and rejects an unknown reservation with 404', async () => {
    const api = client();
    const [id] = await firstReservationIds();
    expect(await api.folios.get(id)).toEqual(await api.folios.get(id));
    await expect(api.folios.get('nope')).rejects.toMatchObject({ status: 404 });
    await expect(api.folios.get('..')).rejects.toMatchObject({ status: 400 });
  });

  it('covers every folio state across the sample reservations', async () => {
    const api = client();
    const folios = await Promise.all((await firstReservationIds()).map((id) => api.folios.get(id)));
    expect(new Set(folios.map((f) => f.checkInStatus)).size).toBe(3);
    expect(folios.some((f) => f.charges.some((c) => c.status === 'unposted'))).toBe(true);
    expect(folios.some((f) => f.charges.some((c) => c.type === 'service-fee'))).toBe(true);
  });

  it('posts an unposted charge, once', async () => {
    const api = client();
    const ids = await firstReservationIds();
    let target: { reservationId: string; chargeId: string } | undefined;
    for (const id of ids) {
      const folio = await api.folios.get(id);
      const charge = folio.charges.find((c) => c.status === 'unposted');
      if (folio.open && charge) {
        target = { reservationId: id, chargeId: charge.id };
        break;
      }
    }
    expect(target).toBeDefined();
    const posted = await api.folios.postCharge({ requestId: 'req-00000001', ...target! });
    expect(posted.charges.find((c) => c.id === target!.chargeId)?.status).toBe('posted');
    // The same request replays; a new request for the now posted charge is refused.
    expect(await api.folios.postCharge({ requestId: 'req-00000001', ...target! })).toEqual(posted);
    const again = api.folios.postCharge({ requestId: 'req-00000002', ...target! });
    await expect(again).rejects.toBeInstanceOf(ApiError);
    await expect(again).rejects.toMatchObject({ status: 409, code: 'not-unposted' });
  });

  it('refuses to post on a closed folio', async () => {
    const api = client();
    for (const id of await firstReservationIds()) {
      const folio = await api.folios.get(id);
      if (!folio.open) {
        await expect(
          api.folios.postCharge({
            requestId: 'req-00000003',
            reservationId: id,
            chargeId: folio.charges[0].id,
          }),
        ).rejects.toMatchObject({ status: 409, code: 'folio-closed' });
        return;
      }
    }
    expect.fail('expected a closed folio in the sample data');
  });
});
