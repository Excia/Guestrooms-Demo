import { alpha, createTheme } from '@mui/material/styles';
import type { CSSProperties } from 'react';

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
  }
  interface TypographyVariantsOptions {
    h4_fixed?: CSSProperties;
    menu_item?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    h4_fixed: true;
    menu_item: true;
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
    // Menu overlay links (Figma 1302:18023): 22px Medium.
    menu_item: font(22, 500, 1.2, 0),
    caption: font(12, 400, 1.4, 0.4),
    button: font(14, 500, 24 / 14, 0.4),
  },
  components: {
    MuiButton: {
      styleOverrides: {
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
    MuiLink: {
      styleOverrides: {
        root: ({ theme }) => ({
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
      defaultProps: { variantMapping: { h4_fixed: 'h4', menu_item: 'span' } },
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
