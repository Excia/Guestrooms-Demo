import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import { useId, type ReactNode } from 'react';
import DialogHeader from './DialogHeader';
import { focusOnMount } from './focusOnMount';

export interface NonActionableDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel?: string;
  /** Called once the close transition has finished (e.g. to place focus). */
  onExited?: () => void;
}

// Non-Actionable Dialog (Figma 441:13871): information only, dismissed by the close icon or Escape.
export default function NonActionableDialog({
  open,
  onClose,
  title,
  children,
  closeLabel = 'Close',
  onExited,
}: NonActionableDialogProps) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      // Figma paper width is 444px; the default margin keeps it inside narrow viewports.
      slotProps={{
        paper: { sx: { width: (t) => t.spacing(55.5) } },
        transition: { onExited },
      }}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
    >
      <DialogHeader
        id={`${id}-title`}
        title={title}
        onClose={onClose}
        closeLabel={closeLabel}
        closeRef={focusOnMount}
      />
      <DialogContent id={`${id}-body`}>{children}</DialogContent>
    </Dialog>
  );
}
