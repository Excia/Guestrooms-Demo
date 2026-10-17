import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { alpha, createTheme } from '@mui/material/styles';
import type { CSSProperties } from 'react';

// Tokens from the CE Guest Rooms Figma variables (dashboard frame 69:3712). Light mode only.
declare module '@mui/material/styles' {
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
  }
  interface TypographyVariantsOptions {
    h4_fixed?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    h4_fixed: true;
  }
}

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

export const theme = createTheme({
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
    h4_fixed: font(16, 700, 1.4, 0.15),
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
    MuiInputBase: {
      styleOverrides: { input: font(16, 400, 1.5, 0.15) },
    },
    MuiInputLabel: {
      styleOverrides: { root: font(12, 400, 1, 0.15) },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: '#0000003b' },
      },
    },
  },
});
