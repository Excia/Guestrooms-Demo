import { describe, expect, it } from 'vitest';
import { acceptPhotoFiles, cssUrl, sniffPhotoType, storedPhotoName } from './photos';

const file = (name: string) => ({ name, type: 'image/png', size: 1000 });

describe('storedPhotoName', () => {
  it('cuts off any folder part and unsafe characters', () => {
    expect(storedPhotoName('../../etc/passwd.png')).toBe('passwd.png');
    expect(storedPhotoName('C:\\temp\\My Photo (1).JPG')).toBe('MyPhoto1.JPG');
    expect(storedPhotoName('.hidden.png')).toBe('hidden.png');
    expect(storedPhotoName('<script>.png')).toBe('script.png');
  });
});

describe('extensions', () => {
  it('accepts .jpg, .jpeg and .png in any case and nothing else', () => {
    const ok = (name: string) => acceptPhotoFiles([file(name)], 0).accepted.length === 1;
    expect(ok('a.JPG')).toBe(true);
    expect(ok('a.jpeg')).toBe(true);
    expect(ok('a.PNG')).toBe(true);
    expect(ok('a.gif')).toBe(false);
    expect(ok('a.png.exe')).toBe(false);
    expect(ok('.png')).toBe(false);
  });
});

describe('sniffPhotoType', () => {
  it('recognizes JPEG and PNG signatures only', () => {
    expect(sniffPhotoType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(
      sniffPhotoType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    ).toBe('image/png');
    expect(sniffPhotoType(Uint8Array.from([0x47, 0x49, 0x46, 0x38]))).toBeNull();
    expect(sniffPhotoType(new Uint8Array())).toBeNull();
  });
});

describe('cssUrl', () => {
  it('escapes what could end the url early', () => {
    expect(cssUrl('blob:abc')).toBe('url("blob:abc")');
    expect(cssUrl('a").x{}("')).toBe('url("a\\22 \\29 .x{}\\28 \\22 ")');
    expect(cssUrl('a\\b\nc')).toBe('url("a\\5c b\\a c")');
  });
});
