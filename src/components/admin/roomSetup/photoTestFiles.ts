// Test files whose first bytes match their type (the uploader checks the signature).
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];

export function photoFile(name: string, type = 'image/png', size = 1000, bytes?: number[]): File {
  const f = new File([new Uint8Array(bytes ?? (type === 'image/jpeg' ? JPEG : PNG))], name, {
    type,
  });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}
