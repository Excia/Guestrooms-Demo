import Close from '@mui/icons-material/Close';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import type { Ref } from 'react';

export interface DialogHeaderProps {
  /** Id the dialog's aria-labelledby points to. */
  id: string;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  /** Ref to the close button (for dialogs where it takes initial focus). */
  closeRef?: Ref<HTMLButtonElement>;
  closeAutoFocus?: boolean;
}

// One row: the title on the left edge of the dialog's content, the close icon on the right, both
// centred on the same line. Shared by the prompt-style dialogs so their text and actions share
// one left and right padding.
export default function DialogHeader({
  id,
  title,
  onClose,
  closeLabel = 'Close',
  closeRef,
  closeAutoFocus,
}: DialogHeaderProps) {
  return (
    <DialogTitle
      id={id}
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
    >
      <span>{title}</span>
      <IconButton
        ref={closeRef}
        autoFocus={closeAutoFocus}
        color="primary"
        edge="end"
        aria-label={closeLabel}
        onClick={onClose}
      >
        <Close />
      </IconButton>
    </DialogTitle>
  );
}
