import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import { useId } from 'react';
import type { ScheduleBlock } from '../../api';
import type { DropResult } from '../../app/scheduleDrag';
import { moveDialogCopy } from '../../app/scheduleGrid';
import { focusOnMount } from '../shared/focusOnMount';

type Accepted = Extract<DropResult, { ok: true }>;

export interface MoveConfirmDialogProps {
  block: ScheduleBlock;
  result: Accepted;
  /** Room number the reservation room moves to. */
  toRoomNumber: string;
  onCancel: () => void;
  /** "Move to New Room" / "Move to New Dates": every room of the reservation moves. */
  onConfirm: () => void;
  /** The "split the room from reservation" link: only this room moves. Called only when offered. */
  onSplit: () => void;
}

/**
 * Drag confirmation (Figma 2623:15320 Room Change, 2623:14932 single and 2623:15291 multi-room
 * Date Change). The primary action takes focus, Escape and Cancel leave everything as it was.
 */
export default function MoveConfirmDialog({
  block,
  result,
  toRoomNumber,
  onCancel,
  onConfirm,
  onSplit,
}: MoveConfirmDialogProps) {
  const id = useId();
  const copy = moveDialogCopy(result, block, toRoomNumber);
  return (
    <Dialog
      open
      onClose={onCancel}
      slotProps={{ paper: { sx: { width: (t) => t.spacing(55.5) } } }}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>{copy.title}</DialogTitle>
      <DialogContent>
        {copy.parts ? (
          <DialogContentText id={`${id}-message`} component="div" sx={{ color: 'text.primary' }}>
            <p style={{ margin: 0 }}>
              {copy.parts.before}
              <strong>{copy.parts.emphasis}</strong>
              {copy.parts.after}
            </p>
            {result.splitMoves ? (
              <p style={{ margin: 0, marginTop: '1.5em' }}>
                {'If you only want to change one room on the reservation, you can '}
                <Link
                  component="button"
                  type="button"
                  onClick={onSplit}
                  sx={{ verticalAlign: 'baseline', color: 'text.primary' }}
                >
                  split the room from reservation
                </Link>
                {' to update independently.'}
              </p>
            ) : null}
          </DialogContentText>
        ) : (
          <DialogContentText id={`${id}-message`} sx={{ color: 'text.primary' }}>
            {copy.body}
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          onClick={onCancel}
          sx={{ borderColor: 'primary.outlinedBorder' }}
        >
          Cancel
        </Button>
        <Button ref={focusOnMount} variant="contained" onClick={onConfirm}>
          {copy.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
