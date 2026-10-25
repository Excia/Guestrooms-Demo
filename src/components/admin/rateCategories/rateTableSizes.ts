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
  /** Cell padding in px: vertical, horizontal. */
  cellPaddingYPx: 3,
  cellPaddingXPx: 3,
  /** Sticky first column (room type) width in px. */
  roomTypeMinPx: 112,
  roomTypeMaxPx: 160,
  /** Title rows are this much narrower than the scroll box (see RateTable). */
  titleAllowancePx: 8,
  /** Width of the colour edge on each season in px. */
  accentPx: 6,
} as const;

/** Theme spacing for a px value of the table (the spacing unit is 8px). */
export const tablePx = (t: Theme, px: number) => t.spacing(px / 8);
