import { alpha, createTheme, lighten } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import { menuFontPx } from './app/layout';

// Tokens from the CE Guest Rooms Figma variables (dashboard frame 69:3712). Light mode only.
/** Schedule grid block colors (Figma "Schedule Blocks" 15963:188278). Fills are translucent. */
export interface ScheduleColors {
  /** Confirmed and not yet checked in. */
  nyci: string;
  nyciBorder: string;
  checkedIn: string;
  checkedOut: string;
  /** Checked in and leaving today. */
  dueOut: string;
  closure: string;
  /** Linked-room block (Figma "Linked Room" state). */
  linked: string;
  /** Housekeeping chip fills (Figma "Housekeeping Block"). */
  hkNotCheckedOut: string;
  hkNeedsCleaning: string;
  hkCleaned: string;
  hkReady: string;
  hkNeedsMaintenance: string;
  /** Guest name colors by guest type. */
  ownerText: string;
  memberText: string;
  /** Today's column. */
  today: string;
  /** Drop indicator while dragging: allowed / not allowed. */
  dropAllowed: string;
  dropRefused: string;
  /** Unassigned section rows (opaque: the sticky row label sits over scrolling blocks). */
  unassignedRow: string;
  /**
   * Held slot (ticket 152, no Figma frame: PLACEHOLDER): a tint, diagonal stripes and a dashed
   * outline, so the hold reads without colour.
   */
  hold: string;
  holdStripe: string;
  holdBorder: string;
  /** Past dates of the grid (columns before today), a faint wash. */
  pastDate: string;
  /** The columns a dragged reservation would occupy, drawn across all rows. */
  dropColumn: string;
  /** Opacity of a whole block by state. */
  opacity: ScheduleOpacity;
}

/**
 * Block opacity tokens. The legacy schedule draws past events at 50%, current and future at 75% and
 * the active event at 100%. This build's blocks are solid fills (Figma), so `normal` stays 1 until
 * the designer confirms 75% (entries/150-block-states.md, Q-150-1); `past` is 0.8, the lightest
 * value whose text still reaches WCAG AA (4.5:1) on the checked-out fill (see the contrast test);
 * the legacy 50% gives about 3:1.
 */
export interface ScheduleOpacity {
  /** Current and future events. */
  normal: number;
  /** Events checked out. */
  past: number;
  /** The event whose panel is open (or shown through "see on schedule"). */
  active: number;
  /** Linked-room block (legacy: 75%). */
  linked: number;
  /** The original block while it is being dragged. */
  dragging: number;
  /** The copy that follows the pointer. */
  ghost: number;
}

/** Folio screen colors (Figma Balance Summary 16575:25666 and the status chips 12050:11503). */
export interface FolioColors {
  /** Balance Summary fills: grey (also the closed state), yellow, green, red. */
  balanceGrey: string;
  balanceYellow: string;
  balanceGreen: string;
  balanceRed: string;
  /** "Not Checked In" chip fill. */
  notCheckedIn: string;
  /** Selection/action bar under the charges (light green). */
  actionBar: string;
  /** Manual Charge, Add Deposit and Jump buttons (Figma #47566b, not a variable). */
  slateButton: string;
}

declare module '@mui/material/styles' {
  interface Palette {
    schedule: ScheduleColors;
    folio: FolioColors;
  }
  interface PaletteOptions {
    schedule?: ScheduleColors;
    folio?: FolioColors;
  }
  // tint and outlinedBorder are set on palette.primary only (the Figma tokens exist for primary).
  interface PaletteColor {
    tint?: string;
    outlinedBorder?: string;
    /** Light tint of the color for row and banner backgrounds (Figma warning/background). */
    background?: string;
  }
  interface SimplePaletteColorOptions {
    tint?: string;
    outlinedBorder?: string;
    background?: string;
  }
  interface TypographyVariants {
    h4_fixed: CSSProperties;
    menu_item: CSSProperties;
    list_link: CSSProperties;
    menu_heading: CSSProperties;
    button_small: CSSProperties;
  }
  interface TypographyVariantsOptions {
    h4_fixed?: CSSProperties;
    menu_item?: CSSProperties;
    list_link?: CSSProperties;
    menu_heading?: CSSProperties;
    button_small?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    h4_fixed: true;
    menu_item: true;
    list_link: true;
    menu_heading: true;
    button_small: true;
  }
}

// Not in Figma variables, intentionally left at MUI defaults: secondary, success, divider,
// text.disabled. Figma has one unnamed "Secondary" #545454; add it once its role is confirmed.
const fontFamily = 'Roboto, Helvetica, Arial, sans-serif';
const primaryMain = '#2e7d32';
const errorMain = '#d32f2f';
const infoMain = '#0057b2';

// Figma letter spacing is in px; MUI expects em.
const font = (sizePx: number, weight: number, lineHeight: number, letterSpacingPx: number) => ({
  fontFamily,
  fontSize: `${sizePx / 16}rem`,
  fontWeight: weight,
  lineHeight,
  letterSpacing: `${(letterSpacingPx / sizePx).toFixed(5)}em`,
});

const base = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: primaryMain,
      contrastText: '#ffffff',
      tint: '#eaf2ea',
      outlinedBorder: alpha(primaryMain, 0.5),
    },
    // Figma info/main #0057b2 (Night Audit button); warning/background #f9ede5 (failed list rows).
    info: { main: infoMain, contrastText: '#ffffff' },
    warning: { main: '#c24e00', background: '#f9ede5' },
    error: { main: errorMain },
    text: { primary: '#000000de', secondary: '#00000099' },
    action: { active: '#0000008f' },
    background: { default: '#f1f1f1', paper: '#ffffff' },
    folio: {
      balanceGrey: '#d9d9d9',
      balanceYellow: '#fff59d',
      balanceGreen: '#a5d6a7',
      balanceRed: '#ef9a9a',
      notCheckedIn: '#fff9c4',
      actionBar: '#e8f3e8',
      slateButton: '#47566b',
    },
    schedule: {
      nyci: 'rgba(250, 250, 250, 0.8)',
      nyciBorder: 'rgba(56, 142, 60, 0.8)',
      checkedIn: 'rgba(175, 210, 177, 0.8)',
      checkedOut: 'rgba(224, 224, 224, 0.8)',
      // Figma "DueOut" state 15214:8379: orange at 40%.
      dueOut: 'rgba(228, 113, 0, 0.4)',
      closure: 'rgba(189, 189, 189, 0.8)',
      linked: 'rgba(189, 189, 189, 0.8)',
      hkNotCheckedOut: 'rgba(66, 66, 66, 0.3)',
      hkNeedsCleaning: 'rgba(228, 113, 0, 0.8)',
      hkCleaned: 'rgba(253, 216, 53, 0.8)',
      hkReady: 'rgba(56, 142, 60, 0.8)',
      hkNeedsMaintenance: 'rgba(239, 83, 80, 0.8)',
      ownerText: '#043f7a',
      memberText: '#16491a',
      today: alpha(primaryMain, 0.07),
      dropAllowed: alpha(primaryMain, 0.22),
      dropRefused: alpha(errorMain, 0.2),
      // PLACEHOLDER: Figma shows a light pink row; this is the error color at 90% lightness.
      unassignedRow: lighten(errorMain, 0.9),
      // PLACEHOLDER (F-152-1): Figma has no held-slot frame. Info blue (#0057b2) tint, stripes, outline.
      hold: alpha(infoMain, 0.12),
      holdStripe: alpha(infoMain, 0.28),
      holdBorder: infoMain,
      pastDate: alpha('#000000', 0.04),
      dropColumn: alpha(primaryMain, 0.1),
      opacity: { normal: 1, past: 0.8, active: 1, linked: 0.75, dragging: 0.4, ghost: 0.9 },
    },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily,
    subtitle1: font(18, 500, 1.4, 0.15),
    subtitle2: font(14, 500, 1.57, 0.1),
    // Figma typography/h6: 20px Medium, line height 1.6, 0.15px tracking (menu overlay headings).
    h6: font(20, 500, 1.6, 0.15),
    h4_fixed: font(16, 700, 1.4, 0.15),
    // Menu overlay (Figma 1302:18023): links 22px and headings 20px Medium, scaled by MENU_SCALE.
    menu_item: font(menuFontPx(22), 500, 1.2, 0),
    menu_heading: font(menuFontPx(20), 500, 1.6, 0.15),
    // Dashboard shortcut rows (Figma 69:3790): 22px Medium, unscaled (MENU_SCALE is menu-only).
    list_link: font(22, 500, 1.2, 0),
    caption: font(12, 400, 1.4, 0.4),
    button: font(14, 500, 24 / 14, 0.4),
    // Figma button/small (13px Medium): section captions such as "Compare to:" (set uppercase by the caller).
    button_small: { ...font(13, 500, 22 / 13, 0.46), textTransform: 'uppercase' },
  },
  components: {
    // Hover: non-solid buttons, icon buttons, list rows and unstyled links get the light green tint
    // (palette.primary.tint, the same as the selected row). Solid contained buttons keep MUI's
    // darker solid hover (primary.dark) so white text stays legible; the tint is never behind it.
    MuiButton: {
      styleOverrides: {
        root: ({ ownerState, theme }) =>
          ownerState.variant === 'contained'
            ? {}
            : {
                '&:hover': { backgroundColor: theme.palette.primary.tint },
                // Limit buttons stay hoverable (they keep focus) but must not look interactive.
                '&.Mui-disabled:hover': { backgroundColor: 'transparent' },
              },
        sizeSmall: font(13, 500, 22 / 13, 0.46),
        sizeMedium: font(14, 500, 24 / 14, 0.4),
        sizeLarge: font(15, 500, 26 / 15, 0.46),
      },
    },
    // Visible keyboard focus for every ButtonBase (buttons, icon buttons) and links.
    MuiButtonBase: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&.Mui-focusVisible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }),
      },
    },
    // Tabs sit in a scroller that clips overflow, so their ring is drawn inside the tab.
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&.Mui-focusVisible, &:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&:hover': { backgroundColor: theme.palette.primary.tint },
          '&.Mui-disabled:hover': { backgroundColor: 'transparent' },
        }),
      },
    },
    // Selected rows keep the tint on hover (a darker wash would drop the text below AA).
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&:hover, &.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: theme.palette.primary.tint,
          },
        }),
      },
    },
    // Menu options (Select, LocationFilter, pagination rows-per-page, month select, user switcher):
    // hover, keyboard focus and selected are the light green tint, never MUI's grey or dark-green
    // wash. Selected stays distinct from hover with bold text and a primary bar on the left edge.
    MuiMenuItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&:hover, &.Mui-focusVisible, &.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focusVisible':
            { backgroundColor: theme.palette.primary.tint },
          '&.Mui-selected': {
            fontWeight: theme.typography.fontWeightBold,
            boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
          },
          '&.Mui-focusVisible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
        }),
      },
    },
    // Page items follow the same rule as list rows: hover and selected are the light green tint
    // (MUI's default selected wash is a darker alpha of the primary).
    MuiPaginationItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&:hover, &.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focusVisible': {
            backgroundColor: theme.palette.primary.tint,
          },
        }),
      },
    },
    MuiLink: {
      styleOverrides: {
        root: ({ ownerState, theme }) => ({
          // Links without an underline (the header logo) are button-like: tint on hover.
          ...(ownerState.underline === 'none' && {
            borderRadius: theme.shape.borderRadius,
            '&:hover': { backgroundColor: theme.palette.primary.tint },
          }),
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }),
      },
    },
    MuiInputBase: {
      styleOverrides: { input: font(16, 400, 1.5, 0.15) },
    },
    // Input label: Figma shows 12px when shrunk. MUI scales the 16px root by 0.75
    // (= 12px), so the label keeps its default size and needs no override.
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          h4_fixed: 'h4',
          menu_item: 'span',
          list_link: 'span',
          menu_heading: 'h2',
          button_small: 'span',
        },
      },
    },
  },
});

// Figma enabledBorder (#0000003b) is the MUI default outlined border, derived from the palette.
export const theme = createTheme(base, {
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: alpha(base.palette.text.primary, 0.23) },
      },
    },
  },
});
