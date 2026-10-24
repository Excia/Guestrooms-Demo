import Edit from '@mui/icons-material/Edit';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useRef, useState } from 'react';
import { useApi } from '../../api';
import type { ReservationDetail } from '../../api';
import {
  canEditNotes,
  isNotesDirty,
  MAX_NOTES_LENGTH,
  NOTES_SAVED,
  notesFailure,
  notesOf,
  validateNotes,
  type NotesDraft,
} from '../../app/reservationNotes';
import { useIdempotentSave } from './useIdempotentSave';

export interface NotesSectionProps {
  detail: ReservationDetail;
  canEdit: boolean;
  onReloaded: (detail: ReservationDetail) => void;
  onChanged?: () => void;
  say: (text: string) => void;
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {text || 'None'}
      </Typography>
    </Box>
  );
}

/**
 * The Notes accordion of a reservation (ticket 151): public and private notes shown in the details,
 * with Edit, Save and Cancel while the reservation can still change. A failed save keeps what was
 * typed and says why; a stale version reloads the reservation behind it.
 */
export default function NotesSection({
  detail,
  canEdit,
  onReloaded,
  onChanged,
  say,
}: NotesSectionProps) {
  const api = useApi();
  const id = useId();
  const saved = notesOf(detail);
  const editable = canEditNotes(detail.status, canEdit);
  const [draft, setDraft] = useState<NotesDraft | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const save = useIdempotentSave();
  const editButton = useRef<HTMLButtonElement>(null);
  const firstField = useRef<HTMLTextAreaElement>(null);
  const [refocus, setRefocus] = useState(0);

  if (draft && !editable) setDraft(null);
  useEffect(() => {
    if (draft) firstField.current?.focus();
    // Only when the editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft === null]);
  useEffect(() => {
    if (refocus > 0) editButton.current?.focus();
  }, [refocus]);

  if (!draft) {
    return (
      <Box>
        <Note label="Public Notes" text={detail.publicNotes} />
        <Note label="Private Notes" text={detail.privateNotes} />
        {editable ? (
          <Button
            ref={editButton}
            size="small"
            startIcon={<Edit />}
            onClick={() => {
              setDraft(saved);
              setAttempted(false);
              setFailure(null);
            }}
          >
            Edit notes
          </Button>
        ) : null}
      </Box>
    );
  }

  const errors = attempted ? validateNotes(draft) : {};
  const dirty = isNotesDirty(saved, draft);
  const field = (key: keyof NotesDraft, label: string) => {
    const helperId = `${id}-${key}`;
    return (
      <TextField
        key={key}
        label={label}
        multiline
        minRows={3}
        value={draft[key]}
        inputRef={key === 'publicNotes' ? firstField : undefined}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        error={Boolean(errors[key])}
        helperText={errors[key] ?? `${draft[key].length} of ${MAX_NOTES_LENGTH} characters`}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { 'aria-describedby': helperId },
          formHelperText: { id: helperId },
        }}
      />
    );
  };

  const submit = () => {
    if (save.busy) return;
    setAttempted(true);
    setFailure(null);
    const invalid = validateNotes(draft);
    if (Object.keys(invalid).length > 0) return;
    const body = { reservationId: detail.id, version: detail.version, ...draft };
    void save
      .run(JSON.stringify(body), (requestId) =>
        api.reservations.updateNotes({ ...body, requestId }),
      )
      .then((result) => {
        if (!result) return;
        if (result.ok) {
          onReloaded(result.value);
          onChanged?.();
          if (save.isMounted()) {
            setDraft(null);
            setRefocus((n) => n + 1);
          }
          say(NOTES_SAVED);
          return;
        }
        const failed = notesFailure(result.error);
        if (save.isMounted()) setFailure(failed.message);
        if (!failed.refetch) return;
        api.reservations.getDetail(detail.id).then(onReloaded, () => undefined);
      });
  };

  return (
    <Box component="form" noValidate onSubmit={(e) => e.preventDefault()} aria-label="Edit notes">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {field('publicNotes', 'Public Notes')}
        {field('privateNotes', 'Private Notes')}
      </Box>
      {failure ? (
        <Alert severity="error" role="alert" sx={{ mt: 2 }}>
          {failure}
        </Alert>
      ) : null}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          variant="outlined"
          fullWidth
          sx={{ borderColor: 'primary.outlinedBorder' }}
          onClick={() => {
            setDraft(null);
            setFailure(null);
            setRefocus((n) => n + 1);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          fullWidth
          onClick={dirty ? submit : undefined}
          aria-disabled={!dirty || save.busy || undefined}
          className={!dirty || save.busy ? 'Mui-disabled' : undefined}
          sx={{ '&.Mui-disabled': { pointerEvents: 'auto' } }}
        >
          {save.busy ? 'Saving…' : 'Save Notes'}
        </Button>
      </Box>
    </Box>
  );
}
