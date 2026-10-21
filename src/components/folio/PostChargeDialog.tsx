import OpenInNew from '@mui/icons-material/OpenInNew';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId } from 'react';
import { NIGHT_AUDIT_HISTORY_PATH } from '../../app/routes';
import { focusOnMount } from '../shared/focusOnMount';

export interface PostChargeDialogProps {
  open: boolean;
  /** The charge's description, in the title. */
  description: string;
  busy: boolean;
  error: string | null;
  onGoBack: () => void;
  onPost: () => void;
}

// Post Item Dialog (Figma 16051:191218). Go Back is the safe action and takes focus.
export default function PostChargeDialog({
  open,
  description,
  busy,
  error,
  onGoBack,
  onPost,
}: PostChargeDialogProps) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onGoBack}
      slotProps={{ paper: { sx: { width: (t) => t.spacing(55.5) } } }}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>Post {description} via Night Audit?</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
          Only this charge will be posted. To post multiple charges, run the full Night Audit
          Wizard.
        </DialogContentText>
        {/* The wizard is built later (epic 4); Night Audit History is where it is reached until then. */}
        <Button
          size="small"
          color="info"
          href={NIGHT_AUDIT_HISTORY_PATH}
          target="_blank"
          rel="noopener"
          startIcon={<OpenInNew />}
          sx={{ mt: 1.5 }}
        >
          Run Night Audit Wizard
        </Button>
        {error ? (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onGoBack} disabled={busy} ref={focusOnMount}>
          Go back
        </Button>
        <Button variant="contained" onClick={onPost} disabled={busy}>
          Post Charge
        </Button>
      </DialogActions>
    </Dialog>
  );
}
