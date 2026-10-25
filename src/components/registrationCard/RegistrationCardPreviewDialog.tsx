import Print from '@mui/icons-material/Print';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { visuallyHidden } from '@mui/utils';
import { useId, useState } from 'react';
import type { RegistrationCardModel } from '../../app/registrationCard';
import { openCardErrorMessage, openCardInNewTab } from '../../app/openCardPreview';
import DialogHeader from '../shared/DialogHeader';
import RegistrationCardSheet from './RegistrationCardSheet';

export interface RegistrationCardPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  /** What the card prints, from `buildRegistrationCard`. */
  card: RegistrationCardModel;
  /** Asks the backend for the card's PDF; Print opens the answer in a new tab (D-003). */
  requestDocument: () => Promise<{ url: string }>;
}

// Registration Card preview: the card in-app as a white page on a light backdrop (owner, 2026-10-25;
// replaces opening a tab for Generate Preview, D-95-7). MUI Dialog traps focus and returns it to the
// button that opened it; Escape and the backdrop close it. The Print button is the only thing that
// opens a tab: it asks the backend for the document.
export default function RegistrationCardPreviewDialog({
  open,
  onClose,
  card,
  requestDocument,
}: RegistrationCardPreviewDialogProps) {
  const titleId = useId();
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const print = async () => {
    if (printing) return;
    setPrinting(true);
    setError(null);
    try {
      await openCardInNewTab(requestDocument);
    } catch (e) {
      setError(openCardErrorMessage(e));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      scroll="paper"
      fullWidth
      maxWidth={false}
      aria-labelledby={titleId}
      slotProps={{
        paper: { sx: { maxWidth: (t) => t.spacing(100), maxHeight: '90vh', m: 2 } },
      }}
    >
      <DialogHeader
        id={titleId}
        title="Registration Card Preview"
        onClose={close}
        closeLabel="Close preview"
      />
      <DialogContent dividers sx={{ bgcolor: 'grey.100', p: { xs: 1.5, sm: 3 } }}>
        <RegistrationCardSheet card={card} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        {error ? (
          <Alert severity="error" role="alert" sx={{ flex: 1, mr: 1 }}>
            {error}
          </Alert>
        ) : null}
        <Box role="status" aria-live="polite" sx={visuallyHidden}>
          {printing ? 'Preparing the document' : ''}
        </Box>
        <Button onClick={close}>Close</Button>
        <Button
          variant="contained"
          startIcon={printing ? <CircularProgress size={16} color="inherit" /> : <Print />}
          onClick={() => void print()}
          // Stays focusable while it works (a disabled button would drop the keyboard's place).
          aria-disabled={printing || undefined}
        >
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
}
