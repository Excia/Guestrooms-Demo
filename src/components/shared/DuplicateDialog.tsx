import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useId, useState, type FormEvent } from 'react';

export interface DuplicateDialogProps {
  open: boolean;
  /** Singular noun in the title and labels, e.g. "rate category". */
  noun: string;
  /** The name offered when the dialog opens. */
  initialName: string;
  /** Why `name` cannot be used, or undefined. Checked on every change. */
  validate: (name: string) => string | undefined;
  maxLength?: number;
  /** The copy is being created. */
  busy?: boolean;
  /** A failure from the request, shown in place of the hint. */
  error?: string | null;
  onCancel: () => void;
  onDuplicate: (name: string) => void;
}

const selectOnMount = (el: HTMLInputElement | null) => {
  el?.focus();
  el?.select();
};

/** "rate category" to "Rate Category". */
const capitalize = (text: string) =>
  text.replace(/(^|\s)(\S)/g, (_, space: string, letter: string) => space + letter.toUpperCase());

// One Duplicate dialog for every setup page (legacy has one per page): asks for the name of the
// copy, refuses an empty or taken one and returns the trimmed name. Enter confirms.
export default function DuplicateDialog({
  open,
  noun,
  initialName,
  validate,
  maxLength,
  busy,
  error,
  onCancel,
  onDuplicate,
}: DuplicateDialogProps) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [wasOpen, setWasOpen] = useState(open);
  // A fresh copy name every time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName(initialName);
  }
  const problem = validate(name);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!problem && !busy) onDuplicate(name.trim());
  };
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      aria-labelledby={`${id}-title`}
      fullWidth
      maxWidth="xs"
    >
      <form onSubmit={submit} noValidate>
        <DialogTitle id={`${id}-title`}>Duplicate {capitalize(noun)}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', mb: 2 }}>
            Enter a name for the {noun} to be duplicated.
          </DialogContentText>
          <TextField
            label={`${capitalize(noun)} Name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(problem ?? error)}
            helperText={
              error ?? problem ?? (maxLength ? `${name.length} / ${maxLength}` : undefined)
            }
            slotProps={{ htmlInput: { maxLength } }}
            inputRef={selectOnMount}
            fullWidth
            required
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={Boolean(problem) || busy}>
            Duplicate
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
