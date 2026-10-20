import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import { useCallback, useId, useRef, useState } from 'react';
import type { ReservationDetail, ScheduleData } from '../../api';
import type { EarlyLateValues } from '../../app/earlyLate';
import type { PanelState } from '../../app/panelUrl';
import type { IsoDate } from '../../lib/dates';
import NewReservationPanel from './NewReservationPanel';
import ReservationDetails from './ReservationDetails';

export interface ReservationPanelProps {
  /** What the URL asks for; null closes the panel. */
  panel: PanelState;
  today: IsoDate;
  /** The unfiltered schedule data (the New Reservation room list ignores the schedule's filters). */
  data: ScheduleData | null;
  dataFailed: boolean;
  onRetryData: () => void;
  /** Escape, a click outside, the close button and "Back to schedule". */
  onClose: () => void;
  onCreated: (detail: ReservationDetail) => void;
  onUnknownOutcome: () => void;
  onEarlyLateSaved: (reservationId: string, values: EarlyLateValues) => void;
  now?: () => number;
}

/**
 * The reservation side panel (Figma 2623:9046 and 11905:17751): a 400px panel on the right of the
 * schedule; full width below 1200px. It is a modal drawer, so focus moves into it, Tab stays inside,
 * Escape and a click outside close it, and focus returns to what opened it (the grid or the New
 * Reservation button). Its state lives in the URL (see panelUrl.ts); this component only shows it.
 */
export default function ReservationPanel({
  panel,
  today,
  data,
  dataFailed,
  onRetryData,
  onClose,
  onCreated,
  onUnknownOutcome,
  onEarlyLateSaved,
  now,
}: ReservationPanelProps) {
  const titleId = useId();
  // The panel keeps showing its last content while the drawer slides out.
  const [last, setLast] = useState<PanelState>(null);
  if (panel && panel !== last && JSON.stringify(panel) !== JSON.stringify(last)) setLast(panel);
  const shown = panel ?? last;
  // A dialog of the panel is open (the hold expired): the panel must not close underneath it.
  const guarded = useRef(false);
  const onGuardChange = useCallback((value: boolean) => {
    guarded.current = value;
  }, []);

  return (
    <Drawer
      anchor="right"
      open={panel !== null}
      onClose={() => {
        if (!guarded.current) onClose();
      }}
      slotProps={{
        backdrop: { invisible: true },
        paper: {
          role: 'dialog',
          'aria-labelledby': titleId,
          sx: (t) => ({
            width: t.spacing(50),
            maxWidth: '100%',
            boxSizing: 'border-box',
            [t.breakpoints.down('lg')]: { width: '100%' },
          }),
        },
      }}
    >
      <Box sx={{ height: '100%', minHeight: 0 }}>
        {shown?.kind === 'details' ? (
          <ReservationDetails
            key={shown.reservationId}
            reservationId={shown.reservationId}
            reservationRoomId={shown.reservationRoomId}
            titleId={titleId}
            onClose={onClose}
            onEarlyLateSaved={onEarlyLateSaved}
          />
        ) : shown?.kind === 'new' ? (
          <NewReservationPanel
            titleId={titleId}
            today={today}
            data={data}
            dataFailed={dataFailed}
            onRetryData={onRetryData}
            onBack={onClose}
            onCreated={onCreated}
            onUnknownOutcome={onUnknownOutcome}
            onGuardChange={onGuardChange}
            now={now}
          />
        ) : null}
      </Box>
    </Drawer>
  );
}
