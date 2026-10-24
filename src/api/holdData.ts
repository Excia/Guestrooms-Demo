// The mock's slot holds (ticket 152, Q-19-3). PLACEHOLDER: a real backend owns holds and their
// expiry; this only behaves like one so the UI can be built and tested. Holds live in memory per
// client, expire by the clock, are idempotent on the hold id and refuse a slot that is booked,
// closed or held by someone else.
import { addDays, nightsOverlap, type IsoDate } from '../lib/dates';
import { holdExpiry, isHoldLive, slotConflict } from '../app/slotHolds';
import { findRoom, conflictError, type ScheduleState } from './scheduleData';
import { ApiError, type HoldSlotRequest, type ScheduleHold } from './types';

/** The signed-in mock user; any other owner id is "someone else". */
export const MOCK_HOLD_OWNER = 'mock-user';

export interface StoredHold extends Omit<ScheduleHold, 'mine'> {
  ownerId: string;
}

export type HoldStore = StoredHold[];

const toWire = (h: StoredHold): ScheduleHold => ({
  id: h.id,
  roomId: h.roomId,
  startDate: h.startDate,
  endDate: h.endDate,
  expiresAt: h.expiresAt,
  mine: h.ownerId === MOCK_HOLD_OWNER,
});

const prune = (store: HoldStore, now: number) => {
  for (let i = store.length - 1; i >= 0; i--) if (!isHoldLive(store[i], now)) store.splice(i, 1);
};

/**
 * PLACEHOLDER (P-152-1): another user's hold on the first room that is free around the
 * default window, so the shading can be seen. Absent when no room is free there.
 */
export function seedHolds(state: ScheduleState, today: IsoDate, now: number): HoldStore {
  const startDate = addDays(today, 3);
  const endDate = addDays(today, 5);
  const free = state.rooms.find(
    (r) =>
      !state.blocks.some(
        (b) => b.roomId === r.id && nightsOverlap(b.startDate, b.endDate, startDate, endDate),
      ) &&
      !state.closures.some(
        (c) => c.roomId === r.id && nightsOverlap(c.startDate, c.endDate, startDate, endDate),
      ),
  );
  if (!free) return [];
  return [
    {
      id: 'hold-seed-1',
      roomId: free.id,
      startDate,
      endDate,
      expiresAt: holdExpiry(now, 12),
      ownerId: 'another-user',
    },
  ];
}

/** The live holds overlapping a window, as the schedule answer carries them. */
export function holdsInWindow(
  store: HoldStore,
  startDate: IsoDate,
  endDate: IsoDate,
  now: number,
): ScheduleHold[] {
  prune(store, now);
  return store.filter((h) => nightsOverlap(h.startDate, h.endDate, startDate, endDate)).map(toWire);
}

/**
 * Holds or moves a hold. Idempotent on the id: the same slot answers the existing hold unchanged; a
 * new slot moves it and keeps its expiry; after expiry the id starts a fresh hold of `minutes`.
 */
export function placeHold(
  store: HoldStore,
  state: ScheduleState,
  request: HoldSlotRequest,
  now: number,
  minutes: number,
): ScheduleHold {
  prune(store, now);
  findRoom(state, request.roomId);
  const slot = { roomId: request.roomId, startDate: request.startDate, endDate: request.endDate };
  const clash = slotConflict(
    slot,
    {
      blocks: state.blocks,
      closures: state.closures,
      holds: store.map(toWire),
    },
    request.holdId,
    now,
  );
  if (clash?.kind === 'booked' || clash?.kind === 'closed') throw conflictError([request.roomId]);
  if (clash) throw heldError(request.roomId);
  const existing = store.find((h) => h.id === request.holdId);
  if (existing) {
    if (existing.ownerId !== MOCK_HOLD_OWNER) throw heldError(request.roomId);
    Object.assign(existing, slot);
    return toWire(existing);
  }
  const created: StoredHold = {
    id: request.holdId,
    ...slot,
    expiresAt: holdExpiry(now, minutes),
    ownerId: MOCK_HOLD_OWNER,
  };
  store.push(created);
  return toWire(created);
}

/** Idempotent: an unknown, expired or someone else's id changes nothing. */
export function dropHold(store: HoldStore, holdId: string): void {
  const i = store.findIndex((h) => h.id === holdId && h.ownerId === MOCK_HOLD_OWNER);
  if (i >= 0) store.splice(i, 1);
}

/**
 * A booking on a slot someone else holds is refused (the holder's own hold, named by `holdId`, does
 * not count). On success the caller drops that hold.
 */
export function assertNotHeldByOther(
  store: HoldStore,
  request: { roomId?: string | null; arrival: IsoDate; departure: IsoDate; holdId?: string },
  now: number,
): void {
  if (!request.roomId) return;
  prune(store, now);
  const clash = store.find(
    (h) =>
      h.id !== request.holdId &&
      h.roomId === request.roomId &&
      nightsOverlap(h.startDate, h.endDate, request.arrival, request.departure),
  );
  if (clash) throw heldError(request.roomId);
}

const heldError = (roomId: string) =>
  new ApiError(409, 'The room is held by another user on those dates', {
    code: 'held',
    details: { roomId: [roomId] },
  });
