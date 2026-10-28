import ContentCopy from '@mui/icons-material/ContentCopy';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { useId, useState } from 'react';

export interface SecretDialogProps {
  open: boolean;
  /** Name of the key, for the title. */
  keyName: string;
  /** The secret, held only while the dialog is open. Null once closed. */
  secret: string | null;
  /** "created" or "rotated", for the title. */
  action: 'created' | 'rotated';
  onClose: () => void;
}

// Shows a new or rotated API key once. The secret is write-once: after Done it is gone from the
// page and the list shows only the masked key. It is held in the parent's state only while this
// dialog is open, never written to storage, a URL or the console.
export default function SecretDialog({
  open,
  keyName,
  secret,
  action,
  onClose,
}: SecretDialogProps) {
  const id = useId();
  const [visible, setVisible] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    if (secret === null) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopyState('copied');
    } catch {
      // Make sure the key can be read and copied by hand.
      setVisible(true);
      setCopyState('failed');
    }
  };

  const close = () => {
    setCopyState('idle');
    setVisible(true);
    onClose();
  };

  return (
    <Dialog
      open={open}
      // Done is the only way out: Escape and a backdrop click are ignored, because this is the
      // only time the key is shown.
      onClose={() => {}}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id={`${id}-title`}>{`API key ${action}: ${keyName}`}</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary', mb: 2 }}>
          Copy this key now. For your security it is shown only once and cannot be viewed again.
        </DialogContentText>
        <TextField
          label="API key"
          value={secret ?? ''}
          fullWidth
          type={visible ? 'text' : 'password'}
          slotProps={{
            input: {
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={visible ? 'Hide API key' : 'Show API key'}
                    onClick={() => setVisible((v) => !v)}
                    edge="end"
                  >
                    {visible ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
            htmlInput: { autoComplete: 'off', spellCheck: false },
          }}
        />
        <Button
          startIcon={<ContentCopy />}
          variant="outlined"
          onClick={() => void copy()}
          sx={{ mt: 2 }}
        >
          Copy Key
        </Button>
        <div role="status" aria-live="polite">
          {copyState === 'copied' ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              Key copied to clipboard.
            </Alert>
          ) : null}
          {copyState === 'failed' ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              Could not copy. Select the key and copy it by hand before you close this window.
            </Alert>
          ) : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={close}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
