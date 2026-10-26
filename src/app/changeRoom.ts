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
import { addDays, daysBetween, nightsOverlap, parseIsoDate, type IsoDate } from '../lib/dates';
import {
  needsRateChoice,
  rateChoiceToSend,
  rateOutcome,
  remainingNights,
  type NightRate,
} from '../lib/roomChangeRates';
import { changedNights, isChange, normalizeRuns, stayOf } from '../lib/stayPlan';
import { buildRoomOptions, type RoomOption } from './roomOptions';
import type { UnlockCodes } from './overrideUnlock';
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

/** A stay has at most 365 nights (the New Reservation limit): 13 windows of 30 days cover it. */
export const MAX_INVENTORY_WINDOWS = 13;

/**
 * One inventory from several windows: rooms and lists from the first; blocks and closures merged by
 * id, the FIRST window winning (it starts at the effective date, so the version of the reservation
 * room that guards the request comes from it).
 */
export function mergeScheduleWindows(parts: readonly ScheduleData[]): ScheduleData {
  const [first] = parts;
  const byId = <T extends { id: string }>(lists: T[][]) => {
    const map = new Map<string, T>();
    for (const x of lists.flat()) if (!map.has(x.id)) map.set(x.id, x);
    return [...map.values()];
  };
  return {
    ...first,
    blocks: byId(parts.map((p) => p.blocks)),
    closures: byId(parts.map((p) => p.closures)),
    // Holds over any of the windows (ticket 151 reads them for Add Another Room).
    ...(parts.some((p) => p.holds) ? { holds: byId(parts.map((p) => p.holds ?? [])) } : {}),
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

/** Everything that does not depend on the night, indexed once per dialog (not per night). */
export interface NightIndex {
  options: RoomOption[];
  optionById: ReadonlyMap<string, RoomOption>;
  /** Bookings of OTHER stays, by room, earliest first. */
  blocksByRoom: ReadonlyMap<string, ScheduleBlock[]>;
  closuresByRoom: ReadonlyMap<string, ScheduleClosure[]>;
  /** Room type of the stay's room when the reservation is locked to it, else null. */
  lockedTypeId: string | null;
}

const byStart = (a: { startDate: IsoDate }, b: { startDate: IsoDate }) =>
  a.startDate.localeCompare(b.startDate);

function groupByRoom<T extends { roomId: string; startDate: IsoDate }>(items: readonly T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.roomId);
    if (list) list.push(item);
    else map.set(item.roomId, [item]);
  }
  for (const list of map.values()) list.sort(byStart);
  return map;
}

/**
 * Indexes the inventory once: the room options (grouped order), the bookings of other stays and the
 * closures by room, and the room type a locked reservation must keep. The stay's own parts never
 * block, so a room used on another night of the same stay is free for this one.
 */
export function buildNightIndex(input: {
  rooms: readonly ScheduleRoom[];
  locations: readonly ScheduleLocation[];
  roomTypes: readonly ScheduleRoomType[];
  blocks: readonly ScheduleBlock[];
  closures: readonly ScheduleClosure[];
  /** The reservation room being changed. */
  stay: { id: string; roomTypeLocked: boolean; roomId: string };
}): NightIndex {
  const options = buildRoomOptions(input.rooms, input.locations, input.roomTypes);
  const stayRoom = input.rooms.find((r) => r.id === input.stay.roomId);
  return {
    options,
    optionById: new Map(options.map((o) => [o.id, o])),
    blocksByRoom: groupByRoom(input.blocks.filter((b) => stayOf(b) !== input.stay.id)),
    closuresByRoom: groupByRoom(input.closures),
    lockedTypeId: input.stay.roomTypeLocked ? (stayRoom?.roomTypeId ?? null) : null,
  };
}

/**
 * Every room with whether it can be the room of ONE night (requirements 27.9.1.2.2: the rooms
 * available on that single night, even when not free for the whole stay). The night is the half-open
 * range [date, date + 1), so a stay that ends on `date` or starts the day after does not block
 * (same-day turnover). The reasons, first match wins: Closed; Checked-out stay; Booked; Locked to its
 * room type. The room the night is in now is always selectable. Built lazily, when a night's menu
 * opens, from the shared `NightIndex`.
 */
export function nightChoices(
  index: NightIndex,
  date: IsoDate,
  currentRoomId: string,
): RoomChoice[] {
  const next = addDays(date, 1);
  const hit = <T extends { startDate: IsoDate; endDate: IsoDate }>(list: T[] | undefined) =>
    list?.find((i) => nightsOverlap(i.startDate, i.endDate, date, next));
  return index.options.map((option) => {
    const current = option.id === currentRoomId;
    let reason: string | null = null;
    if (!current) {
      const closure = hit(index.closuresByRoom.get(option.id));
      const booked = hit(index.blocksByRoom.get(option.id));
      if (closure) reason = `Closed ${span(closure.startDate, closure.endDate)}`;
      else if (booked?.status === 'checked-out') {
        reason = `Checked-out stay ${span(booked.startDate, booked.endDate)}`;
      } else if (booked) reason = `Booked ${span(booked.startDate, booked.endDate)}`;
      else if (index.lockedTypeId !== null && option.roomTypeId !== index.lockedTypeId) {
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

/**
 * The success toast, accurate for what moved: "Moved to Room 203" when one room takes every remaining
 * night, "Moved to Room 203 for the night of 10/21" / "for 2 nights from 10/21" when it takes one run
 * of later nights (tonight may stay), and a general line when several runs or rooms are involved.
 */
export function changeToast(
  current: readonly NightRoom[],
  plan: readonly NightRoom[],
  rooms: readonly Pick<ScheduleRoom, 'id' | 'number'>[],
): string {
  const changed = changedNights(current, plan);
  const targets = new Set(plan.filter((n) => changed.includes(n.date)).map((n) => n.roomId));
  const oneRun =
    changed.length > 0 &&
    daysBetween(changed[0], changed[changed.length - 1]) === changed.length - 1;
  if (targets.size !== 1 || !oneRun) {
    return `Room plan updated: ${plural(changed.length, 'night')} changed`;
  }
  const id = [...targets][0];
  const room = `Room ${rooms.find((r) => r.id === id)?.number ?? ''}`.trim();
  if (changed.length === plan.length) return `Moved to ${room}`;
  return changed.length === 1
    ? `Moved to ${room} for the night of ${shortDate(changed[0])}`
    : `Moved to ${room} for ${changed.length} nights from ${shortDate(changed[0])}`;
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
  /** How many different rooms those nights move to (for "room's rate" or "rooms' rates"). */
  newRooms: number;
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
    .filter((l) => l.reservationRoomId === input.reservationRoomId)
    .map((l) => ({ date: l.date, amountCents: l.amountCents }));
  const moving = nights.filter((n) => changed.has(n.date) && n.date >= input.today);
  const rates = moving.map((n) => input.newRateCents(planned.get(n.date) ?? ''));
  const base = {
    changedNights: moving.length,
    newRooms: new Set(moving.map((n) => planned.get(n.date))).size,
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
  /** The PIN that unlocked each field (Location, Room Type, Room), when any was used. */
  overrideCodes?: UnlockCodes;
}): ChangeRoomRequest {
  return {
    ...(input.overrideCodes && Object.keys(input.overrideCodes).length > 0
      ? { overrideCodes: input.overrideCodes }
      : {}),
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
 * The nights of the stay already stayed, with the room of each: the earlier rooms, then the current
 * room from its arrival to the effective date. Needed to show the exact result of a plan.
 */
export function stayedPlan(
  room: Pick<ReservationRoomDetail, 'roomId' | 'arrival' | 'previousStays'>,
  effectiveDate: IsoDate,
): NightRoom[] {
  const parts = [
    ...(room.previousStays ?? []).map((p) => ({
      roomId: p.roomId,
      from: p.arrival,
      to: p.departure,
    })),
    { roomId: room.roomId ?? '', from: room.arrival, to: effectiveDate },
  ];
  const nights: NightRoom[] = [];
  for (const part of parts) {
    for (let date = part.from; date < part.to && date < effectiveDate; date = addDays(date, 1)) {
      nights.push({ date, roomId: part.roomId });
    }
  }
  return nights;
}

/**
 * Shows a plan at once, exactly as the server will build it: the stayed nights (`stayed`, from the
 * details) and the plan are merged into runs by room (a stayed night in the same room as the first
 * remaining night joins that block), one block per run, numbered "part n of m"; a single run carries
 * no link. The run holding the first remaining night keeps the stay id; blocks that already match a
 * run keep their id, the others get temporary ids (`<stay>~pending-n`) until the server answers
 * (`mergeRoomPlan` replaces them all). Early Check In sits on the first block, Late Check Out on the
 * last.
 */
export function applyRoomPlan(
  blocks: readonly ScheduleBlock[],
  edit: { stayId: string; plan: readonly NightRoom[]; stayed: readonly NightRoom[] },
): ScheduleBlock[] {
  const chain = blocks.filter((b) => stayOf(b) === edit.stayId);
  const lead = chain.find((b) => b.id === edit.stayId);
  if (!lead || edit.plan.length === 0) return [...blocks];
  const from = edit.plan[0].date;
  const runs = normalizeRuns([...edit.stayed, ...edit.plan]);
  const currentIndex = runs.findIndex((r) => r.startDate <= from && from < r.endDate);
  const early = chain.some((b) => b.earlyCheckIn);
  const late = chain.some((b) => b.lateCheckOut);
  const old = new Map(chain.map((b) => [`${b.roomId}|${b.startDate}|${b.endDate}`, b]));
  const out = runs.map((run, i): ScheduleBlock => {
    const reused = old.get(`${run.roomId}|${run.startDate}|${run.endDate}`);
    const isCurrent = i === currentIndex;
    const block: ScheduleBlock = {
      ...lead,
      id: isCurrent
        ? edit.stayId
        : reused && reused.id !== edit.stayId
          ? reused.id
          : `${edit.stayId}~pending-${i}`,
      roomId: run.roomId,
      startDate: run.startDate,
      endDate: run.endDate,
      status: i < currentIndex ? 'checked-out' : 'checked-in',
      earlyCheckIn: (early && i === 0) || undefined,
      lateCheckOut: (late && i === runs.length - 1) || undefined,
    };
    if (runs.length > 1) {
      block.roomChange = {
        part: i < currentIndex ? 'previous' : isCurrent ? 'current' : 'next',
        index: i + 1,
        count: runs.length,
        stayId: edit.stayId,
      };
    } else {
      delete block.roomChange;
    }
    return block;
  });
  const at = blocks.findIndex((b) => stayOf(b) === edit.stayId);
  const rest = blocks.filter((b) => stayOf(b) !== edit.stayId);
  rest.splice(at, 0, ...out);
  return rest;
}

/** Undoes `applyRoomPlan`: the blocks of the stay as they were. */
export function revertRoomPlan(
  blocks: readonly ScheduleBlock[],
  snapshot: readonly ScheduleBlock[],
  stayId: string,
): ScheduleBlock[] {
  const at = Math.max(
    0,
    blocks.findIndex((b) => stayOf(b) === stayId),
  );
  const rest = blocks.filter((b) => stayOf(b) !== stayId);
  rest.splice(at, 0, ...snapshot);
  return rest;
}

/** The server's answer replaces every block of the stay (optimistic ones and removed ones go). */
export function mergeRoomPlan(
  data: Pick<ScheduleData, 'startDate' | 'days' | 'blocks'>,
  stayId: string,
  changed: readonly ScheduleBlock[],
): ScheduleBlock[] {
  const end = addDays(data.startDate, data.days);
  const at = Math.max(
    0,
    data.blocks.findIndex((b) => stayOf(b) === stayId),
  );
  const rest = data.blocks.filter((b) => stayOf(b) !== stayId);
  rest.splice(
    at,
    0,
    ...changed.filter((b) => nightsOverlap(b.startDate, b.endDate, data.startDate, end)),
  );
  return rest;
}

// ---- failures ----------------------------------------------------------------------------------

export interface RoomChangeFailure {
  /** Put the optimistic change back. False when the server may have applied it (unknown outcome). */
  revert: boolean;
  /** Reload the schedule and the reservation. */
  refetch: boolean;
  message: string;
  /**
   * What the user saw has drifted (the reservation, the date, the rates or the setting changed):
   * reopen the dialog on the first step with fresh data and the choices that are still valid.
   */
  reopen: boolean;
  /** The club's today, when the server said the effective date differs (`details.today`). */
  serverToday?: IsoDate;
  /** Locked out of override PINs for this long (`override-locked`): the reopened prompt starts locked. */
  lockedForSeconds?: number;
}

export const UNKNOWN_ROOM_CHANGE =
  'Could not confirm the room change. Showing the latest schedule.';
export const REVIEW_PLAN = 'The schedule changed while you were editing. Review the plan.';
/** A 400 about the plan or the rate question: the cause is not known, so none is claimed. */
export const REVIEW_PLAN_UNKNOWN = 'Something changed while you were editing. Review the plan.';

const COPY: Record<string, string> = {
  conflict:
    'That room is no longer free for the remaining nights. The schedule has been refreshed.',
  'not-movable': 'This room can no longer be changed during the stay.',
  'not-found': 'That reservation or room no longer exists. The schedule has been refreshed.',
  'invalid-id': 'The room change was not valid. Nothing was changed.',
  'invalid-query': 'The room change was not valid. Nothing was changed.',
  'idempotency-conflict': 'The room change could not be completed. Try again.',
  forbidden: 'You do not have permission to change this reservation.',
};

const seconds = (v: string | undefined) => (Number(v) > 0 ? Number(v) : undefined);
const detailOf = (error: unknown, key: string): string | undefined =>
  (error as { details?: Record<string, string[]> })?.details?.[key]?.[0];

/**
 * Same classes as the schedule moves: only a clear 4xx (other than 408) says nothing was applied
 * (revert; 404 and 409 also reload). No response, 408, 5xx and an unusable 2xx are an unknown
 * outcome: do not revert, reload and say so neutrally. Server text is only a short fallback detail.
 * A 409 `stale` (the reservation changed, or the server's today differs: `details.reason`
 * 'effective-date' with `details.today`) and a 400 about `details.nights` or `details.rateChoice`
 * (the plan or the rate question no longer fits) mean the data behind the dialog drifted: reopen it
 * on step 1 with fresh data instead of a dead end.
 */
export function changeRoomFailure(error: unknown): RoomChangeFailure {
  const status =
    typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : 0;
  const code = (error as { code?: unknown })?.code;
  if (status < 400 || status === 408 || status >= 500) {
    return { revert: false, refetch: true, message: UNKNOWN_ROOM_CHANGE, reopen: false };
  }
  const today = detailOf(error, 'today');
  const drifted =
    (status === 409 && code === 'stale') ||
    (status === 400 &&
      (detailOf(error, 'nights') !== undefined || detailOf(error, 'rateChoice') !== undefined));
  if (drifted) {
    return {
      revert: true,
      refetch: true,
      message: status === 409 ? REVIEW_PLAN : REVIEW_PLAN_UNKNOWN,
      reopen: true,
      serverToday: today && parseIsoDate(today) ? today : undefined,
    };
  }
  if (code === 'override-required' || code === 'override-invalid' || code === 'override-locked') {
    // Back to the dialog with the choices kept; the locks are closed again, so the PIN is asked again.
    return {
      revert: true,
      refetch: false,
      message:
        code === 'override-locked'
          ? 'Too many incorrect override codes. Try again later.'
          : 'The override code was not accepted. Unlock the field again to change the room.',
      reopen: true,
      lockedForSeconds:
        code === 'override-locked' ? seconds(detailOf(error, 'retryAfterSeconds')) : undefined,
    };
  }
  const known = typeof code === 'string' ? COPY[code] : undefined;
  const detail = safeDetail((error as { message?: string })?.message);
  const message =
    known ??
    (status === 404 ? COPY['not-found'] : undefined) ??
    (detail
      ? `The room change could not be completed: ${detail}`
      : 'The room change could not be completed.');
  return { revert: true, refetch: status === 404 || status === 409, message, reopen: false };
}

/** Loads the schedule windows for the eligibility check. */
export async function loadInventory(
  api: Pick<ApiClient, 'schedule'>,
  from: IsoDate,
  to: IsoDate,
  signal?: AbortSignal,
): Promise<ScheduleData> {
  const windows = scheduleWindowsFor(from, to);
  if (windows.length === 0 || windows.length > MAX_INVENTORY_WINDOWS) {
    throw new Error('The remaining stay cannot be covered by the schedule windows');
  }
  const parts = await Promise.all(windows.map((w) => api.schedule.get(w, { signal })));
  return mergeScheduleWindows(parts);
}

/**
 * When the dialog reopens after the data drifted: keep the user's choices that are still valid (the
 * night is still to be changed, the room exists and is available that night), drop the rest.
 */
export function keepValidEdits(
  edits: Readonly<Record<IsoDate, string>>,
  current: readonly NightRoom[],
  index: NightIndex,
): Record<IsoDate, string> {
  const kept: Record<IsoDate, string> = {};
  for (const night of current) {
    const roomId = edits[night.date];
    if (roomId === undefined || roomId === night.roomId) continue;
    const ok = nightChoices(index, night.date, night.roomId).find((c) => c.option.id === roomId);
    if (ok && !ok.disabled) kept[night.date] = roomId;
  }
  return kept;
}

/** Stays with more remaining nights than this render their night list windowed (scrolling container). */
export const VIRTUALIZE_FROM_NIGHTS = 60;

/** The rows of a windowed list to render: those in view plus a few above and below. */
export function visibleRows(
  scrollTop: number,
  rowPx: number,
  viewportPx: number,
  count: number,
  overscan = 4,
): { first: number; last: number } {
  if (count <= 0 || rowPx <= 0) return { first: 0, last: 0 };
  const first = Math.max(0, Math.floor(scrollTop / rowPx) - overscan);
  const last = Math.min(count, Math.ceil((scrollTop + viewportPx) / rowPx) + overscan);
  return { first: Math.min(first, count), last: Math.max(first, last) };
}
