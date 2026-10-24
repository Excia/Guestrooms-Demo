import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApi } from '../../api';
import type { ScheduleClosure, ScheduleData } from '../../api';
import {
  cleanDescription,
  closureConflict,
  conflictMessage,
  defaultClosureDates,
  validateClosure,
  type ClosureForm,
} from '../../app/closures';
import { RESERVATION_EDIT_PERMISSION } from '../../app/permissions';
import { buildRoomOptions } from '../../app/roomOptions';
import { useAccess } from '../../app/useAccess';
import type { IsoDate } from '../../lib/dates';
import ClosureFields from './ClosureFields';
import { useClosureSubmit } from './useClosureSubmit';

export interface NewClosureTabProps {
  today: IsoDate;
  /** The unfiltered schedule data. Null until loaded. */
  data: ScheduleData | null;
  dataFailed: boolean;
  onRetryData: () => void;
  /** Where the buttons go: the panel's footer (null while the tab is not shown). */
  footerEl: HTMLElement | null;
  /** Start from this room, start day, end day and description (a clicked cell, or a duplicate). */
  prefill?: { roomId?: string; arrival?: IsoDate; end?: IsoDate; description?: string };
  /** Cancel: back to the schedule. */
  onCancel: () => void;
  onSaved: (closure: ScheduleClosure) => void;
  /** The save's answer is unknown: the schedule reloads to show the truth. */
  onUnknownOutcome: () => void;
}

/** The "New Room Closure" tab (functional doc 17): Room, Start, End, Description, Save and Cancel. */
export default function NewClosureTab({
  today,
  data,
  dataFailed,
  onRetryData,
  footerEl,
  prefill,
  onCancel,
  onSaved,
  onUnknownOutcome,
}: NewClosureTabProps) {
  const api = useApi();
  const { can } = useAccess();
  const canEdit = can(RESERVATION_EDIT_PERMISSION);
  const [form, setForm] = useState<ClosureForm>(() => {
    const dates = defaultClosureDates(today, prefill?.arrival);
    return {
      roomId: prefill?.roomId ?? '',
      startDate: dates.startDate,
      endDate: prefill?.end && prefill.end > dates.startDate ? prefill.end : dates.endDate,
      description: prefill?.description ?? '',
    };
  });
  const [submitted, setSubmitted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const { run, saving, failure, clearFailure } = useClosureSubmit();

  const options = useMemo(
    () => (data ? buildRoomOptions(data.rooms, data.locations, data.roomTypes) : []),
    [data],
  );
  const room = data?.rooms.find((r) => r.id === form.roomId);
  const conflict = data ? closureConflict(data, form) : null;
  const conflictText = conflict && room ? conflictMessage(conflict, room.number) : undefined;
  const errors = validateClosure(form);
  const shown = submitted > 0 ? errors : {};
  // A conflict found here, or refused by the server, shows on the Room field until something changes.
  const roomError = conflictText ?? (failure?.onRoom ? failure.message : undefined);

  const change = (next: ClosureForm) => {
    if (failure?.onRoom) clearFailure();
    setForm(next);
  };

  useEffect(() => {
    if (submitted === 0) return;
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [submitted]);

  const submit = () => {
    if (saving || !canEdit) return;
    setSubmitted((n) => n + 1);
    if (Object.keys(errors).length > 0 || conflict) return;
    const body = {
      roomId: form.roomId,
      startDate: form.startDate as IsoDate,
      endDate: form.endDate as IsoDate,
      description: cleanDescription(form.description),
    };
    void run(
      body,
      (requestId) => api.schedule.createClosure({ ...body, requestId }),
      onSaved,
      onUnknownOutcome,
    );
  };
  useEffect(() => {
    if (failure?.onRoom) {
      rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [failure]);

  const footer = (
    <>
      {failure && !failure.onRoom ? (
        <Alert severity="error" role="alert" sx={{ mb: 1.5 }}>
          {failure.message}
        </Alert>
      ) : null}
      <Button
        variant="contained"
        fullWidth
        size="large"
        onClick={submit}
        aria-disabled={saving || !canEdit || undefined}
        className={saving || !canEdit ? 'Mui-disabled' : undefined}
        sx={{ '&.Mui-disabled': { pointerEvents: 'auto' } }}
      >
        {saving ? 'Saving…' : 'Save Closure'}
      </Button>
      <Button
        variant="outlined"
        fullWidth
        size="large"
        onClick={onCancel}
        sx={{ mt: 1.5, borderColor: 'primary.outlinedBorder' }}
      >
        Cancel
      </Button>
    </>
  );

  return (
    <Box
      ref={rootRef}
      component="form"
      noValidate
      aria-label="New room closure"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {!canEdit ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          You do not have permission to create closures.
        </Alert>
      ) : null}
      <ClosureFields
        form={form}
        onChange={change}
        today={today}
        errors={shown}
        roomError={roomError}
        rooms={{ options, loading: !data && !dataFailed, failed: dataFailed, onRetry: onRetryData }}
      />
      {footerEl ? createPortal(footer, footerEl) : null}
    </Box>
  );
}
