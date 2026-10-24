// The per-night room plan of a stay (ticket 2.3, requirements 27.9.1.2): one room per night, runs of
// consecutive nights in one room merged into segments, and the checks a plan must pass. Pure and
// shared by the UI (app/) and the mock backend (api/), so both agree on what a plan means.
import { addDays, daysBetween, type IsoDate } from './dates';
import type { NightRoom, ScheduleBlock } from '../api/types';

export interface Run {
  roomId: string;
  startDate: IsoDate;
  /** Exclusive: the day after the last night of the run. */
  endDate: IsoDate;
}

/** The reservation room a block belongs to: segments share the `stayId` of the `current` block. */
export const stayOf = (block: Pick<ScheduleBlock, 'id' | 'roomChange'>): string =>
  block.roomChange?.stayId ?? block.id;

/** Whether nights are in date order, one per day with no gaps (an empty plan is not contiguous). */
export function isContiguous(nights: readonly NightRoom[]): boolean {
  return (
    nights.length > 0 &&
    nights.every((n, i) => i === 0 || daysBetween(nights[i - 1].date, n.date) === 1)
  );
}

/** Merges consecutive nights in the same room into runs: Room A, A, B, B, A is three runs. */
export function normalizeRuns(nights: readonly NightRoom[]): Run[] {
  const runs: Run[] = [];
  for (const night of nights) {
    const last = runs[runs.length - 1];
    if (last && last.roomId === night.roomId && last.endDate === night.date) {
      last.endDate = addDays(night.date, 1);
    } else {
      runs.push({ roomId: night.roomId, startDate: night.date, endDate: addDays(night.date, 1) });
    }
  }
  return runs;
}

/** The nights of `[from, end)` with the room each is spent in now, read from the stay's blocks. */
export function planFromBlocks(
  blocks: readonly Pick<ScheduleBlock, 'roomId' | 'startDate' | 'endDate'>[],
  from: IsoDate,
  end: IsoDate,
): NightRoom[] {
  const nights: NightRoom[] = [];
  for (let date = from; date < end; date = addDays(date, 1)) {
    const block = blocks.find((b) => b.startDate <= date && date < b.endDate);
    if (block) nights.push({ date, roomId: block.roomId });
  }
  return nights;
}

export type PlanProblem =
  /** The plan does not list exactly the remaining nights, in order. */
  | 'nights'
  /** A night of the plan has no room. */
  | 'room';

/** `[from, end)` as the dates the plan has to cover. */
export function remainingDates(from: IsoDate, end: IsoDate): IsoDate[] {
  return Array.from({ length: Math.max(0, daysBetween(from, end)) }, (_, i) => addDays(from, i));
}

/**
 * A plan must list exactly the remaining nights (no stayed night, none missing, none twice) and give
 * each a room. Returns the first problem, or null.
 */
export function planProblem(
  plan: readonly NightRoom[],
  from: IsoDate,
  end: IsoDate,
): PlanProblem | null {
  const dates = remainingDates(from, end);
  if (plan.length !== dates.length || plan.some((n, i) => n.date !== dates[i])) return 'nights';
  if (plan.some((n) => n.roomId === '')) return 'room';
  return null;
}

/** The dates whose room differs between two plans of the same nights. */
export function changedNights(
  current: readonly NightRoom[],
  plan: readonly NightRoom[],
): IsoDate[] {
  const now = new Map(current.map((n) => [n.date, n.roomId]));
  return plan.filter((n) => now.get(n.date) !== n.roomId).map((n) => n.date);
}

/** A plan that changes no night is not a change (the confirm action stays disabled). */
export const isChange = (current: readonly NightRoom[], plan: readonly NightRoom[]): boolean =>
  changedNights(current, plan).length > 0;
