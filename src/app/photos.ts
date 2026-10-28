// Photo rules for Room Types, Rooms and Add-On Items (ticket 190): what the uploader accepts, the
// legacy delete confirmation, and the order. Pure; the components and the mock API call these.
import type { RoomPhoto } from '../api/types';
import { moveItem } from './roomOrder';

/** Photos one record can hold. PLACEHOLDER: the legacy app has no total limit (Q-190-1). */
export const MAX_PHOTOS = 50;
/** Legacy: a file is a .jpg or .png (ImageUploadInput). */
export const PHOTO_TYPES = ['image/jpeg', 'image/png'] as const;
/** Legacy: 1.5 MB per file. */
export const PHOTO_MAX_BYTES = 1.5e6;
/** Legacy: at most 10 files in one upload. */
export const MAX_UPLOAD_FILES = 10;
/** Legacy: a sanitized file name is 1 to 255 characters. */
export const PHOTO_NAME_MAX = 255;

export const PHOTO_RULES_HINT = `JPG or PNG, up to 1.5 MB each, up to ${MAX_UPLOAD_FILES} at a time.`;
export const UPLOAD_SUCCESS_MESSAGE = 'File(s) uploaded successfully';
export const UPLOAD_FAILED_MESSAGE = 'The photos could not be uploaded. Try again.';

/** Legacy delete: the first click arms the button, which can be pressed after 0.5 s and lapses after 5 s. */
export const DELETE_ARM_MS = 500;
export const DELETE_LAPSE_MS = 5000;

export interface PhotoFile {
  name: string;
  type: string;
  size: number;
}

/** Legacy: characters other than a-z, A-Z, 0-9, ".", "-" and "_" are dropped from a file name. */
export const sanitizePhotoName = (name: string): string =>
  name.trim().replace(/[^a-zA-Z0-9._-]/g, '');

const hasValidName = (name: string): boolean => {
  const clean = sanitizePhotoName(name);
  return clean.length > 0 && clean.length <= PHOTO_NAME_MAX && clean.lastIndexOf('.') > 0;
};

const formatMb = (bytes: number) => `${bytes / 1e6} MB`;

/** Filters a selection of files for the uploader; `errors` explain every file left out. */
export function acceptPhotoFiles<T extends PhotoFile>(
  files: readonly T[],
  existingCount: number,
): { accepted: T[]; errors: string[] } {
  const accepted: T[] = [];
  const errors: string[] = [];
  files.forEach((file, index) => {
    if (index >= MAX_UPLOAD_FILES) {
      errors.push(`${file.name} was not added: at most ${MAX_UPLOAD_FILES} photos at a time.`);
    } else if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
      errors.push(`${file.name} is not a JPG or PNG image.`);
    } else if (file.size > PHOTO_MAX_BYTES) {
      errors.push(`${file.name} is larger than ${formatMb(PHOTO_MAX_BYTES)}.`);
    } else if (!hasValidName(file.name)) {
      errors.push(`${file.name} has an invalid file name.`);
    } else if (existingCount + accepted.length >= MAX_PHOTOS) {
      errors.push(`${file.name} was not added: at most ${MAX_PHOTOS} photos.`);
    } else {
      accepted.push(file);
    }
  });
  return { accepted, errors };
}

export const removePhoto = (photos: readonly RoomPhoto[], id: string): RoomPhoto[] =>
  photos.filter((p) => p.id !== id);

/** Moves a photo one place (`-1` earlier, `1` later); the ends stay put. */
export const nudgePhoto = (photos: readonly RoomPhoto[], index: number, by: -1 | 1): RoomPhoto[] =>
  moveItem(photos, index, index + by);

/** Moves the photo at `from` to position `to` (a drop). */
export const movePhoto = (photos: readonly RoomPhoto[], from: number, to: number): RoomPhoto[] =>
  moveItem(photos, from, to);

/** True when the two lists hold the same photos in the same order. */
export const samePhotoOrder = (a: readonly RoomPhoto[], b: readonly RoomPhoto[]): boolean =>
  a.length === b.length && a.every((p, i) => p.id === b[i].id);
