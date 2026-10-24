// Business rules of Add-On Items (ticket 7.4). Pure functions; the page, the form parts and the
// mock API only call them.
import type { AddOnInput, AddOnOptions, AddOnSetup } from '../api/types';
import { isValidIsoDate } from './dateSelection';
import { isActiveOn, MAX_PHOTOS, NAME_MAX, type DeleteCheck, type SetupErrors } from './roomSetup';

export { NAME_MAX, MAX_PHOTOS };
export const ADD_ON_DESCRIPTION_MAX = 400;
/**
 * Nightly Qty: a whole number of 0 or more, no maximum (matches the legacy system; Q-73-2).
 * A new add-on starts at `initial`.
 */
export const NIGHTLY_QTY = { min: 0, initial: 1 } as const;
/** Quantity of one add-on on one reservation line. Not used on this page; ticket 3.10 reads it. */
export const LINE_QTY = { min: 1, max: 99 } as const;

export type AddOnField =
  'name' | 'startDate' | 'endDate' | 'sku' | 'nightlyQty' | 'description' | 'photos';

/** A new add-on: an item, active from today with no end, nothing tracked, no associations. */
export function blankAddOn(today: string): AddOnInput {
  return {
    name: '',
    startDate: today,
    endDate: null,
    kind: 'item',
    sku: null,
    onlineBooking: false,
    trackNightly: false,
    nightlyQty: NIGHTLY_QTY.initial,
    description: '',
    photos: [],
    locationIds: [],
    roomTypeIds: [],
  };
}

export const clampNightlyQty = (value: number) =>
  Number.isFinite(value) ? Math.max(NIGHTLY_QTY.min, Math.round(value)) : NIGHTLY_QTY.min;

export function validateAddOn(input: AddOnInput): SetupErrors<AddOnField> {
  const errors: SetupErrors<AddOnField> = {};
  if (input.name.trim() === '') errors.name = 'Enter an add-on name.';
  else if (input.name.length > NAME_MAX) errors.name = `Use at most ${NAME_MAX} characters.`;

  const startOk = isValidIsoDate(input.startDate);
  if (!startOk) errors.startDate = 'Enter an active start date.';
  if (input.endDate !== null) {
    if (!isValidIsoDate(input.endDate)) errors.endDate = 'Enter an active end date.';
    else if (startOk && input.endDate <= input.startDate) {
      errors.endDate = 'The active end date must be after the start date.';
    }
  }

  // The reservation shows the SKU's price, so an add-on without one cannot be sold.
  if (input.sku === null) errors.sku = 'Select a SKU.';

  if (
    input.trackNightly &&
    !(Number.isInteger(input.nightlyQty) && input.nightlyQty >= NIGHTLY_QTY.min)
  ) {
    errors.nightlyQty = 'Nightly quantity must be a whole number, 0 or more.';
  }

  if (input.description.length > ADD_ON_DESCRIPTION_MAX) {
    errors.description = `Use at most ${ADD_ON_DESCRIPTION_MAX} characters.`;
  }
  if (input.photos.length > MAX_PHOTOS) errors.photos = `Use at most ${MAX_PHOTOS} photos.`;
  return errors;
}

/**
 * What is stored: the nightly quantity only means something while tracking is on, so it is reset
 * otherwise, and association lists lose duplicates.
 */
export function normalizeAddOn(input: AddOnInput): AddOnInput {
  return {
    ...input,
    name: input.name.trim(),
    nightlyQty: input.trackNightly ? input.nightlyQty : NIGHTLY_QTY.initial,
    locationIds: [...new Set(input.locationIds)],
    roomTypeIds: [...new Set(input.roomTypeIds)],
  };
}

/** Active dates limit when the add-on can be selected on a reservation. */
export const isSelectableOn = (
  addOn: Pick<AddOnSetup, 'startDate' | 'endDate'>,
  date: string,
): boolean => isActiveOn(addOn, date);

/** Association lists keep only ids that still exist (a deleted location or room type drops out). */
export function pruneAssociations(
  addOn: Pick<AddOnInput, 'locationIds' | 'roomTypeIds'>,
  options: Pick<AddOnOptions, 'locations' | 'roomTypes'>,
): { locationIds: string[]; roomTypeIds: string[] } {
  const keep = (ids: readonly string[], all: readonly { id: string }[]) =>
    ids.filter((id) => all.some((a) => a.id === id));
  return {
    locationIds: keep(addOn.locationIds, options.locations),
    roomTypeIds: keep(addOn.roomTypeIds, options.roomTypes),
  };
}

export function checkDeleteAddOn(addOn: Pick<AddOnSetup, 'name'>): DeleteCheck {
  return { kind: 'ok', message: `Delete ${addOn.name}? This cannot be undone.` };
}
