import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Text of the System Settings page, applied once on the page's content so every tab shares it: radio,
 * checkbox and switch labels and plain paragraphs use `settings_body`; the tab labels use
 * `settings_tab`. Input text, floating labels, hints and helper text keep the theme's sizes.
 */
export const settingsTextSx: SxProps<Theme> = (t) => ({
  '& .MuiFormControlLabel-label, & .MuiTypography-body1': t.typography.settings_body,
  '& .MuiTab-root': t.typography.settings_tab,
});
