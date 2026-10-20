import { alpha, createTheme } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import { menuFontPx } from './app/layout';

// Tokens from the CE Guest Rooms Figma variables (dashboard frame 69:3712). Light mode only.
declare module '@mui/material/styles' {
  // tint and outlinedBorder are set on palette.primary only (the Figma tokens exist for primary).
  interface PaletteColor {
    tint?: string;
    outlinedBorder?: string;
  }
  interface SimplePaletteColorOptions {
    tint?: string;
    outlinedBorder?: string;
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

// Not in Figma variables, intentionally left at MUI defaults: secondary, info, success, divider,
// text.disabled. Figma has one unnamed "Secondary" #545454; add it once its role is confirmed.
const fontFamily = 'Roboto, Helvetica, Arial, sans-serif';
const primaryMain = '#2e7d32';

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
    warning: { main: '#c24e00' },
    error: { main: '#d32f2f' },
    text: { primary: '#000000de', secondary: '#00000099' },
    action: { active: '#0000008f' },
    background: { default: '#f1f1f1', paper: '#ffffff' },
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
            : { '&:hover': { backgroundColor: theme.palette.primary.tint } },
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
        root: ({ theme }) => ({ '&:hover': { backgroundColor: theme.palette.primary.tint } }),
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
