import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import TextField from '@mui/material/TextField';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  lockoutMessage,
  OVERRIDE_PIN_INVALID,
  OVERRIDE_PIN_LABEL,
  OVERRIDE_PIN_UNAVAILABLE,
} from '../../app/overridePinCopy';
import { useApi, type OverridePermission } from '../../api';
import DialogHeader from './DialogHeader';
import { focusOnMount } from './focusOnMount';

export interface OverridePinDialogProps {
  open: boolean;
  title: string;
  /** Optional line under the title saying what the PIN authorizes. */
  message?: string;
  /** The primary action, e.g. "Override and check in". */
  confirmLabel: string;
  /** The permission the PIN holder must have; the backend decides. */
  permission: OverridePermission;
  /** The caller is already locked out for this many seconds (e.g. the action answered override-locked). */
  lockedForSeconds?: number;
  /** The PIN was accepted. The action that uses it sends it again for the backend to test. */
  onAuthorized: (pin: string) => void;
  onCancel: () => void;
}

type Problem = { kind: 'invalid' } | { kind: 'unavailable' } | { kind: 'locked'; until: number };

const lockFor = (seconds: number | undefined): Problem | null =>
  seconds && seconds > 0 ? { kind: 'locked', until: Date.now() + seconds * 1000 } : null;

/**
 * The window every flow that needs a manager's override opens: asks for the PIN of an employee who
 * holds `permission` and checks it with `overrides.verifyPin`. The PIN is a masked field, is cleared
 * after a wrong answer and is never logged or kept past `onAuthorized`. After too many wrong PINs
 * the backend locks the caller out and this dialog says for how long. Closing the dialog (`open`
 * false or unmounting) cancels a check in flight, so `onAuthorized` never fires after a cancel.
 */
export function OverridePinDialog({
  open,
  title,
  message,
  confirmLabel,
  permission,
  lockedForSeconds,
  onAuthorized,
  onCancel,
}: OverridePinDialogProps) {
  const api = useApi();
  const id = useId();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(() => lockFor(lockedForSeconds));
  const [now, setNow] = useState(() => Date.now());
  // What a screen reader hears, set once per event (the visible countdown stays silent).
  const [announcement, setAnnouncement] = useState(() =>
    lockedForSeconds ? lockoutMessage(lockedForSeconds) : '',
  );
  const input = useRef<HTMLInputElement>(null);
  const check = useRef<AbortController | null>(null);
  const abortCheck = () => {
    check.current?.abort();
    check.current = null;
  };
  useEffect(() => {
    if (!open) abortCheck();
  }, [open]);
  useEffect(() => abortCheck, []);

  const lockedUntil = problem?.kind === 'locked' ? problem.until : 0;
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= lockedUntil) {
        // The lock ended: stop counting and take the message away.
        setProblem(null);
        setAnnouncement('');
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [lockedUntil]);
  const remaining = lockedUntil ? Math.ceil((lockedUntil - now) / 1000) : 0;
  const locked = remaining > 0;

  const text =
    problem === null
      ? null
      : problem.kind === 'invalid'
        ? OVERRIDE_PIN_INVALID
        : problem.kind === 'unavailable'
          ? OVERRIDE_PIN_UNAVAILABLE
          : locked
            ? lockoutMessage(remaining)
            : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = pin.trim();
    if (!open || value === '' || busy || locked) return;
    const controller = new AbortController();
    check.current = controller;
    setBusy(true);
    setProblem(null);
    setAnnouncement('');
    let authorized = false;
    try {
      const result = await api.overrides.verifyPin(
        { permission, pin: value },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (result.valid) {
        authorized = true;
        setPin('');
        onAuthorized(value);
        return;
      }
      const wait = result.lockedForSeconds;
      if (wait) {
        setNow(Date.now());
        setProblem(lockFor(wait));
        setAnnouncement(lockoutMessage(wait));
      } else {
        setProblem({ kind: 'invalid' });
        setAnnouncement(OVERRIDE_PIN_INVALID);
      }
    } catch {
      if (controller.signal.aborted) return;
      setProblem({ kind: 'unavailable' });
      setAnnouncement(OVERRIDE_PIN_UNAVAILABLE);
    } finally {
      if (check.current === controller) check.current = null;
      if (!authorized && !controller.signal.aborted) {
        setBusy(false);
        // A wrong code is cleared so it is not left on screen, and the field is ready for the next try.
        setPin('');
        input.current?.focus();
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      slotProps={{
        paper: {
          sx: { width: (t) => t.spacing(55.5) },
          component: 'form',
          onSubmit: (e: FormEvent) => void submit(e),
        },
        transition: {
          onExited: () => {
            setPin('');
            setProblem(null);
          },
        },
      }}
      aria-labelledby={`${id}-title`}
    >
      <DialogHeader id={`${id}-title`} title={title} onClose={onCancel} />
      <DialogContent>
        {message ? <DialogContentText>{message}</DialogContentText> : null}
        <TextField
          inputRef={(el: HTMLInputElement | null) => {
            input.current = el;
            focusOnMount(el);
          }}
          label={OVERRIDE_PIN_LABEL}
          type="password"
          autoComplete="off"
          fullWidth
          margin="dense"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          error={text !== null}
          helperText={text ?? ' '}
          slotProps={{ htmlInput: { maxLength: 32, inputMode: 'numeric' } }}
        />
        <Box role="status" aria-live="polite" sx={visuallyHidden}>
          {announcement}
        </Box>
      </DialogContent>
      <DialogActions sx={stackedActionsSx}>
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={busy || locked || pin.trim() === ''}
        >
          {confirmLabel}
        </Button>
        <Button variant="outlined" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Full-width actions stacked under the text, with the same side padding as the title.
const stackedActionsSx = {
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 1,
  px: 3,
  pb: 3,
  '& > :not(style) ~ :not(style)': { ml: 0 },
} as const;
