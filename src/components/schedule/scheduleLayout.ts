// Sizes of the schedule grid in theme spacing units (8px each), from Figma 13908:90997.
/** Row and header height: 60px. */
export const ROW_HEIGHT = 7.5;
/** Room header column: 130px. */
export const LABEL_WIDTH = 16.25;
/** Figma sets the "location | room type" caption in the room header at 10px (no typography token is that small). */
export const ROOM_CAPTION_PX = 10;
/** Guest-type icon in a block: 16px (Figma), 2 spacing units. */
export const BLOCK_ICON_SPACING = 2;

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

/**
 * Early Check In / Late Check Out sliver on a reservation block (theme spacing units): 4px wide with a
 * 2px gap. The block's painted body is inset by marker + gap on that edge and the sliver sits in the
 * freed strip, so it is always against the grid background: inside the block it vanished against the
 * orange due-out colour (a stay departing today). The block's box, the nights it occupies and its
 * drag/drop/keyboard geometry are unchanged (only the painted edge moves), and back-to-back stays
 * (a same-day turnover) never collide, since each marker stays inside its own box.
 */
export const MARKER_WIDTH = 0.5;
export const MARKER_GAP = 0.25;
