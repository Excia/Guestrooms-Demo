import type { SxProps, Theme } from '@mui/material/styles';

// The look of the Booking Rules rules matrix (Figma 15957:83580), shared with the Permissions table so
// both read as the same kind of chart: a bordered grid, rows of labels, option selects in the cells,
// a gray cell for what does not apply.
export const cellSx = (t: Theme) => ({
  border: `1px solid ${t.palette.divider}`,
  px: 2,
  py: 1.5,
  verticalAlign: 'middle',
});

/** The table itself: fixed layout, never narrower than 120 spacing units (the wrapper scrolls). */
export const matrixTableSx: SxProps<Theme> = {
  tableLayout: 'fixed',
  minWidth: (t) => t.spacing(120),
  borderCollapse: 'collapse',
};

/** A cell that does not apply ("N/A"): centered on the gray disabled background. */
export const notApplicableSx = (t: Theme) => ({
  ...cellSx(t),
  bgcolor: 'action.disabledBackground',
});
