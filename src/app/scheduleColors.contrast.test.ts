import { getContrastRatio } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';
import { theme } from '../theme';

// Fills are translucent over the white grid; text must reach WCAG AA (4.5:1) on the result.
function overWhite(rgba: string): string {
  const m = rgba.match(/[\d.]+/g)!.map(Number);
  const [r, g, b, a = 1] = m;
  const mix = (c: number) => Math.round(255 * (1 - a) + c * a);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

const c = theme.palette.schedule;
const blockFills = {
  nyci: c.nyci,
  checkedIn: c.checkedIn,
  checkedOut: c.checkedOut,
  dueOut: c.dueOut,
  linked: c.linked,
};
const chipFills = {
  hkNotCheckedOut: c.hkNotCheckedOut,
  hkNeedsCleaning: c.hkNeedsCleaning,
  hkCleaned: c.hkCleaned,
  hkReady: c.hkReady,
  hkNeedsMaintenance: c.hkNeedsMaintenance,
};

describe('text contrast on schedule fills', () => {
  it.each(Object.entries(blockFills))('guest name and detail text on %s', (_n, fill) => {
    const bg = overWhite(fill);
    for (const text of [
      c.ownerText,
      c.memberText,
      theme.palette.text.primary,
      theme.palette.grey[800],
    ]) {
      expect(getContrastRatio(text, bg), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it.each(Object.entries(chipFills))('the black H on %s', (_n, fill) => {
    const bg = overWhite(fill);
    expect(getContrastRatio(theme.palette.common.black, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

// Past events (checked out, so the checked-out fill only) are drawn at `opacity.past` over the white
// grid: text and fill both fade, and the text must still reach AA.
function fade(color: string, opacity: number): string {
  const [r, g, b, a = 1] = color.match(/[\d.]+/g)!.map(Number);
  const m = (v: number) => Math.round(255 * (1 - opacity * a) + v * opacity * a);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}
function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

describe('text contrast on a faded past block', () => {
  const { past } = c.opacity;
  it.each([['checkedOut', c.checkedOut]])('on %s', (_n, fill) => {
    const bg = fade(overWhite(fill), past);
    for (const text of [c.ownerText, c.memberText, '#000000', theme.palette.grey[800]]) {
      const fg = fade(hexToRgb(text), past);
      expect(getContrastRatio(fg, bg), `${text} on ${fill} at ${past}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('past is lighter than normal but still visible', () => {
    expect(c.opacity.past).toBeLessThan(c.opacity.normal);
    expect(c.opacity.past).toBeGreaterThanOrEqual(0.5);
  });
});
