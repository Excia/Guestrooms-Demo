import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import TextField from '@mui/material/TextField';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import {
  AUTO_CHECK_OUT_TITLE,
  autoCheckOutMessage,
  OVERRIDE_TITLE,
  pastDatePrompt,
} from '../../app/checkInCopy';
import type { CheckInPastDatePlan } from '../../app/checkInDecision';
import type { CheckInLevel } from '../../app/permissions';
import DialogHeader from '../shared/DialogHeader';
import { focusOnMount } from '../shared/focusOnMount';

// Full-width actions stacked under the text, with the same left and right padding as the title and
// message (MUI adds a left margin to every action after the first, so it is reset).
const stackedActionsSx = {
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 1,
  px: 3,
  pb: 3,
  '& > :not(style) ~ :not(style)': { ml: 0 },
} as const;

interface PromptProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
}

// A prompt with stacked choices (legacy "Check In Date has passed"): a close icon, the title, one
// message and full-width actions. MUI's Dialog traps focus, closes on Escape and gives focus back
// to what opened it.
function PromptDialog({
  open,
  title,
  message,
  onClose,
  closeLabel = 'Close',
  children,
}: PromptProps) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: (t) => t.spacing(55.5) } } }}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogHeader id={`${id}-title`} title={title} onClose={onClose} closeLabel={closeLabel} />
      <DialogContent>
        <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={stackedActionsSx}>{children}</DialogActions>
    </Dialog>
  );
}

export interface PastDateCheckInDialogProps {
  open: boolean;
  plan: CheckInPastDatePlan;
  level: CheckInLevel;
  onFirst: () => void;
  onContinue: () => void;
  onClose: () => void;
}

/**
 * "The check-in date has passed" (ticket 163): adjust the reservation dates (or split this room when
 * other rooms are already checked in or out), or check in for the original date. With the "arrival
 * date only" level the second choice reads "Override and check in" and asks for a code next.
 */
export function PastDateCheckInDialog({
  open,
  plan,
  level,
  onFirst,
  onContinue,
  onClose,
}: PastDateCheckInDialogProps) {
  const prompt = pastDatePrompt(plan, level);
  return (
    <PromptDialog open={open} title={prompt.title} message={prompt.message} onClose={onClose}>
      <Button ref={focusOnMount} variant="outlined" fullWidth onClick={onFirst}>
        {prompt.firstLabel}
      </Button>
      <Button variant="outlined" fullWidth onClick={onContinue}>
        {prompt.continueLabel}
      </Button>
    </PromptDialog>
  );
}

export interface AutoCheckOutDialogProps {
  open: boolean;
  departure: string;
  rooms: readonly (string | null)[] | null;
  onRunNightAudit: () => void;
  onClose: () => void;
}

/** Shown after a check in checked the reservation out automatically: the folio may need a night audit. */
export function AutoCheckOutDialog({
  open,
  departure,
  rooms,
  onRunNightAudit,
  onClose,
}: AutoCheckOutDialogProps) {
  return (
    <PromptDialog
      open={open}
      title={AUTO_CHECK_OUT_TITLE}
      message={autoCheckOutMessage(departure, rooms)}
      onClose={onClose}
    >
      <Button ref={focusOnMount} variant="outlined" fullWidth onClick={onRunNightAudit}>
        Run night audit
      </Button>
    </PromptDialog>
  );
}

export interface OverrideCodeDialogProps {
  open: boolean;
  /** The code was checked and refused (or the check failed). */
  error: boolean;
  busy: boolean;
  onSubmit: (code: string) => void;
  onCancel: () => void;
}

/**
 * Asks for the override code that lets a user who may check in only on the arrival date check in
 * for a past date. Validation is mocked for now; ticket 127 builds the real PIN prompt and this
 * dialog becomes (or wraps) it. The code is a password field and is never shown or kept.
 */
export function OverrideCodeDialog({
  open,
  error,
  busy,
  onSubmit,
  onCancel,
}: OverrideCodeDialogProps) {
  const id = useId();
  const [code, setCode] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim() !== '' && !busy) onSubmit(code.trim());
  };
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      slotProps={{
        paper: { sx: { width: (t) => t.spacing(55.5) }, component: 'form', onSubmit: submit },
        transition: { onExited: () => setCode('') },
      }}
      aria-labelledby={`${id}-title`}
    >
      <DialogHeader id={`${id}-title`} title={OVERRIDE_TITLE} onClose={onCancel} />
      <DialogContent>
        <TextField
          inputRef={focusOnMount}
          label="Override code"
          type="password"
          autoComplete="off"
          fullWidth
          margin="dense"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={error}
          helperText={error ? 'That override code is not valid.' : ' '}
          slotProps={{ htmlInput: { maxLength: 32 } }}
        />
      </DialogContent>
      <DialogActions sx={stackedActionsSx}>
        <Button type="submit" variant="contained" fullWidth disabled={busy || code.trim() === ''}>
          Override and check in
        </Button>
        <Button variant="outlined" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
