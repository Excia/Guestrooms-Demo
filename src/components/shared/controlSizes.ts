import type { Theme } from '@mui/material/styles';

/**
 * One size standard for input controls (ticket: reservation-list polish, 2026-10-25).
 * - Toolbars (Schedule controls row, Reservation List filters): `small` fields, 40px high.
 * - Forms and dialogs: `medium` fields, 56px high (Figma input).
 * Widths are theme spacing units (8px each), so pages share them instead of repeating numbers.
 */
export const TOOLBAR_FIELD_SIZE = 'small' as const;
export const FORM_FIELD_SIZE = 'medium' as const;

/** Rendered heights in px, for tests and docs; the real height comes from MUI's size prop. */
export const FIELD_HEIGHT_PX = { small: 40, medium: 56 } as const;

/** Toolbar field widths, as spacing units. */
export const TOOLBAR_FIELD_WIDTH = {
  /** Short single-choice select (View: 7 Days). 114px. */
  select: 14.25,
  /** Date field with its calendar button. 176px. */
  date: 22,
  /** Select with entity names (Location). 200px. */
  wideSelect: 25,
} as const;

export const toolbarWidth = (key: keyof typeof TOOLBAR_FIELD_WIDTH) => (t: Theme) =>
  t.spacing(TOOLBAR_FIELD_WIDTH[key]);
