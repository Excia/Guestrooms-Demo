import Button from '@mui/material/Button';
import type { ReservationListRow } from '../../api';
import { checkInLabel, roomsToCheckIn } from '../../app/bulkCheckIn';

export interface BulkCheckInButtonProps {
  /** The selected rows. */
  rows: readonly ReservationListRow[];
  running: boolean;
  onCheckIn: () => void;
}

/** "CHECK IN N ROOMS" (Figma 2524:36149): counts rooms, and is not shown with nothing to check in. */
export default function BulkCheckInButton({ rows, running, onCheckIn }: BulkCheckInButtonProps) {
  const count = roomsToCheckIn(rows).length;
  if (count === 0) return null;
  return (
    <Button
      variant="contained"
      color="primary"
      size="large"
      disabled={running}
      onClick={onCheckIn}
      sx={(t) => ({ width: t.spacing(40) })}
    >
      {checkInLabel(count)}
    </Button>
  );
}
