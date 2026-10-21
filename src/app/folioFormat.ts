import { parseIsoDate, type IsoDate } from '../lib/dates';

/** "10/16/26" (MM/DD/YY, as in Figma); the input again when it is not a valid date. */
export function formatDisplayDate(iso: IsoDate): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${pad(d.getUTCFullYear() % 100)}`;
}
