import type { Theme } from '@mui/material/styles';

/**
 * Size standard of the compact rate table (entries/rate-categories-polish.md, D-RCP-2). Spacing
 * units are 8px, so the px values below are exact multiples (3.5 = 28px, 8.25 = 66px, 0.375 = 3px).
 * The table alone is compact: the rest of the page keeps the form sizes. The 28px control height
 * stays above the 24px WCAG 2.2 minimum target.
 */
export const RATE_TABLE = {
  /** Body text, amount text and "$" in px (the theme body is 14px). */
  fontPx: 13,
  /** Column header text in px. */
  headerFontPx: 12,
  /** Amount field width in px (fits "$ 1,250.00"; the legacy column is 80px of cell). */
  amountWidthPx: 66,
  /** Amount field height in px. */
  amountHeightPx: 28,
  /** Padding inside the amount input in px (left, right). Amounts are right aligned, with no "$": the heading says dollars. */
  inputPadLeftPx: 4,
  inputPadRightPx: 2,
  /**
   * Widest amount text measured in Chrome 155 at 13px Roboto: "12,500.00" is 57.1px, "1,250.00" 49.8px
   * (canvas measureText, 2026-10-25). The input content box (amountWidthPx minus the padding) must hold it.
   */
  widestAmountTextPx: 57.2,
  /** Cell padding in px: vertical, horizontal. */
  cellPaddingYPx: 3,
  cellPaddingXPx: 3,
  /** Sticky first column (room type) width in px. */
  roomTypeMinPx: 112,
  roomTypeMaxPx: 160,
  /** Sticky first column (Season / Special Rates: name, dates, SKU, actions) width in px. */
  seasonColPx: 232,
  /** Width of the colour edge on each season in px. */
  accentPx: 6,
} as const;

/** Theme spacing for a px value of the table (the spacing unit is 8px). */
export const tablePx = (t: Theme, px: number) => t.spacing(px / 8);
