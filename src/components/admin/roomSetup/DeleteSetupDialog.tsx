import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId, useRef } from 'react';
import type { DeleteCheck } from '../../../app/roomSetup';
import { focusOnMount } from '../../shared/focusOnMount';

export interface DeleteSetupDialogProps {
  /** What deleting would do; null keeps the dialog closed. */
  check: DeleteCheck | null;
  /** "room type" or "room". */
  noun: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onDelete: () => void;
}

// Delete confirmation (PDF 8.9): Delete or Cancel. An item in use is blocked (only Close), one
// with consequences is warned about first. Cancel takes focus so Enter never deletes.
export default function DeleteSetupDialog({
  check,
  noun,
  busy,
  error,
  onCancel,
  onDelete,
}: DeleteSetupDialogProps) {
  const id = useId();
  // Keep the last content while the dialog fades out, so it does not flash empty.
  const last = useRef(check);
  if (check) last.current = check;
  const shown = check ?? last.current;
  const blocked = shown?.kind === 'blocked';
  return (
    <Dialog
      open={check !== null}
      onClose={onCancel}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>
        {blocked ? `Cannot delete this ${noun}` : `Delete this ${noun}?`}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
          {error ?? shown?.message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button ref={focusOnMount} variant="outlined" onClick={onCancel}>
          {blocked ? 'Close' : 'Cancel'}
        </Button>
        {blocked ? null : (
          <Button variant="contained" color="error" disabled={busy} onClick={onDelete}>
            Delete
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
