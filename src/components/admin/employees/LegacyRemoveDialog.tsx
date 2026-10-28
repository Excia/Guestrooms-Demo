import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId } from 'react';
import { focusOnMount } from '../../shared/focusOnMount';

export interface LegacyRemoveDialogProps {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  /** Question to show; defaults to the Employee wording. */
  message?: string;
  /** Called once the close transition has finished (e.g. to place focus). */
  onExited?: () => void;
}

// The legacy confirmation (ConfirmDialog): title "Confirm", "Are you sure you want to remove this
// Employee?", Cancel and OK. Cancel takes focus so Enter never removes.
export default function LegacyRemoveDialog({
  open,
  busy,
  error,
  onCancel,
  onConfirm,
  message = 'Are you sure you want to remove this Employee?',
  onExited,
}: LegacyRemoveDialogProps) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      slotProps={{ transition: { onExited } }}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>Confirm</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
          {error ?? message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button ref={focusOnMount} variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" disabled={busy} onClick={onConfirm}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
