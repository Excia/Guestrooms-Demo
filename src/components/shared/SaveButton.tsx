import Check from '@mui/icons-material/Check';
import Box from '@mui/material/Box';
import Button, { type ButtonProps } from '@mui/material/Button';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useId, useRef, useState } from 'react';
import { useReadOnly } from '../../app/readOnlyContext';
import { saveButtonState, type SaveButtonState } from '../../app/saveButtonState';

export interface SaveButtonProps {
  /** The editor has changes that are not saved (a new, unsaved record counts as changed). */
  dirty: boolean;
  /** A save request is in flight. */
  saving?: boolean;
  /** What is saved, e.g. "System Settings". The label is "Save <noun>"; omit it for just "Save". */
  noun?: string;
  onClick: () => void;
  /** Blocks saving even with changes (View-only access, a pending validation). */
  disabled?: boolean;
  /** Why it is blocked; read as the button's description. */
  disabledReason?: string;
  size?: ButtonProps['size'];
}

// The page-level Save button, with the states of the legacy app (SaveOrRemoveButton / the *Edit
// actions): unsaved changes show a filled primary "Save <noun>"; nothing to save shows a white
// "Saved" with a check mark that cannot be pressed. See docs/requirements/entries/save-cta.md.
// The button stays focusable (aria-disabled, not disabled) so the keyboard does not lose its
// place when the label flips to "Saved" after a save.
export default function SaveButton({
  dirty,
  saving = false,
  noun,
  onClick,
  disabled = false,
  disabledReason,
  size = 'large',
}: SaveButtonProps) {
  const readOnly = useReadOnly();
  const state = saveButtonState({ dirty, saving, disabled });
  const reasonId = useId();
  const name = noun ? `Save ${noun}` : 'Save';
  const subject = noun ? `, ${noun}` : '';

  // Announce Saving, then Saved (or Save failed when the changes are still there) on a state
  // change, never on first render; any other change clears a stale message.
  const previous = useRef<SaveButtonState>(state);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    const was = previous.current;
    previous.current = state;
    if (state === 'saving' && was !== 'saving') setAnnouncement('Saving');
    else if (state === 'saved' && was === 'saving') setAnnouncement('Saved');
    else if (was === 'saving') setAnnouncement('Save failed');
    else setAnnouncement('');
  }, [state]);

  const inactive = state !== 'save';
  const reason = state === 'blocked' ? disabledReason : undefined;
  const label = state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : name;
  const accessibleName =
    state === 'saved' ? `Saved${subject}` : state === 'saving' ? `Saving${subject}` : undefined;

  // View-only mode has nothing to save: no button at all (the page says so).
  if (readOnly) return null;
  return (
    <>
      <Button
        variant={state === 'saved' ? 'outlined' : 'contained'}
        size={size}
        startIcon={state === 'saved' ? <Check /> : undefined}
        aria-label={accessibleName}
        aria-disabled={inactive || undefined}
        aria-busy={state === 'saving' || undefined}
        aria-describedby={reason ? reasonId : undefined}
        onClick={inactive ? undefined : onClick}
        disableRipple={inactive}
        sx={(t) => ({
          ...(state === 'saved' && {
            bgcolor: t.palette.background.paper,
            color: t.palette.primary.main,
            '&:hover': { bgcolor: t.palette.background.paper },
          }),
          ...(inactive && { cursor: 'default' }),
          ...(state === 'blocked' && {
            bgcolor: t.palette.action.disabledBackground,
            color: t.palette.action.disabled,
            boxShadow: 'none',
            '&:hover': { bgcolor: t.palette.action.disabledBackground, boxShadow: 'none' },
          }),
        })}
      >
        {label}
      </Button>
      {reason ? (
        <Box component="span" id={reasonId} sx={visuallyHidden}>
          {reason}
        </Box>
      ) : null}
      <Box component="span" role="status" aria-live="polite" sx={visuallyHidden}>
        {announcement}
      </Box>
    </>
  );
}
