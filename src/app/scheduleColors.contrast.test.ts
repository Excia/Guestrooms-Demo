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
