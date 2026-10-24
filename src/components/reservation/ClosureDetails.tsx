import Close from '@mui/icons-material/Close';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Delete from '@mui/icons-material/Delete';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { useApi } from '../../api';
import type { ScheduleClosure, ScheduleData } from '../../api';
import {
  cleanDescription,
  closureConflict,
  conflictMessage,
  validateClosure,
  type ClosureForm,
} from '../../app/closures';
import { RESERVATION_EDIT_PERMISSION } from '../../app/permissions';
import { useAccess } from '../../app/useAccess';
import type { IsoDate } from '../../lib/dates';
import ClosureFields from './ClosureFields';
import { useClosureSubmit } from './useClosureSubmit';

export interface ClosureDetailsProps {
  titleId: string;
  closureId: string;
  today: IsoDate;
  /** The unfiltered schedule data the closure is looked up in. Null until loaded. */
  data: ScheduleData | null;
  dataFailed: boolean;
  onRetryData: () => void;
  onClose: () => void;
  /** Saved or removed: the page reloads the schedule, tells the user and closes the panel. */
  onSaved: (closure: ScheduleClosure) => void;
  onRemoved: (closure: ScheduleClosure, roomNumber: string) => void;
  onUnknownOutcome: () => void;
  /** Open the New Room Closure tab filled with this closure. */
  onDuplicate: (closure: ScheduleClosure) => void;
}

/** The closure's name in the title and the confirmation: "Room 208 Closure". */
export const closureTitle = (roomNumber: string) => `Room ${roomNumber} Closure`;

/** The Closure details panel (functional doc 18): edit dates and description, remove, duplicate. */
export default function ClosureDetails(props: ClosureDetailsProps) {
  const { titleId, closureId, data, dataFailed, onRetryData, onClose } = props;
  const closure = data?.closures.find((c) => c.id === closureId);
  // The last good copy: while the schedule reloads or fails to reload (after an unknown outcome),
  // the form stays, with the user's edits.
  const [last, setLast] = useState<{
    id: string;
    closure: ScheduleClosure;
    data: ScheduleData;
  } | null>(null);
  if (data && closure && (last?.closure !== closure || last.data !== data)) {
    setLast({ id: closureId, closure, data });
  }
  const kept = !data && last?.id === closureId ? last : null;
  const header = (title: string) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography
        id={titleId}
        variant="h6"
        component="h2"
        tabIndex={-1}
        ref={focusHeading}
        sx={{ flex: 1, minWidth: 0 }}
      >
        {title}
      </Typography>
      <IconButton
        aria-label="Close closure details"
        color="primary"
        onClick={onClose}
        sx={{ mr: -1 }}
      >
        <Close fontSize="large" />
      </IconButton>
    </Box>
  );
  if (!kept && (!data || !closure)) {
    return (
      <Box sx={{ p: 2.5 }}>
        {header('Closure')}
        {dataFailed ? (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              <Button color="inherit" size="small" onClick={onRetryData}>
                Retry
              </Button>
            }
          >
            The closure could not be loaded.
          </Alert>
        ) : !data ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress aria-label="Loading closure" />
          </Box>
        ) : (
          <Alert severity="info" sx={{ mt: 2 }}>
            This closure was removed or is outside the dates on the schedule.
          </Alert>
        )}
      </Box>
    );
  }
  const shown = kept ?? { closure: closure!, data: data! };
  return (
    <Editor
      {...props}
      closure={shown.closure}
      data={shown.data}
      header={header}
      stale={kept ? { failed: dataFailed, onRetry: onRetryData } : null}
    />
  );
}

function focusHeading(element: HTMLElement | null) {
  element?.focus({ preventScroll: true });
}

function Editor({
  closure,
  data,
  today,
  onClose,
  onSaved,
  onRemoved,
  onUnknownOutcome,
  onDuplicate,
  header,
  stale,
}: ClosureDetailsProps & {
  closure: ScheduleClosure;
  data: ScheduleData;
  /** The schedule behind this copy is reloading or failed to reload. */
  stale: { failed: boolean; onRetry: () => void } | null;
  header: (title: string) => React.ReactNode;
}) {
  const api = useApi();
  const { can } = useAccess();
  const canEdit = can(RESERVATION_EDIT_PERMISSION);
  const room = data.rooms.find((r) => r.id === closure.roomId);
  const roomNumber = room?.number ?? '';
  const [form, setForm] = useState<ClosureForm>({
    roomId: closure.roomId,
    startDate: closure.startDate,
    endDate: closure.endDate,
    description: closure.reason,
  });
  const [submitted, setSubmitted] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const save = useClosureSubmit();
  const remove = useClosureSubmit();

  const conflict = closureConflict(data, form, closure.id);
  const conflictText = conflict ? conflictMessage(conflict, roomNumber) : undefined;
  const errors = validateClosure(form);
  const shown = submitted > 0 ? errors : {};
  const busy = save.saving || remove.saving;

  useEffect(() => {
    if (submitted === 0) return;
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [submitted]);
  useEffect(() => {
    if (save.failure?.onRoom) {
      rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [save.failure]);

  // The room is fixed here, so a conflict is shown on the dates it comes from.
  const dateError = conflictText ?? (save.failure?.onRoom ? save.failure.message : undefined);
  const fieldErrors = {
    ...shown,
    ...(dateError && !shown.startDate ? { startDate: dateError } : {}),
  };
  const change = (next: ClosureForm) => {
    if (save.failure) save.clearFailure();
    setForm(next);
  };

  const submit = () => {
    if (busy || !canEdit) return;
    setSubmitted((n) => n + 1);
    if (Object.keys(errors).length > 0 || conflict) return;
    const body = {
      closureId: closure.id,
      roomId: closure.roomId,
      startDate: form.startDate as IsoDate,
      endDate: form.endDate as IsoDate,
      description: cleanDescription(form.description),
    };
    void save.run(
      body,
      (requestId) => api.schedule.updateClosure({ ...body, requestId }),
      onSaved,
      onUnknownOutcome,
    );
  };
  const confirmRemove = () => {
    void remove.run(
      { closureId: closure.id },
      (requestId) => api.schedule.deleteClosure({ closureId: closure.id, requestId }),
      () => onRemoved(closure, roomNumber),
      onUnknownOutcome,
    );
  };
  const title = closureTitle(roomNumber);
  const disabledProps = (off: boolean, sx: object = {}) =>
    ({
      'aria-disabled': off || undefined,
      className: off ? 'Mui-disabled' : undefined,
      sx: { ...sx, '&.Mui-disabled': { pointerEvents: 'auto' } },
    }) as const;

  return (
    <Box
      ref={rootRef}
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <Box sx={{ px: 2.5, pt: 2.5, flex: '1 1 auto', overflow: 'auto', minHeight: 0 }}>
        {header(title)}
        {stale?.failed ? (
          <Alert
            severity="warning"
            sx={{ mt: 2 }}
            action={
              <Button color="inherit" size="small" onClick={stale.onRetry}>
                Retry
              </Button>
            }
          >
            The schedule could not be reloaded. Your changes are kept.
          </Alert>
        ) : null}
        {!canEdit ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            You do not have permission to change closures.
          </Alert>
        ) : null}
        <Box
          component="form"
          noValidate
          aria-label={title}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          sx={{ mt: 2 }}
        >
          <ClosureFields
            form={form}
            onChange={change}
            today={today}
            errors={fieldErrors}
            disabled={!canEdit}
          />
        </Box>
      </Box>
      <Box sx={{ bgcolor: 'primary.tint', px: 3.75, py: 2, flex: 'none' }}>
        {save.failure && !save.failure.onRoom ? (
          <Alert severity="error" role="alert" sx={{ mb: 1.5 }}>
            {save.failure.message}
          </Alert>
        ) : null}
        {remove.failure ? (
          <Alert severity="error" role="alert" sx={{ mb: 1.5 }}>
            The closure could not be removed. {remove.failure.message}
          </Alert>
        ) : null}
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={submit}
          {...disabledProps(busy || !canEdit)}
        >
          {save.saving ? 'Saving…' : 'Save'}
        </Button>
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5 }}>
          <Button
            variant="outlined"
            color="error"
            fullWidth
            startIcon={<Delete />}
            onClick={() => canEdit && !busy && setConfirming(true)}
            {...disabledProps(busy || !canEdit)}
          >
            Remove closure
          </Button>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<ContentCopy />}
            onClick={() => canEdit && !busy && onDuplicate(closure)}
            {...disabledProps(busy || !canEdit, { borderColor: 'primary.outlinedBorder' })}
          >
            Duplicate
          </Button>
        </Box>
        <Button fullWidth onClick={onClose} sx={{ mt: 1.5 }}>
          Back to schedule
        </Button>
      </Box>

      <Dialog
        open={confirming}
        role="alertdialog"
        onClose={() => !remove.saving && setConfirming(false)}
        aria-labelledby={`${closure.id}-remove`}
        aria-describedby={`${closure.id}-remove-text`}
      >
        <DialogTitle id={`${closure.id}-remove`}>Remove closure</DialogTitle>
        <DialogContent>
          <DialogContentText id={`${closure.id}-remove-text`} sx={{ color: 'text.primary' }}>
            Are you sure you want to remove {title}? The room will be open again on those dates.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            ref={focusDialogButton}
            variant="outlined"
            onClick={() => setConfirming(false)}
            disabled={remove.saving}
            sx={{ borderColor: 'primary.outlinedBorder' }}
          >
            No
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirming(false);
              confirmRemove();
            }}
          >
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// "No" takes focus: the safe choice for a destructive question.
function focusDialogButton(element: HTMLElement | null) {
  element?.focus();
}
