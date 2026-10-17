import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId, useRef } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  /** Escape, backdrop click: the user stays where they are. */
  onClose: () => void;
  /** The safe, primary action (Figma "Save now"); it takes initial focus. */
  onConfirm: () => void;
  /** The secondary action (Figma "Leave without saving"). */
  onDiscard: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  discardLabel?: string;
}

// Confirm Leaving (Figma 88:4839). MUI Dialog traps focus, restores it to the opener on close and
// closes on Escape. The primary action takes focus once the open transition ends (a ref, not
// `autoFocus`, which loses to the focus trap under React StrictMode), so Enter saves rather than
// discards. Specific to leaving with unsaved changes; a generic or destructive confirm needs its
// own copy, actions and tone.
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  onDiscard,
  title = 'This report has not been saved.',
  message = 'Are you sure you want to leave without saving?',
  confirmLabel = 'Save now',
  discardLabel = 'Leave without saving',
}: ConfirmDialogProps) {
  const id = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      // Figma paper width is 444px; the default margin keeps it inside narrow viewports.
      slotProps={{
        paper: { sx: { width: (t) => t.spacing(55.5) } },
        transition: { onEntered: () => primaryRef.current?.focus() },
      }}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} color="text.primary">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          onClick={onDiscard}
          sx={{ borderColor: 'primary.outlinedBorder' }}
        >
          {discardLabel}
        </Button>
        <Button ref={primaryRef} variant="contained" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
