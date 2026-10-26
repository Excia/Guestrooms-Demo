import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId, useState } from 'react';
import { focusOnMount } from '../../shared/focusOnMount';

export interface RemoveEmployeeDialogProps {
  /** The employee to remove; null keeps the dialog closed. */
  target: { name: string; blockedReason: string | null } | null;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onRemove: () => void;
}

// Remove confirmation (legacy: "Are you sure you want to remove this Employee?"). The only active
// administrator is blocked (only Close). Cancel takes focus so Enter never removes.
export default function RemoveEmployeeDialog({
  target,
  busy,
  error,
  onCancel,
  onRemove,
}: RemoveEmployeeDialogProps) {
  const id = useId();
  // Keep the last content while the dialog fades out, so it does not flash empty.
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);
  const blocked = shown?.blockedReason != null;
  return (
    <Dialog
      open={target !== null}
      onClose={onCancel}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>
        {blocked ? 'Cannot remove this employee' : 'Remove this employee?'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
          {error ??
            (blocked
              ? shown?.blockedReason
              : `${shown?.name ?? 'This employee'} will no longer have access to Guest Rooms. They stay in the club directory and can be added again.`)}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button ref={focusOnMount} variant="outlined" onClick={onCancel}>
          {blocked ? 'Close' : 'Cancel'}
        </Button>
        {blocked ? null : (
          <Button variant="contained" color="error" disabled={busy} onClick={onRemove}>
            Remove
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
