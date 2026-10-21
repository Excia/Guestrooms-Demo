// Change Room During Stay (ticket 2.3): when the action is available, which rooms the new room may
// be, the confirmation copy, the request, the optimistic grid update and the failure copy. Pure;
// the dialog and the schedule page only render and wire it. The rate rules live in
// src/lib/roomChangeRates.ts (shared with the mock backend).
import type {
  ApiClient,
  ChangeRoomRequest,
  Cents,
  RateChoice,
  ReservationDetail,
  ReservationRoomDetail,
  ScheduleBlock,
  ScheduleClosure,
  ScheduleData,
  ScheduleDays,
  ScheduleLocation,
  ScheduleRoom,
  ScheduleRoomType,
} from '../api/types';
import { SCHEDULE_DAYS } from '../api/types';
import { addDays, daysBetween, nightsOverlap, type IsoDate } from '../lib/dates';
import {
  needsRateChoice,
  rateChoiceToSend,
  rateOutcome,
  remainingNights,
  type NightRate,
} from '../lib/roomChangeRates';
import { buildRoomOptions, type RoomOption } from './roomOptions';
import { formatMoney } from './quickStats';
import { formatDialogDate, safeDetail } from './scheduleGrid';

// ---- availability of the action ----------------------------------------------------------------

export interface ChangeRoomAvailability {
  available: boolean;
  /** Why it is not available (shown as the button's description), else null. */
  reason: string | null;
  /** The first night that moves: today, or the arrival if that is later. Null when unavailable. */
  effectiveDate: IsoDate | null;
}

export const NO_PERMISSION_REASON = 'You do not have permission to change this reservation.';

type RoomInput = Pick<ReservationRoomDetail, 'status' | 'roomId' | 'arrival' | 'departure'>;

/**
 * Change Room is offered only for a room that is checked in (it is shown disabled with the reason
 * otherwise), needs the `reservation.edit` permission, a room to leave, and at least one night left
 * (the stay does not end today). Nights before today are stayed and never move.
 */
export function changeRoomAvailability(input: {
  room: RoomInput;
  today: IsoDate;
  canEdit: boolean;
  /** Another room change is being saved. */
  busy?: boolean;
}): ChangeRoomAvailability {
  const { room, today } = input;
  const no = (reason: string): ChangeRoomAvailability => ({
    available: false,
    reason,
    effectiveDate: null,
  });
  if (!input.canEdit) return no(NO_PERMISSION_REASON);
  if (room.status === 'nyci') return no('Available once the guest is checked in.');
  if (room.status === 'checked-out') return no('Not available after check out.');
  if (room.roomId === null) return no('Assign a room first.');
  if (input.busy) return no('A room change is being saved.');
  const effectiveDate = room.arrival > today ? room.arrival : today;
  if (remainingNights(room.arrival, room.departure, today).length === 0) {
    return no('The stay ends today, so no nights are left to move.');
  }
  return { available: true, reason: null, effectiveDate };
}

// ---- the schedule window the eligibility needs -------------------------------------------------

export interface ScheduleWindow {
  startDate: IsoDate;
  days: ScheduleDays;
}

/**
 * Query windows that together cover the nights [from, to). The schedule answers 7, 14 or 30 days at
 * a time, so a long stay takes several 30-day windows and the last one is the smallest that fits.
 */
export function scheduleWindowsFor(from: IsoDate, to: IsoDate): ScheduleWindow[] {
  const windows: ScheduleWindow[] = [];
  let cursor = from;
  while (cursor < to) {
    const left = daysBetween(cursor, to);
    const days = SCHEDULE_DAYS.find((d) => d >= left) ?? SCHEDULE_DAYS[SCHEDULE_DAYS.length - 1];
    windows.push({ startDate: cursor, days });
    cursor = addDays(cursor, days);
  }
  return windows;
}

/** One inventory from several windows: rooms and lists from the first, blocks and closures merged by id. */
export function mergeScheduleWindows(parts: readonly ScheduleData[]): ScheduleData {
  const [first] = parts;
  const byId = <T extends { id: string }>(lists: T[][]) => [
    ...new Map(lists.flat().map((x) => [x.id, x])).values(),
  ];
  return {
    ...first,
    blocks: byId(parts.map((p) => p.blocks)),
    closures: byId(parts.map((p) => p.closures)),
  };
}

// ---- the room menu -----------------------------------------------------------------------------

export interface RoomChoice {
  option: RoomOption;
  disabled: boolean;
  /** Why the room cannot be chosen, else null. */
  reason: string | null;
}

/** "10/22" for the reasons ("Booked 10/22-10/24"). */
export const shortDate = (iso: IsoDate): string => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
const span = (start: IsoDate, end: IsoDate) => `${shortDate(start)}-${shortDate(end)}`;

/**
 * Every room with whether it can take the stay for the remaining nights [effectiveDate, departure).
 * Nights are half-open, so a stay that ends on the day the new one starts is a same-day turnover and
 * does not block. The reasons, first match wins: Same room; Closed; Checked-out stay (a checked-out
 * stay still holds those nights); Booked; Locked to its room type (the reservation cannot leave its
 * room type). `blocks` and `closures` must cover the remaining nights (see `scheduleWindowsFor`);
 * the current block itself never blocks.
 */
export function roomChoices(input: {
  rooms: readonly ScheduleRoom[];
  locations: readonly ScheduleLocation[];
  roomTypes: readonly ScheduleRoomType[];
  blocks: readonly ScheduleBlock[];
  closures: readonly ScheduleClosure[];
  current: Pick<ScheduleBlock, 'id' | 'roomId' | 'endDate' | 'roomTypeLocked'>;
  effectiveDate: IsoDate;
}): RoomChoice[] {
  const { current, effectiveDate } = input;
  const end = current.endDate;
  const currentRoom = input.rooms.find((r) => r.id === current.roomId);
  const earliest = <T extends { startDate: IsoDate }>(items: T[]) =>
    [...items].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const overlapping = <T extends { roomId: string; startDate: IsoDate; endDate: IsoDate }>(
    items: readonly T[],
    roomId: string,
  ) =>
    earliest(
      items.filter(
        (i) => i.roomId === roomId && nightsOverlap(i.startDate, i.endDate, effectiveDate, end),
      ),
    );
  const rooms = new Map(input.rooms.map((r) => [r.id, r]));
  return buildRoomOptions(input.rooms, input.locations, input.roomTypes).map((option) => {
    const closure = overlapping(input.closures, option.id);
    const booked = overlapping(
      input.blocks.filter((b) => b.id !== current.id),
      option.id,
    );
    let reason: string | null = null;
    if (option.id === current.roomId) reason = 'Same room';
    else if (closure) reason = `Closed ${span(closure.startDate, closure.endDate)}`;
    else if (booked?.status === 'checked-out') {
      reason = `Checked-out stay ${span(booked.startDate, booked.endDate)}`;
    } else if (booked) reason = `Booked ${span(booked.startDate, booked.endDate)}`;
    else if (
      current.roomTypeLocked &&
      currentRoom &&
      rooms.get(option.id)?.roomTypeId !== currentRoom.roomTypeId
    ) {
      reason = 'Locked to its room type';
    }
    return { option, disabled: reason !== null, reason };
  });
}

// ---- nights, rates and copy --------------------------------------------------------------------

export interface StayedNight {
  /** 1-based number of the night within the whole stay. */
  night: number;
  date: IsoDate;
  roomNumber: string | null;
}

/**
 * The nights already stayed (before the effective date) with the room each was spent in: the
 * earlier rooms, then the current room. Figma shows them as locked "Night n: date | Room".
 */
export function stayedNights(
  room: Pick<ReservationRoomDetail, 'roomNumber' | 'arrival' | 'previousStays'>,
  stayArrival: IsoDate,
  effectiveDate: IsoDate,
): StayedNight[] {
  const segments = [
    ...(room.previousStays ?? []).map((p) => ({
      roomNumber: p.roomNumber,
      from: p.arrival,
      to: p.departure,
    })),
    { roomNumber: room.roomNumber, from: room.arrival, to: effectiveDate },
  ];
  const nights: StayedNight[] = [];
  for (const s of segments) {
    for (let date = s.from; date < s.to && date < effectiveDate; date = addDays(date, 1)) {
      nights.push({
        night: daysBetween(stayArrival, date) + 1,
        date,
        roomNumber: s.roomNumber,
      });
    }
  }
  return nights;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export interface ChangeRoomSummary {
  /** "Move from Room 201 to Room 204 effective 10/20/2026 through 10/22/2026". */
  sentence: string;
  nights: number;
}

export function changeRoomSummary(input: {
  fromNumber: string;
  toNumber: string;
  effectiveDate: IsoDate;
  departure: IsoDate;
}): ChangeRoomSummary {
  return {
    sentence: `Move from Room ${input.fromNumber} to Room ${input.toNumber} effective ${formatDialogDate(input.effectiveDate)} through ${formatDialogDate(input.departure)}`,
    nights: Math.max(0, daysBetween(input.effectiveDate, input.departure)),
  };
}

export const nightsText = (n: number): string => plural(n, 'night');

export interface RateQuestion {
  /** The question applies (setting on and the rates differ, or the new rate is not known). */
  asked: boolean;
  ratesDiffer: boolean;
  /** Nightly rate of the remaining nights today ("$249.00"), "varies by night" when nights differ. */
  currentRate: string;
  /** "$199.00", or null when the new room's rate is not known (PLACEHOLDER rates are optional). */
  newRate: string | null;
  /** Change of the room charges if the new rates are used, in cents (negative: cheaper). */
  updateDeltaCents: Cents;
  repricedNights: number;
}

/**
 * What the rate dialog needs: whether to ask, and what each answer means in money. When the new
 * room's rate is not known (`null`) the question is asked whenever the setting is on, without
 * amounts for the new room.
 */
export function rateQuestion(input: {
  detail: Pick<ReservationDetail, 'stay'>;
  reservationRoomId: string;
  newRateCents: Cents | null;
  effectiveDate: IsoDate;
  today: IsoDate;
  ask: boolean;
}): RateQuestion {
  const nights: NightRate[] = input.detail.stay.lines
    .filter(
      (l) => l.reservationRoomId === undefined || l.reservationRoomId === input.reservationRoomId,
    )
    .map((l) => ({ date: l.date, amountCents: l.amountCents }));
  const moving = nights.filter((n) => n.date >= input.effectiveDate && n.date >= input.today);
  const rates = new Set(moving.map((n) => n.amountCents));
  const currentRate = rates.size === 1 ? formatMoney([...rates][0]) : 'varies by night';
  if (input.newRateCents === null) {
    return {
      asked: input.ask,
      ratesDiffer: true,
      currentRate,
      newRate: null,
      updateDeltaCents: 0,
      repricedNights: 0,
    };
  }
  const update = rateOutcome({
    nights,
    newRateCents: input.newRateCents,
    effectiveDate: input.effectiveDate,
    today: input.today,
    choice: 'update',
  });
  return {
    asked: needsRateChoice(input.ask, update.ratesDiffer),
    ratesDiffer: update.ratesDiffer,
    currentRate,
    newRate: formatMoney(input.newRateCents),
    updateDeltaCents: update.deltaCents,
    repricedNights: update.repricedNights,
  };
}

/** "+$50.00", "-$100.00" or "no change". */
export function signedMoney(cents: Cents): string {
  if (cents === 0) return 'no change';
  return `${cents > 0 ? '+' : '-'}${formatMoney(Math.abs(cents))}`;
}

/** The request for a confirmed change. `answer` is the user's rate choice; only sent when asked. */
export function toChangeRoomRequest(input: {
  block: Pick<ScheduleBlock, 'id' | 'roomId' | 'version'>;
  toRoomId: string;
  effectiveDate: IsoDate;
  asked: boolean;
  answer: RateChoice | null;
  requestId: string;
}): ChangeRoomRequest {
  return {
    requestId: input.requestId,
    reservationRoomId: input.block.id,
    fromRoomId: input.block.roomId,
    toRoomId: input.toRoomId,
    effectiveDate: input.effectiveDate,
    rateChoice: rateChoiceToSend(input.asked, input.answer),
    version: input.block.version,
  };
}

// ---- optimistic update on the grid -------------------------------------------------------------

export interface RoomChangeEdit {
  reservationRoomId: string;
  toRoomId: string;
  effectiveDate: IsoDate;
  /** Temporary id of the "previous" segment until the server answers with the real one. */
  pendingId: string;
}

/**
 * Shows the change at once: the block moves to the new room from the effective date and, when nights
 * were already stayed, a checked-out segment stays behind in the old room.
 */
export function applyRoomChange(
  blocks: readonly ScheduleBlock[],
  edit: RoomChangeEdit,
): ScheduleBlock[] {
  const block = blocks.find((b) => b.id === edit.reservationRoomId);
  if (!block) return [...blocks];
  const out: ScheduleBlock[] = blocks.map((b) =>
    b === block
      ? {
          ...b,
          roomId: edit.toRoomId,
          startDate: edit.effectiveDate,
          roomChange: { part: 'current', otherRoomId: block.roomId },
          // Early Check In stays with the segment that holds the arrival.
          ...(edit.effectiveDate > block.startDate ? { earlyCheckIn: undefined } : {}),
        }
      : b,
  );
  if (edit.effectiveDate > block.startDate) {
    out.push({
      ...block,
      id: edit.pendingId,
      endDate: edit.effectiveDate,
      status: 'checked-out',
      roomChange: { part: 'previous', otherRoomId: edit.toRoomId },
      // Late Check Out stays with the current segment.
      lateCheckOut: undefined,
    });
  }
  return out;
}

/** Undoes `applyRoomChange`: the block as it was, and no temporary segment. */
export function revertRoomChange(
  blocks: readonly ScheduleBlock[],
  original: ScheduleBlock,
  pendingId: string,
): ScheduleBlock[] {
  return blocks.filter((b) => b.id !== pendingId).map((b) => (b.id === original.id ? original : b));
}

/** The server's answer replaces the optimistic blocks (the temporary segment goes). */
export function mergeRoomChange(
  data: Pick<ScheduleData, 'startDate' | 'days' | 'blocks'>,
  pendingId: string,
  changed: readonly ScheduleBlock[],
): ScheduleBlock[] {
  const ids = new Set(changed.map((b) => b.id));
  const end = addDays(data.startDate, data.days);
  return [
    ...data.blocks.filter((b) => b.id !== pendingId && !ids.has(b.id)),
    ...changed.filter((b) => nightsOverlap(b.startDate, b.endDate, data.startDate, end)),
  ];
}

// ---- failures ----------------------------------------------------------------------------------

export interface RoomChangeFailure {
  /** Put the optimistic change back. False when the server may have applied it (unknown outcome). */
  revert: boolean;
  /** Reload the schedule and the reservation. */
  refetch: boolean;
  message: string;
}

export const UNKNOWN_ROOM_CHANGE =
  'Could not confirm the room change. Showing the latest schedule.';

const COPY: Record<string, string> = {
  conflict:
    'That room is no longer free for the remaining nights. The schedule has been refreshed.',
  'not-movable': 'This room can no longer be changed during the stay.',
  stale: 'This reservation was changed by someone else. The schedule has been refreshed.',
  'not-found': 'That reservation or room no longer exists. The schedule has been refreshed.',
  'invalid-id': 'The room change was not valid. Nothing was changed.',
  'invalid-query': 'The room change was not valid. Nothing was changed.',
  'idempotency-conflict': 'The room change could not be completed. Try again.',
};

/**
 * Same classes as the schedule moves: only a clear 4xx (other than 408) says nothing was applied
 * (revert; 404 and 409 also reload). No response, 408, 5xx and an unusable 2xx are an unknown
 * outcome: do not revert, reload and say so neutrally. Server text is only a short fallback detail.
 */
export function changeRoomFailure(error: unknown): RoomChangeFailure {
  const status =
    typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : 0;
  const code = (error as { code?: unknown })?.code;
  if (status < 400 || status === 408 || status >= 500) {
    return { revert: false, refetch: true, message: UNKNOWN_ROOM_CHANGE };
  }
  const known = typeof code === 'string' ? COPY[code] : undefined;
  const detail = safeDetail((error as { message?: string })?.message);
  const message =
    known ??
    (status === 404 ? COPY['not-found'] : undefined) ??
    (detail
      ? `The room change could not be completed: ${detail}`
      : 'The room change could not be completed.');
  return { revert: true, refetch: status === 404 || status === 409, message };
}

/** Loads the schedule windows for the eligibility check. */
export async function loadInventory(
  api: Pick<ApiClient, 'schedule'>,
  from: IsoDate,
  to: IsoDate,
  signal?: AbortSignal,
): Promise<ScheduleData> {
  const parts = await Promise.all(
    scheduleWindowsFor(from, to).map((w) => api.schedule.get(w, { signal })),
  );
  return mergeScheduleWindows(parts);
}
