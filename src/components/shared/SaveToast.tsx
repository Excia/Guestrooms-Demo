import Close from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar, { type SnackbarCloseReason } from '@mui/material/Snackbar';
import SnackbarContent from '@mui/material/SnackbarContent';

// Visually hidden but still read by screen readers.
const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  m: -0.125,
  p: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

export interface SaveToastProps {
  open: boolean;
  onClose: () => void;
  message?: string;
  /** Shows the UNDO action when given. A toast with an action does not auto-hide. */
  onUndo?: () => void;
  /** Milliseconds before a toast without an action dismisses itself; pauses while hovered. */
  autoHideDuration?: number;
  /** Change it for each save: the toast restarts its timer and is announced again. */
  saveId?: string | number;
}

// Save Confirmation toast (Figma 69:4219).
// Screen readers: the live region below is always mounted (a region that appears together with its
// text is often not announced), and its text is replaced on every open, so each save is read out.
// The visible toast carries no live role of its own.
export default function SaveToast({
  open,
  onClose,
  message = 'Report Saved',
  onUndo,
  autoHideDuration = 5000,
  saveId = 0,
}: SaveToastProps) {
  const handleClose = (_: unknown, reason?: SnackbarCloseReason) => {
    // A click elsewhere on the page must not dismiss it.
    if (reason === 'clickaway') return;
    onClose();
  };
  return (
    <>
      <Box role="status" sx={visuallyHidden}>
        {open ? <span key={`${saveId}:${message}`}>{message}</span> : null}
      </Box>
      <Snackbar
        key={`${saveId}:${message}`}
        open={open}
        onClose={handleClose}
        autoHideDuration={onUndo ? null : autoHideDuration}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <SnackbarContent
          role="group"
          aria-label="Notification"
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
              <IconButton
                size="small"
                color="inherit"
                aria-label="Dismiss"
                onClick={() => onClose()}
              >
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
    </>
  );
}
