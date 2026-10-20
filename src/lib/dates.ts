// Neutral calendar helpers shared by api/ and app/ (api must not import from app/). Dates are ISO
// "yyyy-mm-dd" strings, months "yyyy-mm"; arithmetic runs on UTC midnights so DST never shifts a day.

export type IsoDate = string;
export type IsoMonth = string;

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

export const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** UTC-midnight Date for a valid ISO date, otherwise null (rejects "2025-02-30"). */
export function parseIsoDate(value: string): Date | null {
  const m = ISO_DATE.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return formatIsoDate(d) === value ? d : null;
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

export function formatIsoDate(d: Date): IsoDate {
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return formatIsoDate(new Date(d.getTime() + days * DAY_MS));
}

/** Whole days from `from` to `to` (negative when `to` is earlier); NaN for an invalid date. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return a && b ? Math.round((b.getTime() - a.getTime()) / DAY_MS) : NaN;
}

export function monthOf(iso: IsoDate): IsoMonth {
  return iso.slice(0, 7);
}

export function parseMonth(month: IsoMonth): { year: number; index: number } | null {
  const m = ISO_MONTH.exec(month);
  if (!m) return null;
  const index = Number(m[2]) - 1;
  return index >= 0 && index < 12 ? { year: Number(m[1]), index } : null;
}

export function isValidMonth(month: string): boolean {
  return parseMonth(month) !== null;
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export function monthRange(month: IsoMonth): DateRange {
  const p = parseMonth(month);
  if (!p) return { from: month, to: month };
  const lastDay = new Date(Date.UTC(p.year, p.index + 1, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(lastDay)}` };
}
