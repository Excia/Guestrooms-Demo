// Sizes of the schedule grid in theme spacing units (8px each), from Figma 13908:90997.
/** Row and header height: 60px. */
export const ROW_HEIGHT = 7.5;
/** Room header column: 130px. */
export const LABEL_WIDTH = 16.25;
/** Reservation block height (48px) and its offset in the row (6px). */
export const BLOCK_HEIGHT = 6;
export const BLOCK_TOP = 0.75;
/** Narrowest date column per view length: wider screens stretch the columns, narrower ones scroll. */
export const MIN_DAY_WIDTH = { 7: 15, 14: 11.25, 30: 5 } as const;

/** The grid sets this custom property (the room header width) on its scroll container. */
export const LABEL_VAR = '--schedule-label-width';

/** Custom property holding the row height (set by the grid, like LABEL_VAR). */
export const ROW_VAR = '--schedule-row-height';

/** CSS `top` of row `index`. */
export const rowTop = (index: number): string => `calc(${index} * var(${ROW_VAR}))`;

/** CSS `left` for a fraction (0..1) of the date area. */
export const dateAreaX = (fraction: number): string =>
  `calc(var(${LABEL_VAR}) + (100% - var(${LABEL_VAR})) * ${fraction})`;

/** CSS width for a fraction of the date area, minus `gap` (a CSS length). */
export const dateAreaWidth = (fraction: number, gap = '0px'): string =>
  `calc((100% - var(${LABEL_VAR})) * ${fraction} - ${gap})`;
