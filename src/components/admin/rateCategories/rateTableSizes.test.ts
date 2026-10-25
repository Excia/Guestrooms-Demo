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
  it('leaves room in the amount input for 12,500.00 at 13px (measured in Chrome)', () => {
    const content =
      RATE_TABLE.amountWidthPx - RATE_TABLE.inputPadLeftPx - RATE_TABLE.inputPadRightPx;
    expect(content).toBeGreaterThanOrEqual(RATE_TABLE.widestAmountTextPx);
  });
});
