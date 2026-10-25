// Business rules of Rate Categories (ticket 7.2 / LP-A.3). Pure functions; the page, the rate table
// and the mock API only call them. Ported from the legacy Rate Categories screen (see
// docs/requirements/entries/184-rate-categories.md for what was kept and what was guessed).
import type {
  AddOnKind,
  Cents,
  RateAmounts,
  RateCategoryInput,
  RateCategorySetup,
  RateColumnKey,
  RateSeason,
  RateSku,
  SystemSettings,
} from '../api/types';
import { isValidIsoDate } from './dateSelection';
import type { DeleteCheck } from './roomSetup';

/** Legacy limits both the category and the season name to 25 characters. */
export const RATE_CATEGORY_NAME_MAX = 25;
export const SEASON_NAME_MAX = 25;
/** One night cannot cost more than this (placeholder bound, 9,999,999.99). */
export const MAX_RATE_CENTS: Cents = 999_999_999;

export interface RateColumn {
  key: RateColumnKey;
  label: string;
}

/** Columns of the rate table, in legacy order. Alternative base rates show only while enabled. */
export const RATE_COLUMNS: readonly RateColumn[] = [
  { key: 'standardBase', label: 'Standard Base' },
  { key: 'altBase1', label: 'Alt Base 1' },
  { key: 'altBase2', label: 'Alt Base 2' },
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tues' },
  { key: 'wednesday', label: 'Weds' },
  { key: 'thursday', label: 'Thurs' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
  { key: 'guest2', label: 'Guest 2' },
  { key: 'guest3', label: 'Guest 3' },
  { key: 'guest4Plus', label: 'Guest 4+' },
  { key: 'child', label: 'Child' },
];

/**
 * The columns to show for the club's System Settings: the alternative base rate columns exist
 * only while enabled, headed with the night count ("Alt Base (7+ nights)").
 */
export function visibleRateColumns(
  settings: Pick<SystemSettings, 'alternativeBaseRate1' | 'alternativeBaseRate2'> | null,
): RateColumn[] {
  return RATE_COLUMNS.flatMap((column) => {
    if (column.key === 'altBase1' || column.key === 'altBase2') {
      const alt =
        settings?.[column.key === 'altBase1' ? 'alternativeBaseRate1' : 'alternativeBaseRate2'];
      return alt?.enabled
        ? [{ key: column.key, label: `Alt Base (${alt.minNights}+ nights)` }]
        : [];
    }
    return [column];
  });
}

export const blankAmounts = (): RateAmounts =>
  Object.fromEntries(RATE_COLUMNS.map((c) => [c.key, 0])) as RateAmounts;

/** Amounts of a room type in a season; a room type with no row yet reads as all zero. */
export const amountsFor = (season: RateSeason, roomTypeId: string): RateAmounts => ({
  ...blankAmounts(),
  ...season.rates[roomTypeId],
});

export const newSeasonId = (n: number) => `season-new-${n}`;

/** The default season: no name or dates, one all-zero row per room type. */
export function blankDefaultSeason(
  roomTypeIds: readonly string[],
  id = newSeasonId(0),
): RateSeason {
  return {
    id,
    name: '',
    isDefault: true,
    startDate: '',
    endDate: '',
    rates: Object.fromEntries(roomTypeIds.map((t) => [t, blankAmounts()])),
  };
}

/** A new category: active from today, no end, an item SKU to choose, every room type, zero rates. */
export function blankRateCategory(
  today: string,
  roomTypeIds: readonly string[],
): RateCategoryInput {
  return {
    name: '',
    startDate: today,
    endDate: null,
    kind: 'item',
    sku: null,
    roomTypeIds: [...roomTypeIds],
    seasons: [blankDefaultSeason(roomTypeIds)],
  };
}

const cloneRates = (rates: RateSeason['rates']): RateSeason['rates'] => structuredClone(rates);

/** "Add Season" starts from the default season's rates (legacy), with empty name and dates. */
export function addSeason(seasons: readonly RateSeason[], id: string): RateSeason[] {
  const base = seasons.find((s) => s.isDefault);
  return [
    ...seasons,
    {
      id,
      name: '',
      isDefault: false,
      startDate: '',
      endDate: '',
      sku: null,
      skuKind: 'item',
      rates: cloneRates(base?.rates ?? {}),
    },
  ];
}

/** "Duplicate season" copies the name, dates and rates of a season (legacy keeps the dates). */
export function duplicateSeason(
  seasons: readonly RateSeason[],
  seasonId: string,
  id: string,
): RateSeason[] {
  const source = seasons.find((s) => s.id === seasonId && !s.isDefault);
  if (!source) return [...seasons];
  const copy: RateSeason = {
    ...structuredClone(source),
    id,
    name: copyName(source.name, SEASON_NAME_MAX),
  };
  return [...seasons, copy];
}

export const removeSeason = (seasons: readonly RateSeason[], seasonId: string): RateSeason[] =>
  seasons.filter((s) => s.id !== seasonId || s.isDefault);

/** The fields of a season's header the table edits. */
export type SeasonChange = Partial<
  Pick<RateSeason, 'name' | 'startDate' | 'endDate' | 'sku' | 'skuKind'>
>;

export const updateSeason = (
  seasons: readonly RateSeason[],
  seasonId: string,
  change: SeasonChange,
): RateSeason[] => seasons.map((s) => (s.id === seasonId ? { ...s, ...change } : s));

export function setAmount(
  seasons: readonly RateSeason[],
  seasonId: string,
  roomTypeId: string,
  column: RateColumnKey,
  cents: Cents,
): RateSeason[] {
  return seasons.map((s) =>
    s.id === seasonId
      ? {
          ...s,
          rates: { ...s.rates, [roomTypeId]: { ...amountsFor(s, roomTypeId), [column]: cents } },
        }
      : s,
  );
}

/** "Name (Copy)" as the legacy dialog suggests it, shortened so the whole name fits `max`. */
export function copyName(name: string, max = RATE_CATEGORY_NAME_MAX): string {
  const suffix = ' (Copy)';
  const base = name
    .trim()
    .slice(0, Math.max(0, max - suffix.length))
    .trimEnd();
  return `${base}${suffix}`;
}

/** Names are unique (case and surrounding spaces ignored); `exceptId` is the category being edited. */
export function isNameTaken(
  name: string,
  categories: readonly Pick<RateCategorySetup, 'id' | 'name'>[],
  exceptId?: string,
): boolean {
  const wanted = name.trim().toLowerCase();
  return (
    wanted !== '' &&
    categories.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === wanted)
  );
}

/** "an item" or "a combo", for the SKU messages. */
const skuPhrase = (kind: AddOnKind) => (kind === 'item' ? 'an item' : 'a combo');

/** Why a name cannot be used for a duplicate, or undefined. */
export function duplicateNameError(
  name: string,
  categories: readonly Pick<RateCategorySetup, 'id' | 'name'>[],
): string | undefined {
  if (name.trim() === '') return 'Enter a name.';
  if (name.trim().length > RATE_CATEGORY_NAME_MAX) {
    return `Use at most ${RATE_CATEGORY_NAME_MAX} characters.`;
  }
  if (isNameTaken(name, categories)) return 'This name is already in use. Enter a unique name.';
  return undefined;
}

/** Inclusive: two seasons that share even one day overlap (legacy). */
export const rangesOverlap = (
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean => a.startDate <= b.endDate && a.endDate >= b.startDate;

/** Ids of seasons whose dates overlap an earlier-listed season; only complete ranges count. */
export function overlappingSeasonIds(seasons: readonly RateSeason[]): Map<string, string> {
  const dated = seasons.filter(
    (s) =>
      !s.isDefault &&
      isValidIsoDate(s.startDate) &&
      isValidIsoDate(s.endDate) &&
      s.startDate <= s.endDate,
  );
  const found = new Map<string, string>();
  dated.forEach((season, i) => {
    const earlier = dated.slice(0, i).find((other) => rangesOverlap(season, other));
    if (earlier) found.set(season.id, earlier.name || 'another season');
  });
  return found;
}

export interface SeasonErrors {
  name?: string;
  startDate?: string;
  endDate?: string;
  sku?: string;
  /** First invalid amount, "Room type, column". */
  amount?: string;
}

export interface RateCategoryErrors {
  name?: string;
  startDate?: string;
  endDate?: string;
  sku?: string;
  roomTypes?: string;
  /** Structure of the seasons: one default at most, no repeated id. */
  seasonList?: string;
  seasons: Record<string, SeasonErrors>;
}

export type RateCategoryField = 'name' | 'startDate' | 'endDate' | 'sku' | 'roomTypes';

export const hasErrors = (errors: RateCategoryErrors): boolean =>
  Object.values(errors.seasons).length > 0 ||
  (['name', 'startDate', 'endDate', 'sku', 'roomTypes', 'seasonList'] as const).some(
    (k) => errors[k],
  );

/**
 * Legacy rules: a name, an item or combo SKU, every non-default season named and dated, seasons
 * that do not overlap. Added here: unique name, an end date after the start (category and season),
 * at least one room type, amounts that are valid money.
 */
export function validateRateCategory(
  input: RateCategoryInput,
  existing: readonly Pick<RateCategorySetup, 'id' | 'name'>[] = [],
  skus?: readonly RateSku[],
): RateCategoryErrors {
  const errors: RateCategoryErrors = { seasons: {} };
  if (input.name.trim() === '') errors.name = 'Enter a rate category name.';
  else if (input.name.length > RATE_CATEGORY_NAME_MAX) {
    errors.name = `Use at most ${RATE_CATEGORY_NAME_MAX} characters.`;
  } else if (isNameTaken(input.name, existing, input.id)) {
    errors.name = 'This name is already in use. Enter a unique name.';
  }

  const startOk = isValidIsoDate(input.startDate);
  if (!startOk) errors.startDate = 'Enter an active start date.';
  if (input.endDate !== null) {
    if (!isValidIsoDate(input.endDate)) errors.endDate = 'Enter an active end date.';
    else if (startOk && input.endDate <= input.startDate) {
      errors.endDate = 'The active end date must be after the start date.';
    }
  }

  if (input.sku === null) errors.sku = 'Select an item or combo SKU.';
  else if (skus) {
    const chosen = input.sku;
    const known = skus.find((s) => s.id === chosen.id);
    if (!known || known.kind !== input.kind) {
      errors.sku = `Select ${skuPhrase(input.kind)} SKU.`;
    }
  }
  if (
    input.seasons.filter((s) => s.isDefault).length > 1 ||
    new Set(input.seasons.map((s) => s.id)).size !== input.seasons.length
  ) {
    errors.seasonList = 'Use one default season and distinct seasons.';
  }
  if (input.roomTypeIds.length === 0) errors.roomTypes = 'Select at least one room type.';

  const overlaps = overlappingSeasonIds(input.seasons);
  for (const season of input.seasons) {
    const e: SeasonErrors = {};
    if (!season.isDefault) {
      if (season.name.trim() === '') e.name = 'Enter a season name.';
      else if (season.name.length > SEASON_NAME_MAX)
        e.name = `Use at most ${SEASON_NAME_MAX} characters.`;
      const sOk = isValidIsoDate(season.startDate);
      const eOk = isValidIsoDate(season.endDate);
      if (!sOk) e.startDate = 'Enter a start date.';
      if (!eOk) e.endDate = 'Enter an end date.';
      else if (sOk && season.endDate < season.startDate) {
        e.endDate = 'The end date cannot be before the start date.';
      }
      if (season.sku) {
        const kind = season.skuKind ?? 'item';
        const known = skus?.find((k) => k.id === season.sku?.id);
        if (skus && (!known || known.kind !== kind)) {
          e.sku = `Select ${skuPhrase(kind)} SKU.`;
        }
      }
      const clash = overlaps.get(season.id);
      if (clash && !e.startDate && !e.endDate) e.endDate = `Dates overlap ${clash}.`;
    }
    for (const roomTypeId of input.roomTypeIds) {
      const amounts = amountsFor(season, roomTypeId);
      const bad = RATE_COLUMNS.find((c) => !isValidCents(amounts[c.key]));
      if (bad) {
        e.amount = `Enter a rate between 0 and ${formatDollars(MAX_RATE_CENTS)} (${bad.label}).`;
        break;
      }
    }
    if (e.name || e.startDate || e.endDate || e.sku || e.amount) errors.seasons[season.id] = e;
  }
  return errors;
}

const isValidCents = (n: unknown): n is Cents =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_RATE_CENTS;

/** Stored SKU of a season: none on the default season; the others keep a SKU only with its kind. */
function seasonSku(season: RateSeason): Pick<RateSeason, 'sku' | 'skuKind'> {
  if (season.isDefault) return {};
  // A kind alone means nothing (the form keeps it to show the radio), so it is not stored.
  return season.sku ? { sku: season.sku, skuKind: season.skuKind ?? 'item' } : { sku: null };
}

/**
 * What is stored (without the request id): trimmed names, a rate row for exactly the associated room types (a removed
 * room type loses its rates, a new one starts at zero) and exactly one default season, first.
 */
export function normalizeRateCategory(input: RateCategoryInput): RateCategoryInput {
  const roomTypeIds = [...new Set(input.roomTypeIds)];
  const shape = (season: RateSeason): RateSeason => ({
    ...season,
    name: season.isDefault ? '' : season.name.trim(),
    startDate: season.isDefault ? '' : season.startDate,
    endDate: season.isDefault ? '' : season.endDate,
    ...seasonSku(season),
    rates: Object.fromEntries(roomTypeIds.map((t) => [t, amountsFor(season, t)])),
  });
  const base =
    input.seasons.find((s) => s.isDefault) ?? blankDefaultSeason(roomTypeIds, 'season-default');
  const others = input.seasons.filter((s) => !s.isDefault);
  return {
    ...(input.id === undefined ? {} : { id: input.id }),
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    kind: input.kind,
    sku: input.sku,
    roomTypeIds,
    seasons: [base, ...others].map(shape),
  };
}

/** A stored category as the form edits it (the usage counts are read only). */
export function toRateCategoryInput(c: RateCategorySetup): RateCategoryInput {
  return {
    id: c.id,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    kind: c.kind,
    sku: c.sku,
    roomTypeIds: [...c.roomTypeIds],
    seasons: structuredClone(c.seasons),
  };
}

/**
 * Shape of a season's SKU on the wire: the default season has neither field, and a kind is only
 * sent with a SKU. (The form's draft may hold a kind without a SKU; `normalizeRateCategory` drops it.)
 */
export const isSeasonSkuShapeValid = (season: RateSeason): boolean =>
  season.isDefault
    ? season.sku == null && season.skuKind === undefined
    : season.skuKind === undefined || Boolean(season.sku);

/** True when every season of a stored or submitted category has a valid SKU shape. */
export const seasonSkuShapesValid = (seasons: readonly RateSeason[]): boolean =>
  seasons.every(isSeasonSkuShapeValid);

/** The kind a season's SKU lookup lists (a season without one reads as item). */
export const seasonSkuKind = (season: Pick<RateSeason, 'skuKind'>): AddOnKind =>
  season.skuKind ?? 'item';

/** Seasons that get a colour: every non-default one, in list order. The default season is neutral. */
export const SEASON_TONE_COUNT = 6;

/**
 * Index into the season colour tokens (`palette.season.tones`) for a season: the non-default seasons
 * take the tones in the order they are listed and wrap after six; the default season has none
 * (it uses the neutral tone). The name and dates are always shown too, so colour is never the only cue.
 */
export function seasonToneIndex(seasons: readonly RateSeason[], seasonId: string): number | null {
  const own = seasons.filter((s) => !s.isDefault);
  const at = own.findIndex((s) => s.id === seasonId);
  return at < 0 ? null : at % SEASON_TONE_COUNT;
}

/** SKUs of one kind, for the SKU lookup. */
export const skusOfKind = (skus: readonly RateSku[], kind: RateSku['kind']): RateSku[] =>
  skus.filter((s) => s.kind === kind);

/** Active on `date` (the same rule as the other setup lists). */
export const isCategoryActiveOn = (
  c: Pick<RateCategorySetup, 'startDate' | 'endDate'>,
  date: string,
): boolean => c.startDate <= date && (c.endDate === null || c.endDate >= date);

/** The season whose rates apply to a night: a dated season containing it, else the default. */
export function seasonFor(seasons: readonly RateSeason[], date: string): RateSeason | undefined {
  return (
    seasons.find((s) => !s.isDefault && s.startDate <= date && date <= s.endDate) ??
    seasons.find((s) => s.isDefault)
  );
}

/** Deleting: blocked while reservations or settings use the category (the active end date retires it). */
export function checkDeleteRateCategory(
  category: Pick<RateCategorySetup, 'name' | 'reservationCount' | 'settingNames'>,
): DeleteCheck {
  const uses: string[] = [];
  if (category.reservationCount > 0) {
    uses.push(
      `${category.reservationCount} ${category.reservationCount === 1 ? 'reservation uses' : 'reservations use'} it`,
    );
  }
  if (category.settingNames.length > 0) {
    uses.push(`it is the ${category.settingNames.join(', ')} setting`);
  }
  if (uses.length > 0) {
    return {
      kind: 'blocked',
      message: `${category.name} cannot be deleted: ${uses.join(' and ')}. Set an active end date to retire it instead.`,
    };
  }
  return { kind: 'ok', message: `Delete ${category.name}? This cannot be undone.` };
}

/** "125.5" or "$1,250.00" to cents; null when it is not a non-negative amount with at most two decimals. */
export function parseDollars(text: string): Cents | null {
  const trimmed = text.trim().replace(/^\$/, '');
  // A comma is accepted only as a thousands separator (1,234.50), never 1,2,3 or 1,5.
  if (!/^((\d{1,3}(,\d{3})+|\d+)(\.\d{0,2})?|\.\d{1,2})$/.test(trimmed)) return null;
  const cleaned = trimmed.replace(/,/g, '');
  const [whole = '0', fraction = ''] = cleaned.split('.');
  return Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
}

/** Cents as "1,250.00" (no currency sign: the column header or label says it is money). */
export function formatDollars(cents: Cents): string {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${whole.toLocaleString('en-US')}.${fraction}`;
}
