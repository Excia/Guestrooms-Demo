import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type { ReservationListRow } from '../../api';
import { checkInLabel, roomsToCheckIn } from '../../app/bulkCheckIn';

export interface BulkCheckInButtonProps {
  /** The selected rows. */
  rows: readonly ReservationListRow[];
  running: boolean;
  onCheckIn: () => void;
}

/** Space the list keeps below its last row while the bar floats, so the bar never covers it. */
export const FLOATING_BAR_CLEARANCE = 12;

/**
 * "CHECK IN N ROOMS" (Figma 2524:36149) as a floating bar: centred near the bottom of the viewport
 * while rooms can be checked in, gone otherwise. It sits above the table and below dialogs (the
 * speed-dial layer is under the modal layer). Selection is announced by the page's status region.
 */
export default function BulkCheckInButton({ rows, running, onCheckIn }: BulkCheckInButtonProps) {
  const count = roomsToCheckIn(rows).length;
  if (count === 0) return null;
  return (
    <Box
      data-testid="bulk-check-in-bar"
      sx={(t) => ({
        position: 'fixed',
        insetInline: 0,
        bottom: t.spacing(3),
        display: 'flex',
        justifyContent: 'center',
        zIndex: t.zIndex.speedDial,
        // Only the button takes clicks; the empty sides stay clickable through the bar.
        pointerEvents: 'none',
      })}
    >
      <Button
        variant="contained"
        color="primary"
        size="large"
        disabled={running}
        onClick={onCheckIn}
        sx={(t) => ({ width: t.spacing(40), pointerEvents: 'auto', boxShadow: t.shadows[8] })}
      >
        {checkInLabel(count)}
      </Button>
    </Box>
  );
}
