import { theme } from '../../../theme';
import { RATE_TABLE, tablePx } from './rateTableSizes';

describe('compact rate table sizes', () => {
  it('keeps controls at or above the 24px WCAG 2.2 target and the text readable', () => {
    expect(RATE_TABLE.amountHeightPx).toBeGreaterThanOrEqual(24);
    expect(RATE_TABLE.fontPx).toBeGreaterThanOrEqual(12);
    expect(RATE_TABLE.headerFontPx).toBeGreaterThanOrEqual(12);
  });
  it('maps to exact px through the theme spacing (8px unit)', () => {
    for (const px of [
      RATE_TABLE.amountWidthPx,
      RATE_TABLE.amountHeightPx,
      RATE_TABLE.cellPaddingYPx,
      RATE_TABLE.cellPaddingXPx,
    ]) {
      expect(tablePx(theme, px)).toBe(`${px}px`);
    }
  });
  it('fits 13 amount columns plus the room type column in the 1400px content width (1086px)', () => {
    const column = RATE_TABLE.amountWidthPx + 2 * RATE_TABLE.cellPaddingXPx;
    // Measured room type column at 1400px: 131px (112 minimum plus the colour edge and padding).
    expect(131 + 13 * column).toBeLessThanOrEqual(1086);
  });
});
