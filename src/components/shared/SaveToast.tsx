import Close from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar, { type SnackbarCloseReason } from '@mui/material/Snackbar';
import SnackbarContent from '@mui/material/SnackbarContent';

export interface SaveToastProps {
  open: boolean;
  onClose: () => void;
  message?: string;
  /** Shows the UNDO action when given. */
  onUndo?: () => void;
  /** Milliseconds before it dismisses itself; pauses while hovered or focused. */
  autoHideDuration?: number;
}

// Save Confirmation toast (Figma 69:4219). role="status" makes it a polite live region.
export default function SaveToast({
  open,
  onClose,
  message = 'Report Saved',
  onUndo,
  autoHideDuration = 5000,
}: SaveToastProps) {
  const handleClose = (_: unknown, reason?: SnackbarCloseReason) => {
    // A click elsewhere on the page must not dismiss it.
    if (reason === 'clickaway') return;
    onClose();
  };
  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      autoHideDuration={autoHideDuration}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <SnackbarContent
        role="status"
        aria-live="polite"
        message={message}
        action={
          <>
            {onUndo ? (
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  onUndo();
                  onClose();
                }}
              >
                Undo
              </Button>
            ) : null}
            <IconButton size="small" color="inherit" aria-label="Dismiss" onClick={() => onClose()}>
              <Close />
            </IconButton>
          </>
        }
        sx={{
          width: (t) => t.spacing(40),
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          boxShadow: 4,
          '& .MuiSnackbarContent-message': { typography: 'body1', fontWeight: 'fontWeightBold' },
        }}
      />
    </Snackbar>
  );
}
