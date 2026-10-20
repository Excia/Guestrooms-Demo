import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useId, useRef, useState } from 'react';
import { useApi } from '../../api';
import type { Member } from '../../api';
import { emptyGuestForm, validateGuest, type GuestForm } from '../../app/guest';
import { newRequestId } from '../../lib/requestId';

export interface AddGuestDialogProps {
  open: boolean;
  /** Which field the guest is for, e.g. "booking guest": it names the dialog. */
  forLabel: string;
  onClose: () => void;
  /** The guest was added to the directory. */
  onAdded: (member: Member) => void;
}

function AddGuestForm({
  forLabel,
  onClose,
  onAdded,
  titleId,
}: Omit<AddGuestDialogProps, 'open'> & { titleId: string }) {
  const api = useApi();
  const [form, setForm] = useState<GuestForm>(emptyGuestForm);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  // Kept while the form is unchanged, so a retry after an unknown outcome replays.
  const attempt = useRef<{ id: string; body: string } | null>(null);
  const errors = validateGuest(form);
  const shown = attempted ? errors : {};
  const field = (key: keyof GuestForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
    error: Boolean(shown[key]),
    helperText: shown[key],
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    setAttempted(true);
    setFailure(null);
    if (Object.keys(errors).length > 0) {
      // Focus the first field with a problem.
      const first = (['name', 'email', 'phone'] as const).find((k) => errors[k]);
      document.getElementById(`${titleId}-${first}`)?.focus();
      return;
    }
    inFlight.current = true;
    setSaving(true);
    const body = {
      name: form.name.trim(),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.body !== fingerprint) {
      attempt.current = { id: newRequestId(), body: fingerprint };
    }
    api.members.create({ ...body, requestId: attempt.current.id }).then(
      (member) => {
        attempt.current = null;
        onAdded(member);
      },
      () => {
        setFailure('The guest could not be added. Try again.');
        inFlight.current = false;
        setSaving(false);
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <DialogTitle id={titleId}>Add guest</DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, minWidth: { sm: 360 } }}
      >
        <TextField
          label="Name"
          required
          autoFocus
          autoComplete="off"
          id={`${titleId}-name`}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 200 } }}
          {...field('name')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="off"
          id={`${titleId}-email`}
          slotProps={{ inputLabel: { shrink: true } }}
          {...field('email')}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="off"
          id={`${titleId}-phone`}
          slotProps={{ inputLabel: { shrink: true } }}
          {...field('phone')}
        />
        {failure ? <Alert severity="error">{failure}</Alert> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined" sx={{ borderColor: 'primary.outlinedBorder' }}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? 'Adding…' : `Add as ${forLabel}`}
        </Button>
      </DialogActions>
    </form>
  );
}

/**
 * Add guest: a small dialog that adds a person to the directory and hands them back to the field
 * that asked. Escape or Cancel closes it (focus returns to the "+" button); the name is required.
 */
export default function AddGuestDialog({ open, forLabel, onClose, onAdded }: AddGuestDialogProps) {
  const titleId = useId();
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby={titleId} maxWidth="xs" fullWidth>
      {/* Mounted only while open, so every opening starts with an empty form. */}
      <AddGuestForm titleId={titleId} forLabel={forLabel} onClose={onClose} onAdded={onAdded} />
    </Dialog>
  );
}
