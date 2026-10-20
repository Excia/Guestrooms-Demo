import Chip from '@mui/material/Chip';

/** Shown in demo builds (mock client in a non-dev build) so mock data is never mistaken for real. */
export default function DemoDataChip() {
  return (
    <Chip
      label="Demo data"
      size="small"
      variant="outlined"
      sx={{
        position: 'fixed',
        left: (theme) => theme.spacing(2),
        bottom: (theme) => theme.spacing(2),
        // Above page content, below the menu overlay (zIndex 'drawer') so it never floats over it.
        zIndex: 'speedDial',
        bgcolor: 'background.paper',
        pointerEvents: 'none',
      }}
    />
  );
}
