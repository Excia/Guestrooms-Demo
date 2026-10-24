import ArrowBack from '@mui/icons-material/ArrowBack';
import Close from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { ReservationDetail, ReservationRoomDetail } from '../../api';
import { checkInFailureText } from '../../app/checkInCopy';
import {
  CHECK_OUT_AFTER_NOTICE,
  checkInCtaLabel,
  PRIOR_DATE_NOTICE,
  type CheckInDecision,
} from '../../app/checkInDecision';
import { formatPanelDate } from '../../app/newReservation';
import { guestCountText, roomNumberText } from '../../app/reservationPanel';
import { daysBetween } from '../../lib/dates';
import { formatClubDateTime } from '../../lib/clubTime';
import { focusOnMount } from '../shared/focusOnMount';

type Startable = Exclude<CheckInDecision, { kind: 'disabled' }>;

export interface CheckInPanelProps {
  /** Labels the panel (the drawer's accessible name). */
  titleId: string;
  detail: ReservationDetail;
  plan: Startable;
  /** The prior-date prompt was accepted: show the notice that asks for the final confirmation. */
  priorDate: boolean;
  timeZone?: string;
  busy: boolean;
  onBack: () => void;
  onSubmit: (reservationRoomIds: string[]) => void;
  /** Opens the assign-room edit panel for this room (it chains back into check in). */
  onAssign: (reservationRoomId: string) => void;
}

const nights = (room: ReservationRoomDetail) => {
  const n = daysBetween(room.arrival, room.departure);
  return `${n} ${n === 1 ? 'night' : 'nights'}`;
};

function UnassignedNotice({ onAssign }: { onAssign: () => void }) {
  return (
    <Alert
      severity="warning"
      sx={{ mt: 1 }}
      action={
        <Button color="inherit" size="small" onClick={onAssign}>
          Assign now
        </Button>
      }
    >
      You must assign this room before check in.
    </Alert>
  );
}

/**
 * The check in step of the reservation panel (legacy "Check in" confirmation, ticket 163): the
 * reservation summary, the rooms to check in (a checkbox each when there are several), the
 * unassigned-room "Assign now" path, the prior-date notice and the CTA. It replaces the details
 * while it is open and labels the dialog, so a screen reader hears "Check in".
 */
export default function CheckInPanel({
  titleId,
  detail,
  plan,
  priorDate,
  timeZone,
  busy,
  onBack,
  onSubmit,
  onAssign,
}: CheckInPanelProps) {
  const multi = detail.rooms.length > 1;
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(plan.checkableIds));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const ids = detail.rooms.filter((r) => selected.has(r.id)).map((r) => r.id);
  const only = detail.rooms[0];
  const targets = new Set([...plan.checkableIds, ...plan.unassignedIds, ...plan.notReadyIds]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ px: 2.5, pt: 2.5, flex: '1 1 auto', overflow: 'auto', minHeight: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              Reservation #{detail.confirmationNumber}
              {multi ? ` (${detail.rooms.length} rooms)` : ''}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Check In: {formatPanelDate(detail.arrival)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Check Out: {formatPanelDate(detail.departure)}
            </Typography>
          </Box>
          <IconButton
            aria-label="Close check in"
            color="primary"
            onClick={onBack}
            sx={{ ml: 'auto', mr: -1, mt: -0.5 }}
          >
            <Close fontSize="large" />
          </IconButton>
        </Box>
        <Button size="small" startIcon={<ArrowBack />} onClick={onBack} sx={{ mt: 1.5 }}>
          Back to details
        </Button>
        <Typography
          id={titleId}
          ref={focusOnMount}
          tabIndex={-1}
          variant="h6"
          component="h2"
          sx={{ fontWeight: 700, mt: 1, outline: 'none', textTransform: 'uppercase' }}
        >
          Check in
        </Typography>
        <Box component="hr" sx={{ border: 0, borderTop: 1, borderColor: 'divider', my: 1.5 }} />

        {!multi ? (
          <Box>
            <Typography variant="body2">
              Before you complete check in, confirm the reservation dates, the guest details and the
              default payment method for the folio.
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1.5 }}>
              <Box
                component="span"
                sx={{
                  color: only.roomId === null ? 'error.main' : undefined,
                  textTransform: only.roomId === null ? 'uppercase' : undefined,
                }}
              >
                {roomNumberText(only)}
              </Box>{' '}
              ({nights(only)})
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {guestCountText(detail.adults, detail.children)}
            </Typography>
            {plan.unassignedIds.includes(only.id) ? (
              <UnassignedNotice onAssign={() => onAssign(only.id)} />
            ) : null}
          </Box>
        ) : (
          <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
            <Typography component="legend" variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Select rooms to check in
            </Typography>
            <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 1.5 }}>
              {detail.rooms.map((room) => {
                const label = `${roomNumberText(room)} (${nights(room)})`;
                const isTarget = targets.has(room.id);
                const unassigned = plan.unassignedIds.includes(room.id);
                const notReady = plan.notReadyIds.includes(room.id);
                const checkable = plan.checkableIds.includes(room.id);
                return (
                  <Box component="li" key={room.id}>
                    {checkable ? (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selected.has(room.id)}
                            onChange={() => toggle(room.id)}
                          />
                        }
                        label={<strong>{label}</strong>}
                      />
                    ) : (
                      <Typography
                        sx={{ fontWeight: 700, color: unassigned ? 'error.main' : undefined }}
                      >
                        {label}
                      </Typography>
                    )}
                    {room.status !== 'nyci' ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {room.status === 'checked-in' ? 'Checked in' : 'Checked out'}
                        {room.checkedInAt
                          ? ` ${formatClubDateTime(room.checkedInAt, timeZone)}`
                          : ''}
                      </Typography>
                    ) : null}
                    {notReady ? (
                      <Typography variant="body2" sx={{ color: 'warning.main' }}>
                        {checkInFailureText('room-not-ready')}
                      </Typography>
                    ) : null}
                    {room.status === 'nyci' && !isTarget ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Not part of this check in.
                      </Typography>
                    ) : null}
                    {unassigned ? <UnassignedNotice onAssign={() => onAssign(room.id)} /> : null}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {priorDate ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {PRIOR_DATE_NOTICE}
          </Alert>
        ) : null}
        {plan.thenCheckOut ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            {CHECK_OUT_AFTER_NOTICE}
          </Alert>
        ) : null}
      </Box>
      <Box sx={{ p: 2.5, flex: 'none' }}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={busy || ids.length === 0}
          onClick={() => onSubmit(ids)}
        >
          {checkInCtaLabel(detail.rooms.length, ids.length)}
        </Button>
      </Box>
    </Box>
  );
}
