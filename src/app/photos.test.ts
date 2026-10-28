import { describe, expect, it } from 'vitest';
import type { RoomPhoto } from '../api/types';
import {
  acceptPhotoFiles,
  MAX_PHOTOS,
  MAX_UPLOAD_FILES,
  movePhoto,
  nudgePhoto,
  PHOTO_MAX_BYTES,
  removePhoto,
  samePhotoOrder,
  sanitizePhotoName,
} from './photos';

const file = (name: string, type = 'image/png', size = 1000) => ({ name, type, size });
const photos = ['a', 'b', 'c'].map((id): RoomPhoto => ({ id, name: `${id}.jpg`, url: '' }));
const ids = (list: readonly RoomPhoto[]) => list.map((p) => p.id);

describe('acceptPhotoFiles', () => {
  it('accepts JPG and PNG up to the size limit and explains every other file', () => {
    const { accepted, errors } = acceptPhotoFiles(
      [
        file('a.png'),
        file('b.jpg', 'image/jpeg', PHOTO_MAX_BYTES),
        file('c.pdf', 'application/pdf'),
        file('d.webp', 'image/webp'),
        file('e.png', 'image/png', PHOTO_MAX_BYTES + 1),
      ],
      0,
    );
    expect(accepted.map((f) => f.name)).toEqual(['a.png', 'b.jpg']);
    expect(errors).toEqual([
      'c.pdf is not a JPG or PNG image.',
      'd.webp is not a JPG or PNG image.',
      'e.png is larger than 1.5 MB.',
    ]);
  });

  it('takes at most 10 files at a time', () => {
    const many = Array.from({ length: MAX_UPLOAD_FILES + 2 }, (_, i) => file(`p${i}.png`));
    const { accepted, errors } = acceptPhotoFiles(many, 0);
    expect(accepted).toHaveLength(MAX_UPLOAD_FILES);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/at most 10 photos at a time/);
  });

  it('stops at the total number of photos', () => {
    const { accepted, errors } = acceptPhotoFiles([file('a.png'), file('b.png')], MAX_PHOTOS - 1);
    expect(accepted).toHaveLength(1);
    expect(errors[0]).toMatch(/at most 50 photos/);
  });

  it('rejects a name that is empty once sanitized or has no extension', () => {
    const { accepted, errors } = acceptPhotoFiles(
      [file('???.png'), file('noext'), file('ok.png')],
      0,
    );
    expect(accepted.map((f) => f.name)).toEqual(['ok.png']);
    expect(errors).toHaveLength(2);
  });

  it('rejects a name longer than 255 characters', () => {
    expect(acceptPhotoFiles([file(`${'x'.repeat(252)}.png`)], 0).errors).toHaveLength(1);
    expect(acceptPhotoFiles([file(`${'x'.repeat(251)}.png`)], 0).errors).toHaveLength(0);
  });
});

describe('sanitizePhotoName', () => {
  it('drops characters other than letters, digits, dot, dash and underscore', () => {
    expect(sanitizePhotoName('  My photo (1)!.png ')).toBe('Myphoto1.png');
  });
});

describe('ordering', () => {
  it('removes a photo by id', () => {
    expect(ids(removePhoto(photos, 'b'))).toEqual(['a', 'c']);
  });
  it('nudges a photo one place and leaves the ends alone', () => {
    expect(ids(nudgePhoto(photos, 1, -1))).toEqual(['b', 'a', 'c']);
    expect(ids(nudgePhoto(photos, 1, 1))).toEqual(['a', 'c', 'b']);
    expect(ids(nudgePhoto(photos, 0, -1))).toEqual(['a', 'b', 'c']);
    expect(ids(nudgePhoto(photos, 2, 1))).toEqual(['a', 'b', 'c']);
  });
  it('moves a dropped photo to its place', () => {
    expect(ids(movePhoto(photos, 0, 2))).toEqual(['b', 'c', 'a']);
    expect(ids(movePhoto(photos, 2, 0))).toEqual(['c', 'a', 'b']);
  });
  it('compares orders', () => {
    expect(samePhotoOrder(photos, [...photos])).toBe(true);
    expect(samePhotoOrder(photos, movePhoto(photos, 0, 1))).toBe(false);
    expect(samePhotoOrder(photos, photos.slice(1))).toBe(false);
  });
});
