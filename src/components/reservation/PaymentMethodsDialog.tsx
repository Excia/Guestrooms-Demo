import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId } from 'react';
import { focusOnMount } from '../shared/focusOnMount';

export interface PaymentMethodsDialogProps {
  open: boolean;
  busy: boolean;
  /** The placeholder card could not be added. */
  error: boolean;
  /** Puts a payment method on file; the check in continues afterwards. */
  onAdd: () => void;
  onClose: () => void;
}

/**
 * PLACEHOLDER hook point for the Payment Methods dialog (ticket 3.9). Check in needs a payment
 * method on file (decision D-008, also for past dates), so the check in flow opens this dialog when
 * none exists and continues once `onAdd` succeeds. Ticket 3.9 replaces the body with the gateway's
 * hosted card fields and keeps this contract: open when there is none, resolve when one is added.
 */
export default function PaymentMethodsDialog({
  open,
  busy,
  error,
  onAdd,
  onClose,
}: PaymentMethodsDialogProps) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      slotProps={{ paper: { sx: { width: (t) => t.spacing(55.5) } } }}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>Add a payment method to check in</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
          A payment method must be on file to check in. Card entry arrives with the Payment Methods
          dialog (ticket 3.9); until then this adds a mock card.
        </DialogContentText>
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            The payment method could not be added. Try again.
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button ref={focusOnMount} variant="contained" onClick={onAdd} disabled={busy}>
          Add mock card
        </Button>
      </DialogActions>
    </Dialog>
  );
}
