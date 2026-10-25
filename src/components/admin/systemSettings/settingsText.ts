import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Text of the System Settings page, applied once on the page's content so every tab shares it: radio,
 * checkbox and switch labels use `settings_body` (paragraphs set `variant="settings_body"` themselves, so
 * this rule never reaches into a field another section adds); the tab labels use `settings_tab`. Input text, floating labels, hints and helper text keep the theme's sizes.
 */
export const settingsTextSx: SxProps<Theme> = (t) => ({
  '& .MuiFormControlLabel-label': t.typography.settings_body,
  '& .MuiTab-root': t.typography.settings_tab,
});
