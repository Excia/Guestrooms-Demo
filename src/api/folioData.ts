// Mock folios, built on first use from the reservation's detail and kept in memory so that posting a
// charge sticks for the life of the client. Replaced by the backend later.
import { daysBetween } from '../lib/dates';
import { buildDetail } from './reservationDetailData';
import type { ScheduleState } from './scheduleData';
import type {
  Folio,
  FolioCharge,
  FolioOccupant,
  FolioPayment,
  PostChargeRequest,
  ReservationDetail,
} from './types';
import { ApiError } from './types';

export type FolioStore = Map<string, Folio>;

/** The reservation's trailing number ("rs-14" gives 14), so the sample data cycles through the folio states. */
const trailingNumber = (id: string) => Number(/(\d+)$/.exec(id)?.[1] ?? hash(id));

/** Stable small hash: every reservation gets the same placeholder folio each time. */
function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function occupantsOf(detail: ReservationDetail): FolioOccupant[] {
  const occupants: FolioOccupant[] = detail.rooms.map((room, i) => ({
    id: `${detail.id}-occ-${i + 1}`,
    name: i === 0 ? detail.leadOccupant.name : `Guest ${i + 1}`,
    roomId: room.id,
  }));
  if (detail.rooms.length === 1 && detail.adults > 1) {
    occupants.push({ id: `${detail.id}-occ-2`, name: 'Guest 2', roomId: detail.rooms[0].id });
  }
  return occupants;
}

function buildFolio(state: ScheduleState, reservationId: string): Folio {
  const detail = buildDetail(state, reservationId);
  const h = hash(reservationId);
  const checkInStatus =
    detail.status === 'checked-in'
      ? 'checked-in'
      : detail.status === 'checked-out'
        ? 'checked-out'
        : 'not-checked-in';
  const occupants = occupantsOf(detail);

  // One room-rate line per night, per room (the detail's stay lines are in room order).
  const charges: FolioCharge[] = [];
  let next = 0;
  detail.rooms.forEach((room, ri) => {
    const nights = daysBetween(room.arrival, room.departure);
    const lines = detail.stay.lines.slice(next, next + nights);
    next += nights;
    lines.forEach((line, n) => {
      charges.push({
        id: `${reservationId}-rate-${ri + 1}-${n + 1}`,
        type: 'room-rate',
        date: line.date,
        description: `${room.roomNumber ?? 'Unassigned'} - ${line.roomType}`,
        amountCents: line.amountCents,
        // A night is charged once the room is in house (ticket 163): a room still waiting for check in
        // keeps its past nights unposted until it checks in.
        status:
          (line.date < state.today && room.status !== 'nyci') || checkInStatus === 'checked-out'
            ? 'posted'
            : 'unposted',
        references: [],
        roomId: room.id,
        occupantId: null,
      });
    });
  });

  const firstRoom = detail.rooms[0];
  const lead = occupants[0];
  if (h % 2 === 0 && firstRoom) {
    charges.push(
      {
        id: `${reservationId}-mpos-1`,
        type: 'mpos',
        date: state.today,
        description: `MPOS - ${firstRoom.roomNumber ?? 'Unassigned'} ${lead.name} 100${h % 900}`,
        amountCents: 4250,
        status: 'posted',
        references: [],
        roomId: firstRoom.id,
        occupantId: lead.id,
      },
      {
        id: `${reservationId}-manual-1`,
        type: 'manual',
        date: state.today,
        description: `Late Checkout Fee - ${firstRoom.roomNumber ?? 'Unassigned'} ${lead.name}`,
        amountCents: 2500,
        status: 'unposted',
        references: [],
        roomId: firstRoom.id,
        occupantId: lead.id,
      },
    );
  }

  const payments: FolioPayment[] = [];
  let open = true;
  if (checkInStatus === 'checked-out') {
    const n = trailingNumber(reservationId);
    const outcome = n % 3;
    if (outcome === 0) {
      // Fully settled to one card on file: every line shares one reference and a service fee applies.
      const reference = String(100 + (h % 900));
      const total = charges.reduce((sum, c) => sum + c.amountCents, 0);
      for (const c of charges) {
        c.status = 'settled';
        c.references = [reference];
      }
      const fee = Math.round(total * 0.03);
      charges.push({
        id: `${reservationId}-fee-1`,
        type: 'service-fee',
        date: state.today,
        description: `Service Fee - Ref #${reference}`,
        amountCents: fee,
        status: 'settled',
        references: [reference],
        roomId: null,
        occupantId: null,
      });
      payments.push({
        id: `${reservationId}-pay-1`,
        typeLabel: 'Credit Card',
        date: state.today,
        reference,
        ticket: null,
        description: 'Visa ending 4242',
        amountCents: total + fee,
        status: 'Settled (Successful)',
      });
      open = n % 2 !== 0; // settled and past the Close Settled Folios time: closed
    } else if (outcome === 2) {
      const last = [...charges].reverse().find((c) => c.type === 'room-rate');
      if (last) last.status = 'unposted';
    }
  } else if (h % 4 === 1) {
    payments.push({
      id: `${reservationId}-pay-1`,
      typeLabel: 'Deposit',
      date: state.today,
      reference: String(200 + (h % 800)),
      ticket: null,
      description: 'Visa ending 1881',
      amountCents: 10000,
      status: 'Settled (Successful)',
    });
  }

  // Every fourth reservation shows a split: the first posted night becomes a parent with two parts.
  const splitSource =
    trailingNumber(reservationId) % 4 === 0 &&
    charges.find((c) => c.type === 'room-rate' && c.status === 'posted');
  if (splitSource) {
    const half = Math.floor(splitSource.amountCents / 2);
    const original = splitSource.description;
    const at = charges.indexOf(splitSource);
    charges.splice(
      at,
      1,
      {
        ...splitSource,
        type: 'split-parent',
        status: 'split',
        description: 'Custom Selection (1)',
      },
      {
        ...splitSource,
        id: `${splitSource.id}-a`,
        type: 'split-child',
        description: `Split of ${original}`,
        amountCents: half,
      },
      {
        ...splitSource,
        id: `${splitSource.id}-b`,
        type: 'split-child',
        description: `Split of ${original}`,
        amountCents: splitSource.amountCents - half,
      },
    );
  }

  return {
    reservationId,
    confirmationNumber: detail.confirmationNumber,
    checkInStatus,
    open,
    mposVisible: h % 5 !== 0,
    nights: detail.nights,
    guests: detail.adults + detail.children,
    rooms: detail.rooms.map((r) => ({ id: r.id, number: r.roomNumber })),
    occupants,
    charges,
    payments,
  };
}

export function getFolio(state: ScheduleState, store: FolioStore, reservationId: string): Folio {
  let folio = store.get(reservationId);
  if (!folio) {
    folio = buildFolio(state, reservationId);
    store.set(reservationId, folio);
  }
  return structuredClone(folio);
}

export function postCharge(
  state: ScheduleState,
  store: FolioStore,
  request: PostChargeRequest,
): Folio {
  getFolio(state, store, request.reservationId);
  const folio = store.get(request.reservationId)!;
  if (!folio.open) {
    throw new ApiError(409, 'The folio is closed', { code: 'folio-closed' });
  }
  const charge = folio.charges.find((c) => c.id === request.chargeId);
  if (!charge) throw new ApiError(404, 'Charge not found');
  if (charge.status !== 'unposted') {
    throw new ApiError(409, 'The charge is not waiting for Night Audit', {
      code: 'not-unposted',
    });
  }
  charge.status = 'posted';
  return structuredClone(folio);
}
