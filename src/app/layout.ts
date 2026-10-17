/** Header height in theme.spacing units (7 x 8px = 56px, Figma 12047:5668). */
export const HEADER_HEIGHT = 7;

/**
 * Menu overlay scale: every Figma-derived size in the menu (1302:18023) is multiplied by this.
 * 1 = Figma's size; tune this one number (hot-reloads) to resize the whole overlay.
 */
export const MENU_SCALE = 0.7;
/** Smallest text size (px) the scaled menu may use, for readability (WCAG). */
export const MENU_MIN_FONT_PX = 14;

/** A Figma pixel value scaled for the menu, rounded to whole px. */
export const menuPx = (figmaPx: number): number => Math.round(figmaPx * MENU_SCALE);
/** A Figma font size scaled for the menu, never below MENU_MIN_FONT_PX. */
export const menuFontPx = (figmaPx: number): number => Math.max(MENU_MIN_FONT_PX, menuPx(figmaPx));

/** Id of the app header (banner); the menu overlay's Tab loop includes its controls. */
export const HEADER_ID = 'app-header';
