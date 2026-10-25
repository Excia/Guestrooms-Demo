// Business rules of Room Types and Rooms (ticket 7.3). Pure functions; the pages, the form parts
// and the mock API only call them. Limits come from the functional requirements (9.4 and 10.4).
import type {
  RoomDetails,
  RoomInput,
  RoomPhoto,
  RoomSetup,
  RoomSetupOptions,
  RoomTypeInput,
  RoomTypeSetup,
} from '../api/types';
import { isValidIsoDate } from './dateSelection';

export const NAME_MAX = 50;
export const DESCRIPTION_MAX = 750;
export const MAX_PHOTOS = 50;
/** PLACEHOLDER until the storage service decides (Q-72-1): the PDF leaves types and size open. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const COUNT_LIMITS = {
  maxOccupancy: { min: 1, max: 99 },
  bedrooms: { min: 0, max: 10 },
  fullBaths: { min: 1, max: 99 },
  halfBaths: { min: 0, max: 99 },
  bedType: { min: 0, max: 99 },
} as const;

export type SetupErrors<K extends string> = Partial<Record<K, string>>;
export type RoomTypeField = 'name' | 'startDate' | 'endDate' | 'description' | 'photos';
export type RoomField = 'name' | 'startDate' | 'endDate' | 'description' | 'roomTypeId';

/** New room type defaults (9.4.6 to 9.4.9); bed types start at 0. */
export function blankDetails(bedSizes: readonly { id: string }[]): RoomDetails {
  return {
    maxOccupancy: 2,
    bedrooms: 0,
    fullBaths: 1,
    halfBaths: 0,
    bedTypes: Object.fromEntries(bedSizes.map((b) => [b.id, 0])),
    description: '',
    photos: [],
    featureIds: [],
    addOnIds: [],
  };
}

export function blankRoomType(today: string, options: RoomSetupOptions): RoomTypeInput {
  return {
    name: '',
    startDate: today,
    endDate: null,
    sku: null,
    onlineBooking: false,
    details: blankDetails(options.bedSizes),
  };
}

/** A new room inherits everything from its room type until the admin turns that off. */
export function blankRoom(
  today: string,
  options: RoomSetupOptions,
  roomType: RoomTypeSetup | undefined,
): RoomInput {
  return {
    name: '',
    owner: null,
    startDate: today,
    endDate: null,
    roomTypeId: roomType?.id ?? '',
    inheritDetails: true,
    inheritRates: true,
    onlineBooking: false,
    details: roomType ? structuredClone(roomType.details) : blankDetails(options.bedSizes),
    linkedRoomIds: [],
  };
}

/** Everything but the name is copied; the copy is a new, unsaved item (8.8). */
export function duplicateName(name: string): string {
  const base = name.trim() === '' ? 'Copy' : `Copy of ${name.trim()}`;
  return base.slice(0, NAME_MAX);
}

function validateDates(
  startDate: string,
  endDate: string | null,
): SetupErrors<'startDate' | 'endDate'> {
  const errors: SetupErrors<'startDate' | 'endDate'> = {};
  const startOk = isValidIsoDate(startDate);
  if (!startOk) errors.startDate = 'Enter an active start date.';
  if (endDate !== null) {
    if (!isValidIsoDate(endDate)) errors.endDate = 'Enter an active end date.';
    else if (startOk && endDate <= startDate) {
      errors.endDate = 'The active end date must be after the start date.';
    }
  }
  return errors;
}

function validateName(name: string, noun: string): string | undefined {
  if (name.trim() === '') return `Enter a ${noun} name.`;
  if (name.length > NAME_MAX) return `Use at most ${NAME_MAX} characters.`;
  return undefined;
}

const descriptionError = (description: string) =>
  description.length > DESCRIPTION_MAX ? `Use at most ${DESCRIPTION_MAX} characters.` : undefined;

function compact<K extends string>(errors: SetupErrors<K>): SetupErrors<K> {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as SetupErrors<K>;
}

export function validateRoomType(input: RoomTypeInput): SetupErrors<RoomTypeField> {
  return compact<RoomTypeField>({
    name: validateName(input.name, 'room type'),
    ...validateDates(input.startDate, input.endDate),
    description: descriptionError(input.details.description),
    // 9.4.10.1: at least one photo is required for a room type.
    photos: input.details.photos.length === 0 ? 'Add at least one photo.' : undefined,
  });
}

/** The owner is optional (the field only exists while the Owner system setting is on). */
export function validateRoom(input: RoomInput): SetupErrors<RoomField> {
  return compact<RoomField>({
    name: validateName(input.name, 'room'),
    ...validateDates(input.startDate, input.endDate),
    roomTypeId: input.roomTypeId === '' ? 'Select a room type.' : undefined,
    description: input.inheritDetails ? undefined : descriptionError(input.details.description),
  });
}

/** Active on `today` when it is not before the start and not after the end. */
export function isActiveOn(item: { startDate: string; endDate: string | null }, today: string) {
  return item.startDate <= today && (item.endDate === null || item.endDate >= today);
}

const NATURAL = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Inactive items move to the bottom of the list (9.4.2.4); each group sorts by name. */
export function sortSetupItems<
  T extends { name: string; startDate: string; endDate: string | null },
>(items: readonly T[], today: string): T[] {
  const rank = (i: T) => (isActiveOn(i, today) ? 0 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b) || NATURAL.compare(a.name, b.name));
}

/** Checkbox lists: toggling, Select All and Select None. */
export const toggleId = (ids: readonly string[], id: string, on: boolean): string[] =>
  on ? (ids.includes(id) ? [...ids] : [...ids, id]) : ids.filter((x) => x !== id);
export const selectAllIds = (all: readonly { id: string }[]): string[] => all.map((x) => x.id);

/** The details a room shows and the backend stores: the room type's while inheriting. */
export function effectiveDetails(
  room: Pick<RoomInput, 'inheritDetails' | 'details' | 'roomTypeId'>,
  roomTypes: readonly RoomTypeSetup[],
): RoomDetails {
  const type = roomTypes.find((t) => t.id === room.roomTypeId);
  return room.inheritDetails && type ? structuredClone(type.details) : room.details;
}

/**
 * Changing the room type resets Inherit Details to on (10.4.3.2) unless it is already off, in
 * which case the toggle stays off and the adjusted fields stay (10.4.6.9).
 */
export function changeRoomType(
  room: RoomInput,
  roomTypeId: string,
  roomTypes: readonly RoomTypeSetup[],
): RoomInput {
  const next = { ...room, roomTypeId };
  return next.inheritDetails ? { ...next, details: effectiveDetails(next, roomTypes) } : next;
}

/**
 * Inherit Details toggled: turning it on re-reads the current room type (10.4.5.1); turning it off
 * keeps the inherited values as the starting point (10.4.6). Inherit Rates stays as it is.
 */
export function setInheritDetails(
  room: RoomInput,
  inherit: boolean,
  roomTypes: readonly RoomTypeSetup[],
): RoomInput {
  const next = { ...room, inheritDetails: inherit };
  return inherit ? { ...next, details: effectiveDetails(next, roomTypes) } : next;
}

/** Linked rooms are a two-way link (10.4.6.8.4.1): returns every room with both sides updated. */
export function syncLinkedRooms(
  rooms: readonly RoomSetup[],
  roomId: string,
  linkedRoomIds: readonly string[],
): RoomSetup[] {
  const linked = new Set(linkedRoomIds.filter((id) => id !== roomId));
  return rooms.map((room) => {
    if (room.id === roomId) return { ...room, linkedRoomIds: [...linked] };
    const has = room.linkedRoomIds.includes(roomId);
    if (linked.has(room.id) && !has) {
      return { ...room, linkedRoomIds: [...room.linkedRoomIds, roomId] };
    }
    if (!linked.has(room.id) && has) {
      return { ...room, linkedRoomIds: room.linkedRoomIds.filter((id) => id !== roomId) };
    }
    return room;
  });
}

/** Deleting a room also removes it from every other room's links. */
export function withoutRoom(rooms: readonly RoomSetup[], roomId: string): RoomSetup[] {
  return rooms
    .filter((r) => r.id !== roomId)
    .map((r) =>
      r.linkedRoomIds.includes(roomId)
        ? { ...r, linkedRoomIds: r.linkedRoomIds.filter((id) => id !== roomId) }
        : r,
    );
}

/** Rooms of `roomTypeId`: a room type in use is not deleted (provisional answer to Q-72-2). */
export const roomsOfType = (rooms: readonly RoomSetup[], roomTypeId: string) =>
  rooms.filter((r) => r.roomTypeId === roomTypeId);

export type DeleteCheck =
  | { kind: 'blocked'; message: string }
  | { kind: 'warn'; message: string }
  | { kind: 'ok'; message: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function checkDeleteRoomType(
  roomType: Pick<RoomTypeSetup, 'id' | 'name'>,
  rooms: readonly RoomSetup[],
): DeleteCheck {
  const used = roomsOfType(rooms, roomType.id);
  if (used.length > 0) {
    return {
      kind: 'blocked',
      message: `${roomType.name} cannot be deleted: ${plural(used.length, 'room uses', 'rooms use')} it. Move or delete ${used.length === 1 ? 'that room' : 'those rooms'} first.`,
    };
  }
  return { kind: 'ok', message: `Delete ${roomType.name}? This cannot be undone.` };
}

export function checkDeleteRoom(
  room: Pick<RoomSetup, 'name' | 'upcomingReservations'>,
): DeleteCheck {
  if (room.upcomingReservations > 0) {
    return {
      kind: 'warn',
      message: `${room.name} has ${plural(room.upcomingReservations, 'upcoming reservation', 'upcoming reservations')}. Deleting it leaves ${room.upcomingReservations === 1 ? 'that reservation' : 'those reservations'} without a room. Delete anyway?`,
    };
  }
  return { kind: 'ok', message: `Delete ${room.name}? This cannot be undone.` };
}

export interface PhotoFile {
  name: string;
  type: string;
  size: number;
}

/** Filters a selection of files for the uploader; `errors` explain every file left out. */
export function acceptPhotoFiles<T extends PhotoFile>(
  files: readonly T[],
  existingCount: number,
): { accepted: T[]; errors: string[] } {
  const accepted: T[] = [];
  const errors: string[] = [];
  for (const file of files) {
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
      errors.push(`${file.name} is not a JPEG, PNG or WebP image.`);
    } else if (file.size > PHOTO_MAX_BYTES) {
      errors.push(`${file.name} is larger than ${PHOTO_MAX_BYTES / (1024 * 1024)} MB.`);
    } else if (existingCount + accepted.length >= MAX_PHOTOS) {
      errors.push(`${file.name} was not added: at most ${MAX_PHOTOS} photos.`);
    } else {
      accepted.push(file);
    }
  }
  return { accepted, errors };
}

export const removePhoto = (photos: readonly RoomPhoto[], id: string): RoomPhoto[] =>
  photos.filter((p) => p.id !== id);

/** Quantity picker: clamps to the range and rounds to a whole number. */
export function clampCount(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export interface SetupListEntry {
  id: string;
  label: string;
  inactive: boolean;
}

/**
 * Rows of a setup list (Room Types, Rooms, Add-Ons) from items ALREADY sorted by `sortSetupItems`
 * (the order the editor selects from, so the default selection is the first row). `inactive` is true
 * outside the active dates: past the end date, and also before the start date (a future item).
 * Rate Categories builds its own rows with `isActiveOn`.
 */
export function toSetupListEntries<
  T extends { id: string; name: string; startDate: string; endDate: string | null },
>(sortedItems: readonly T[], today: string): SetupListEntry[] {
  return sortedItems.map((i) => ({
    id: i.id,
    label: i.name,
    inactive: !isActiveOn(i, today),
  }));
}

/**
 * Inactive items go to the bottom, each group keeping the order it came in. Rooms use it: their
 * order is the saved one (Reorder), not alphabetical.
 */
export function activeFirst<T extends { startDate: string; endDate: string | null }>(
  items: readonly T[],
  today: string,
): T[] {
  return [
    ...items.filter((i) => isActiveOn(i, today)),
    ...items.filter((i) => !isActiveOn(i, today)),
  ];
}
