import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import { useCallback, useId, useRef, useState } from 'react';
import type { ReservationDetail, ScheduleClosure, ScheduleData, ScheduleHold } from '../../api';
import { RESERVATION_PANEL_SIDE, type PanelSide } from '../../app/layout';
import type { EarlyLateValues } from '../../app/earlyLate';
import type { PanelState } from '../../app/panelUrl';
import type { IsoDate } from '../../lib/dates';
import type { RoomChangeSubmission } from './ChangeRoomDialog';
import ClosureDetails from './ClosureDetails';
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
  /** A confirmed room change during the stay (ticket 2.3); the page applies it. */
  onChangeRoom?: (submission: RoomChangeSubmission) => void;
  /** A room change is being saved. */
  roomChangeBusy?: boolean;
  /** Reopens the Change Room dialog on its first step (the data drifted); `nonce` makes each request new. */
  reopenChange?: { stayId: string; edits: Record<string, string>; nonce: number } | null;
  /** Raised after a room change settles: the open details reload in place. */
  detailRefresh?: number;
  /** The reservation was cancelled or a check in undone (ticket 2.5): the page reloads the schedule. */
  onReservationChanged?: () => void;
  /** A closure was created or changed (ticket 149): the page reloads the schedule and closes the panel. */
  onClosureSaved?: (closure: ScheduleClosure, created: boolean) => void;
  onClosureRemoved?: (closure: ScheduleClosure, roomNumber: string) => void;
  /** Open the New Room Closure tab filled with this closure. */
  onDuplicateClosure?: (closure: ScheduleClosure) => void;
  /** The New Reservation / New Room Closure tab changed; the URL follows. */
  onNewTabChange?: (tab: 'reservation' | 'closure') => void;
  /** Opens another reservation (a room was split into it); the page puts it in the URL. */
  onOpenReservation?: (reservationId: string) => void;
  /** Called when the panel has finished closing (the page puts focus back on what opened it). */
  onExited?: () => void;
  /** The reservation just created: its heading takes focus once loaded (the form that had it is gone). */
  focusTitleFor?: string;
  /** Which edge the panel flies out from; defaults to the one setting in src/app/layout.ts. */
  side?: PanelSide;
  now?: () => number;
  /** The slot the open New Reservation holds (ticket 152), or null; the page shades it on the grid. */
  onHoldChange?: (hold: ScheduleHold | null) => void;
}

/**
 * The reservation side panel (Figma 2623:9046 and 11905:17751): a 400px panel on one side of the
 * schedule (RESERVATION_PANEL_SIDE); full width below 1200px. It is a modal drawer, so focus moves into it, Tab stays inside,
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
  onChangeRoom,
  roomChangeBusy,
  reopenChange,
  detailRefresh,
  onReservationChanged,
  onClosureSaved,
  onClosureRemoved,
  onDuplicateClosure,
  onNewTabChange,
  onOpenReservation,
  onExited,
  focusTitleFor,
  side = RESERVATION_PANEL_SIDE,
  now,
  onHoldChange,
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
      anchor={side}
      open={panel !== null}
      onClose={() => {
        if (!guarded.current) onClose();
      }}
      slotProps={{
        backdrop: { invisible: true },
        transition: { onExited },
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
            focusTitle={focusTitleFor === shown.reservationId}
            onClose={onClose}
            onEarlyLateSaved={onEarlyLateSaved}
            today={today}
            onChangeRoom={onChangeRoom}
            roomChangeBusy={roomChangeBusy}
            reopenChange={reopenChange}
            refreshToken={detailRefresh}
            onReservationChanged={onReservationChanged}
            onOpenReservation={onOpenReservation}
            now={now}
          />
        ) : shown?.kind === 'closure' ? (
          <ClosureDetails
            key={shown.closureId}
            titleId={titleId}
            closureId={shown.closureId}
            today={today}
            data={data}
            dataFailed={dataFailed}
            onRetryData={onRetryData}
            onClose={onClose}
            onSaved={(closure) => onClosureSaved?.(closure, false)}
            onRemoved={(closure, room) => onClosureRemoved?.(closure, room)}
            onUnknownOutcome={onUnknownOutcome}
            onDuplicate={(closure) => onDuplicateClosure?.(closure)}
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
            active={panel !== null}
            prefill={
              shown.roomId || shown.arrival || shown.tab
                ? {
                    roomId: shown.roomId,
                    arrival: shown.arrival,
                    tab: shown.tab,
                    end: shown.end,
                    description: shown.description,
                  }
                : undefined
            }
            onTabChange={onNewTabChange}
            onClosureSaved={(closure) => onClosureSaved?.(closure, true)}
            // A different prefill is a different opening: start the form over.
            key={`${shown.roomId ?? ''}|${shown.arrival ?? ''}`}
            now={now}
            onHoldChange={onHoldChange}
          />
        ) : null}
      </Box>
    </Drawer>
  );
}
