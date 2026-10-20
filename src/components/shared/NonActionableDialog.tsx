import Close from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import { useId, type ReactNode } from 'react';
import { focusOnMount } from './focusOnMount';

export interface NonActionableDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel?: string;
}

// Non-Actionable Dialog (Figma 441:13871): information only, dismissed by the close icon or Escape.
export default function NonActionableDialog({
  open,
  onClose,
  title,
  children,
  closeLabel = 'Close',
}: NonActionableDialogProps) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      // Figma paper width is 444px; the default margin keeps it inside narrow viewports.
      slotProps={{
        paper: { sx: { width: (t) => t.spacing(55.5) } },
      }}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
    >
      <DialogActions sx={{ pb: 0 }}>
        <IconButton ref={focusOnMount} color="primary" aria-label={closeLabel} onClick={onClose}>
          <Close />
        </IconButton>
      </DialogActions>
      <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
      <DialogContent id={`${id}-body`}>{children}</DialogContent>
    </Dialog>
  );
}
