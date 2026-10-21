// Change Room During Stay (ticket 2.3): when the action is available, which rooms the new room may
// be, the confirmation copy, the request, the optimistic grid update and the failure copy. Pure;
// the dialog and the schedule page only render and wire it. The rate rules live in
// src/lib/roomChangeRates.ts (shared with the mock backend).
import type {
  ApiClient,
  ChangeRoomRequest,
  Cents,
  NightRoom,
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
import { changedNights, isChange, normalizeRuns, stayOf } from '../lib/stayPlan';
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

// ---- the room menu of one night ----------------------------------------------------------------

export interface RoomChoice {
  option: RoomOption;
  disabled: boolean;
  /** Why the room cannot be chosen for this night, else null. */
  reason: string | null;
  /** The room this night is in now: always selectable. */
  current: boolean;
}

/** "10/22" for the reasons ("Booked 10/22-10/24"). */
export const shortDate = (iso: IsoDate): string => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
const span = (start: IsoDate, end: IsoDate) => `${shortDate(start)}-${shortDate(end)}`;

/**
 * Every room with whether it can be the room of ONE night (requirements 27.9.1.2.2: the rooms
 * available on that single night, even when not free for the whole stay). The night is the half-open
 * range [date, date + 1), so a stay that ends on `date` or starts the day after does not block (same-day
 * turnover). The reasons, first match wins: Closed; Checked-out stay; Booked; Locked to its room type.
 * The room the night is in now is always selectable. The stay's own blocks (all its parts) never
 * block, so a room used on another night of the same stay is free for this one. `blocks` and
 * `closures` must cover the night (see `scheduleWindowsFor`).
 */
export function nightChoices(input: {
  rooms: readonly ScheduleRoom[];
  locations: readonly ScheduleLocation[];
  roomTypes: readonly ScheduleRoomType[];
  blocks: readonly ScheduleBlock[];
  closures: readonly ScheduleClosure[];
  /** The reservation room being changed: its parts never block, and a locked type stays. */
  stay: { id: string; roomTypeLocked: boolean; roomId: string };
  date: IsoDate;
  /** The room this night is in now. */
  currentRoomId: string;
}): RoomChoice[] {
  const { date, stay } = input;
  const next = addDays(date, 1);
  const stayRoom = input.rooms.find((r) => r.id === stay.roomId);
  const roomType = new Map(input.rooms.map((r) => [r.id, r.roomTypeId]));
  const earliest = <T extends { startDate: IsoDate }>(items: T[]) =>
    [...items].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const hit = <T extends { roomId: string; startDate: IsoDate; endDate: IsoDate }>(
    items: readonly T[],
    roomId: string,
  ) =>
    earliest(
      items.filter((i) => i.roomId === roomId && nightsOverlap(i.startDate, i.endDate, date, next)),
    );
  const foreign = input.blocks.filter((b) => stayOf(b) !== stay.id);
  return buildRoomOptions(input.rooms, input.locations, input.roomTypes).map((option) => {
    const current = option.id === input.currentRoomId;
    let reason: string | null = null;
    if (!current) {
      const closure = hit(input.closures, option.id);
      const booked = hit(foreign, option.id);
      if (closure) reason = `Closed ${span(closure.startDate, closure.endDate)}`;
      else if (booked?.status === 'checked-out') {
        reason = `Checked-out stay ${span(booked.startDate, booked.endDate)}`;
      } else if (booked) reason = `Booked ${span(booked.startDate, booked.endDate)}`;
      else if (stay.roomTypeLocked && stayRoom && roomType.get(option.id) !== stayRoom.roomTypeId) {
        reason = 'Locked to its room type';
      }
    }
    return { option, disabled: reason !== null, reason, current };
  });
}

export interface RoomFilter {
  /** '' means every location. */
  locationId: string;
  /** '' means every room type. */
  roomTypeId: string;
}

export const NO_ROOM_FILTER: RoomFilter = { locationId: '', roomTypeId: '' };

/**
 * The optional location and room type filter of the night menus (27.9.1.2.3): rooms outside it are
 * left out, except the room the night is set to (a menu always shows its own value).
 */
export function filterChoices(
  choices: readonly RoomChoice[],
  filter: RoomFilter,
  selectedRoomId: string,
): RoomChoice[] {
  return choices.filter(
    (c) =>
      c.option.id === selectedRoomId ||
      ((filter.locationId === '' || c.option.locationId === filter.locationId) &&
        (filter.roomTypeId === '' || c.option.roomTypeId === filter.roomTypeId)),
  );
}

// ---- the plan ------------------------------------------------------------------------------------

export const NO_CHANGE_REASON = 'Choose a different room for at least one night.';

/** Why the plan cannot be confirmed, else null: nothing changed (the nights are the current ones). */
export function confirmBlocker(
  current: readonly NightRoom[],
  plan: readonly NightRoom[],
): string | null {
  return isChange(current, plan) ? null : NO_CHANGE_REASON;
}

export interface PlanRun {
  roomId: string;
  roomNumber: string;
  startDate: IsoDate;
  /** Exclusive. */
  endDate: IsoDate;
  nights: number;
  /** Some night of this run is in another room than before. */
  changed: boolean;
}

/** The plan as runs of consecutive nights in one room ("Room 201 10/16-10/18, Room 205 10/18-10/20"). */
export function planRuns(
  plan: readonly NightRoom[],
  current: readonly NightRoom[],
  rooms: readonly Pick<ScheduleRoom, 'id' | 'number'>[],
): PlanRun[] {
  const changed = new Set(changedNights(current, plan));
  const number = new Map(rooms.map((r) => [r.id, r.number]));
  return normalizeRuns(plan).map((run) => {
    const nights = daysBetween(run.startDate, run.endDate);
    return {
      roomId: run.roomId,
      roomNumber: number.get(run.roomId) ?? '',
      startDate: run.startDate,
      endDate: run.endDate,
      nights,
      changed: Array.from({ length: nights }, (_, i) => addDays(run.startDate, i)).some((d) =>
        changed.has(d),
      ),
    };
  });
}

/** "Room 205: 10/18/2026 to 10/20/2026 (2 nights)". */
export const runText = (run: PlanRun): string =>
  `Room ${run.roomNumber}: ${formatDialogDate(run.startDate)} to ${formatDialogDate(run.endDate)} (${plural(run.nights, 'night')})`;

/** The confirmation's lead sentence: the plan's span. */
export const planSentence = (from: IsoDate, end: IsoDate): string =>
  `New room plan effective ${formatDialogDate(from)} through ${formatDialogDate(end)}`;

/** The toast: "Moved to Room 205" when one room takes the changed nights, else a general line. */
export function changeToast(
  current: readonly NightRoom[],
  plan: readonly NightRoom[],
  rooms: readonly Pick<ScheduleRoom, 'id' | 'number'>[],
): string {
  const changed = new Set(changedNights(current, plan));
  const targets = new Set(plan.filter((n) => changed.has(n.date)).map((n) => n.roomId));
  if (targets.size === 1) {
    const id = [...targets][0];
    return `Moved to Room ${rooms.find((r) => r.id === id)?.number ?? ''}`.trim();
  }
  return 'Rooms updated for the remaining nights';
}

export interface StayedNight {
  /** 1-based number of the night within the whole stay. */
  night: number;
  date: IsoDate;
  roomNumber: string | null;
}

/**
 * The nights already stayed (before the effective date) with the room each was spent in: the
 * earlier rooms, then the current room. Figma shows them as locked "Night n: date | Room" lines
 * with a shield icon.
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
      nights.push({ night: daysBetween(stayArrival, date) + 1, date, roomNumber: s.roomNumber });
    }
  }
  return nights;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
export const nightsText = (n: number): string => plural(n, 'night');

export interface RateQuestion {
  /** The question applies (setting on and the rates differ, or a new rate is not known). */
  asked: boolean;
  /** A changed night could be repriced to another price. */
  ratesDiffer: boolean;
  /** Nights whose room changed and that are not yet stayed. */
  changedNights: number;
  /** Current nightly price of those nights ("$249.00"), "varies by night" when they differ. */
  currentRate: string;
  /** Their new rooms' nightly rate, "varies by night", or null when one is not known (PLACEHOLDER rates). */
  newRate: string | null;
  /** Change of the room charges if the new rates are used, in cents (negative: cheaper). */
  updateDeltaCents: Cents;
  repricedNights: number;
}

const rateText = (cents: Iterable<Cents>) => {
  const set = new Set(cents);
  return set.size === 1 ? formatMoney([...set][0]) : 'varies by night';
};

/**
 * What the rate dialog needs, per night: only nights whose room changed and that are not yet stayed
 * can be repriced; a night that keeps its room keeps its price. `newRateCents(roomId)` is a room's
 * nightly rate, null when unknown (then the question is asked whenever the setting is on, without
 * amounts for the new rooms).
 */
export function rateQuestion(input: {
  detail: Pick<ReservationDetail, 'stay'>;
  reservationRoomId: string;
  current: readonly NightRoom[];
  plan: readonly NightRoom[];
  newRateCents: (roomId: string) => Cents | null;
  today: IsoDate;
  ask: boolean;
}): RateQuestion {
  const changed = new Set(changedNights(input.current, input.plan));
  const planned = new Map(input.plan.map((n) => [n.date, n.roomId]));
  const nights: NightRate[] = input.detail.stay.lines
    .filter(
      (l) => l.reservationRoomId === undefined || l.reservationRoomId === input.reservationRoomId,
    )
    .map((l) => ({ date: l.date, amountCents: l.amountCents }));
  const moving = nights.filter((n) => changed.has(n.date) && n.date >= input.today);
  const rates = moving.map((n) => input.newRateCents(planned.get(n.date) ?? ''));
  const base = {
    changedNights: moving.length,
    currentRate: rateText(moving.map((n) => n.amountCents)),
  };
  if (rates.some((r) => r === null)) {
    return {
      ...base,
      asked: input.ask && moving.length > 0,
      ratesDiffer: moving.length > 0,
      newRate: null,
      updateDeltaCents: 0,
      repricedNights: 0,
    };
  }
  const update = rateOutcome({
    nights,
    newRateCents: (date) => input.newRateCents(planned.get(date) ?? '') ?? 0,
    today: input.today,
    choice: 'update',
    changed: (date) => changed.has(date),
  });
  return {
    ...base,
    asked: needsRateChoice(input.ask, update.ratesDiffer),
    ratesDiffer: update.ratesDiffer,
    newRate: rateText(rates as Cents[]),
    updateDeltaCents: update.deltaCents,
    repricedNights: update.repricedNights,
  };
}

/** "+$50.00", "-$100.00" or "no change". */
export function signedMoney(cents: Cents): string {
  if (cents === 0) return 'no change';
  return `${cents > 0 ? '+' : '-'}${formatMoney(Math.abs(cents))}`;
}

/** The request for a confirmed plan. `answer` is the user's rate choice; only sent when asked. */
export function toChangeRoomRequest(input: {
  block: Pick<ScheduleBlock, 'id' | 'roomId' | 'version'>;
  plan: readonly NightRoom[];
  asked: boolean;
  answer: RateChoice | null;
  requestId: string;
}): ChangeRoomRequest {
  return {
    requestId: input.requestId,
    reservationRoomId: input.block.id,
    fromRoomId: input.block.roomId,
    nights: input.plan.map((n) => ({ date: n.date, roomId: n.roomId })),
    rateChoice: rateChoiceToSend(input.asked, input.answer),
    version: input.block.version,
  };
}

// ---- optimistic update on the grid -------------------------------------------------------------

/**
 * Shows a plan at once. The loaded blocks of the stay (found by their `stayId`) are replaced by one
 * block per run of the plan from the first remaining night on; nights of the current block before
 * that are stayed and stay behind as a checked-out `previous` block; blocks already stayed are kept.
 * Ids of new blocks are temporary (`<stay>~pending-n`) until the server answers. The server stays
 * authoritative: its answer replaces all of it (`mergeRoomPlan`).
 */
export function applyRoomPlan(
  blocks: readonly ScheduleBlock[],
  edit: { stayId: string; plan: readonly NightRoom[] },
): ScheduleBlock[] {
  const chain = blocks.filter((b) => stayOf(b) === edit.stayId);
  const lead = chain.find((b) => b.id === edit.stayId);
  if (!lead || edit.plan.length === 0) return [...blocks];
  const from = edit.plan[0].date;
  const early = chain.some((b) => b.earlyCheckIn);
  const late = chain.some((b) => b.lateCheckOut);
  const sorted = (list: ScheduleBlock[]) =>
    [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const earlier = sorted(chain.filter((b) => b.roomChange?.part === 'previous'));
  const stayed = sorted(
    chain.filter((b) => b.roomChange?.part !== 'previous' && b.startDate < from),
  ).map((b, i): ScheduleBlock => ({
    ...b,
    id: `${edit.stayId}~pending-stayed-${i}`,
    endDate: b.endDate < from ? b.endDate : from,
    status: 'checked-out',
  }));
  const runs = normalizeRuns(edit.plan);
  const parts: ScheduleBlock[] = [
    ...earlier,
    ...stayed,
    ...runs.map((run, i): ScheduleBlock => ({
      ...lead,
      id: i === 0 ? edit.stayId : `${edit.stayId}~pending-${i}`,
      roomId: run.roomId,
      startDate: run.startDate,
      endDate: run.endDate,
      status: 'checked-in',
    })),
  ];
  const firstRun = earlier.length + stayed.length;
  const out = parts.map((b, i): ScheduleBlock => {
    const part = i < firstRun ? 'previous' : i === firstRun ? 'current' : 'next';
    return {
      ...b,
      // Early Check In sits on the first part of the stay, Late Check Out on the last.
      earlyCheckIn: (early && i === 0) || undefined,
      lateCheckOut: (late && i === parts.length - 1) || undefined,
      roomChange: { part, index: i + 1, count: parts.length, stayId: edit.stayId },
    };
  });
  return [...blocks.filter((b) => stayOf(b) !== edit.stayId), ...out];
}

/** Undoes `applyRoomPlan`: the blocks of the stay as they were. */
export function revertRoomPlan(
  blocks: readonly ScheduleBlock[],
  snapshot: readonly ScheduleBlock[],
  stayId: string,
): ScheduleBlock[] {
  return [...blocks.filter((b) => stayOf(b) !== stayId), ...snapshot];
}

/** The server's answer replaces every block of the stay (optimistic ones and removed ones go). */
export function mergeRoomPlan(
  data: Pick<ScheduleData, 'startDate' | 'days' | 'blocks'>,
  stayId: string,
  changed: readonly ScheduleBlock[],
): ScheduleBlock[] {
  const end = addDays(data.startDate, data.days);
  return [
    ...data.blocks.filter((b) => stayOf(b) !== stayId),
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
