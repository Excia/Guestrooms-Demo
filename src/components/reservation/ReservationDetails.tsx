import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Badge from '@mui/icons-material/Badge';
import Close from '@mui/icons-material/Close';
import Edit from '@mui/icons-material/Edit';
import EventAvailable from '@mui/icons-material/EventAvailable';
import EventBusy from '@mui/icons-material/EventBusy';
import Undo from '@mui/icons-material/Undo';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ReservationDetail, ReservationRoomDetail } from '../../api';
import { type EarlyLateValues } from '../../app/earlyLate';
import { RESERVATION_EDIT_PERMISSION } from '../../app/permissions';
import {
  checkInText,
  checkOutText,
  guestCountText,
  initialRoomIndex,
  isEditable,
  reservationTitle,
  roomNumberText,
  roomPlaceText,
  roomStatusText,
  statusLabel,
  stepRoomIndex,
} from '../../app/reservationPanel';
import { formatPanelDate } from '../../app/newReservation';
import { OPEN_FOLIOS_PATH } from '../../app/routes';
import { splitCta, STUB_TICKETS, type CtaActionId } from '../../app/splitCta';
import { useAccess } from '../../app/useAccess';
import { focusOnMount } from '../shared/focusOnMount';
import SplitButton from '../shared/SplitButton';
import DetailsAccordion from './DetailsAccordion';
import EarlyLateToggles from './EarlyLateToggles';
import { useEarlyLate } from './useEarlyLate';
import { useReservationDetail } from './useReservationDetail';

export interface ReservationDetailsProps {
  reservationId: string;
  /** The reservation room whose block was clicked; the room selector starts there. */
  reservationRoomId?: string;
  titleId: string;
  /** Put focus on the heading once loaded (the reservation was just created). */
  focusTitle?: boolean;
  onClose: () => void;
  /** A save was confirmed (or the flags were reloaded): the schedule redraws its edge markers. */
  onEarlyLateSaved: (reservationId: string, values: EarlyLateValues) => void;
}

function Loading() {
  return (
    <Box aria-busy="true" role="status" aria-label="Loading reservation" sx={{ p: 2.5 }}>
      <Skeleton width="60%" />
      <Skeleton width="45%" />
      <Skeleton width="50%" />
      <Skeleton variant="rounded" height={42} sx={{ mt: 2 }} />
    </Box>
  );
}

function StatusHeader({ detail }: { detail: ReservationDetail }) {
  const label = statusLabel(detail.status);
  if (!label) return null;
  const color =
    label.tone === 'error'
      ? 'error.main'
      : label.tone === 'success'
        ? 'primary.dark'
        : label.tone === 'plain'
          ? 'text.secondary'
          : 'text.primary';
  return (
    <Typography
      variant="button"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, color, textTransform: 'uppercase' }}
    >
      {label.tone === 'success' ? <EventAvailable aria-hidden /> : null}
      {label.tone === 'neutral' ? <EventBusy aria-hidden /> : null}
      {label.text}
    </Typography>
  );
}

function RoomCard({ room, onEdit }: { room: ReservationRoomDetail; onEdit: () => void }) {
  const unassigned = room.roomNumber === null;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: (t) => `1px solid ${t.palette.primary.main}`,
        borderRadius: 1,
        pl: 1.5,
        pr: 0.5,
        minHeight: (t) => t.spacing(6),
      }}
    >
      <Typography variant="body2">
        <Box
          component="strong"
          sx={{
            color: unassigned ? 'error.main' : undefined,
            textTransform: unassigned ? 'uppercase' : undefined,
            fontSize: (t) => t.typography.subtitle1.fontSize,
          }}
        >
          {roomNumberText(room)}
        </Box>{' '}
        {roomPlaceText(room)}
      </Typography>
      <IconButton aria-label="Edit room" color="primary" onClick={onEdit}>
        <Edit />
      </IconButton>
    </Box>
  );
}

function RoomSelector({
  rooms,
  index,
  onIndex,
  onStub,
}: {
  rooms: ReservationRoomDetail[];
  index: number;
  onIndex: (i: number) => void;
  onStub: (m: string) => void;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  const room = rooms[index];
  const next = rooms[stepRoomIndex(index, 1, rooms.length)];
  const solid = room.status === 'checked-in';
  const out = room.status === 'checked-out';
  return (
    <Box sx={{ bgcolor: 'background.default', px: 2.5, py: 1.5, mx: -2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          aria-label="Previous room"
          size="small"
          onClick={() => onIndex(stepRoomIndex(index, -1, rooms.length))}
        >
          <ArrowBack fontSize="small" />
        </IconButton>
        <Button
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? `${id}-rooms` : undefined}
          aria-label={`${roomNumberText(room)}, ${roomPlaceText(room)}, ${roomStatusText(room.status)}. Choose a room`}
          onClick={(e) => setAnchor(e.currentTarget)}
          variant={solid ? 'contained' : 'outlined'}
          endIcon={<ArrowDropDown />}
          sx={{
            flex: 1,
            justifyContent: 'space-between',
            textAlign: 'left',
            textTransform: 'none',
            borderColor: 'primary.main',
            ...(out && { bgcolor: 'grey.300', color: 'text.primary', borderColor: 'grey.300' }),
            ...(!solid && !out && { bgcolor: 'background.paper' }),
          }}
        >
          <Box>
            <Typography
              variant="subtitle1"
              component="div"
              sx={{ fontWeight: 700, color: 'inherit', lineHeight: 1.3 }}
            >
              {roomNumberText(room)}
            </Typography>
            <Typography variant="body2" component="div" sx={{ color: 'inherit' }}>
              {roomPlaceText(room)}
            </Typography>
          </Box>
        </Button>
        <Box sx={{ textAlign: 'center' }}>
          <IconButton
            aria-label={`Next room, ${roomNumberText(next)}`}
            color="primary"
            size="small"
            onClick={() => onIndex(stepRoomIndex(index, 1, rooms.length))}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <ArrowForward fontSize="small" />
          </IconButton>
          <Typography variant="caption" component="div" aria-hidden sx={{ color: 'primary.dark' }}>
            Room {stepRoomIndex(index, 1, rooms.length) + 1}
          </Typography>
        </Box>
      </Box>
      {out ? (
        <Typography variant="caption" component="div" sx={{ textAlign: 'right', mt: 0.5 }}>
          Checked Out {formatPanelDate(room.departure)}
        </Typography>
      ) : null}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Button
          size="small"
          startIcon={<Edit />}
          onClick={() => onStub('Editing a room arrives with the Reservation Hub (ticket 3.12).')}
        >
          Edit Room
        </Button>
        {room.status === 'checked-out' ? null : (
          <Button
            size="small"
            startIcon={room.status === 'checked-in' ? <Undo /> : undefined}
            onClick={() =>
              onStub(
                'Checking a single room in or out arrives with the Reservation Hub (ticket 3.12).',
              )
            }
          >
            {room.status === 'checked-in' ? 'Undo Check In' : 'Check In Room'}
          </Button>
        )}
      </Box>
      <Menu
        id={`${id}-rooms`}
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { 'aria-label': 'Rooms of this reservation' } }}
      >
        {rooms.map((r, i) => (
          <MenuItem
            key={r.id}
            selected={i === index}
            onClick={() => {
              setAnchor(null);
              onIndex(i);
            }}
          >
            {roomNumberText(r)} · {roomPlaceText(r)} · {roomStatusText(r.status)}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

/**
 * The details of one reservation (Figma "RDP" frames): status, title and stay dates with the Early
 * Check In / Late Check Out checkboxes, the split CTA, the room (a selector when there are several),
 * guests and the accordion. Check in/out, room edits and payments belong to later tickets: those
 * actions report that in a polite notice instead of failing silently.
 */
export default function ReservationDetails({
  reservationId,
  reservationRoomId,
  titleId,
  focusTitle,
  onClose,
  onEarlyLateSaved,
}: ReservationDetailsProps) {
  const state = useReservationDetail(reservationId);
  const closeButton = (
    <IconButton
      aria-label="Close reservation details"
      color="primary"
      onClick={onClose}
      sx={{ ml: 'auto', mr: -1, mt: -0.5 }}
    >
      <Close fontSize="large" />
    </IconButton>
  );

  if (state.status === 'loading') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', p: 2.5, pb: 0 }}>
          <Typography id={titleId} variant="subtitle2" sx={{ fontWeight: 700 }}>
            Reservation
          </Typography>
          {closeButton}
        </Box>
        <Loading />
      </Box>
    );
  }
  if (state.status === 'error') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', p: 2.5, pb: 0 }}>
          <Typography id={titleId} variant="subtitle2" sx={{ fontWeight: 700 }}>
            Reservation
          </Typography>
          {closeButton}
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Alert
            severity="error"
            action={
              state.notFound ? undefined : (
                <Button color="inherit" size="small" onClick={state.retry}>
                  Retry
                </Button>
              )
            }
          >
            {state.notFound
              ? 'This reservation could not be found. It may have been removed.'
              : 'The reservation could not be loaded.'}
          </Alert>
        </Box>
      </Box>
    );
  }
  return (
    <Loaded
      key={state.detail.id}
      detail={state.detail}
      reservationRoomId={reservationRoomId}
      titleId={titleId}
      focusTitle={focusTitle}
      closeButton={closeButton}
      onReloaded={state.replace}
      onEarlyLateSaved={onEarlyLateSaved}
    />
  );
}

function Loaded({
  detail,
  reservationRoomId,
  titleId,
  focusTitle,
  closeButton,
  onReloaded,
  onEarlyLateSaved,
}: {
  detail: ReservationDetail;
  reservationRoomId?: string;
  titleId: string;
  focusTitle?: boolean;
  closeButton: React.ReactNode;
  onReloaded: (d: ReservationDetail) => void;
  onEarlyLateSaved: ReservationDetailsProps['onEarlyLateSaved'];
}) {
  const navigate = useNavigate();
  const { can } = useAccess();
  const canEdit = can(RESERVATION_EDIT_PERMISSION);
  const editable = isEditable(detail.status);
  const early = useEarlyLate({
    detail,
    onSaved: (values) => onEarlyLateSaved(detail.id, values),
    onReloaded,
  });
  const [roomIndex, setRoomIndex] = useState(() =>
    initialRoomIndex(detail.rooms, reservationRoomId),
  );
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const say = (text: string) => setNotice((n) => ({ id: (n?.id ?? 0) + 1, text }));
  const cta = splitCta(detail);
  const room = detail.rooms[Math.min(roomIndex, detail.rooms.length - 1)];
  const multi = detail.rooms.length > 1;

  const run = (actionId: CtaActionId) => {
    if (actionId === 'jump-to-folio') {
      void navigate(OPEN_FOLIOS_PATH);
      return;
    }
    say(STUB_TICKETS[actionId] ?? 'This action arrives in a later ticket.');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ px: 2.5, pt: 2.5, flex: '1 1 auto', overflow: 'auto', minHeight: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <StatusHeader detail={detail} />
            <Typography
              id={titleId}
              ref={focusTitle ? focusOnMount : undefined}
              tabIndex={-1}
              variant="subtitle2"
              component="h2"
              sx={{ fontWeight: 700, color: 'text.secondary', mt: 0.5, outline: 'none' }}
            >
              {reservationTitle(detail)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {checkInText(detail)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {checkOutText(detail)}
            </Typography>
          </Box>
          {closeButton}
        </Box>
        {!canEdit ? (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            You can view, not change, this reservation.
          </Alert>
        ) : null}
        <EarlyLateToggles
          state={early.state}
          disabled={!canEdit || !editable}
          disabledReason={!editable ? 'This reservation can no longer be changed.' : undefined}
          onToggle={early.toggle}
          onRetry={early.retry}
          onReload={early.reload}
        />
        <Box sx={{ mt: 1.5 }}>
          <SplitButton
            primary={{
              id: cta.primary.id,
              label: cta.primary.label,
              variant: cta.primary.variant,
              blocked: cta.primary.blockedReason ?? undefined,
            }}
            items={cta.menu}
            onPrimary={() => {
              if (cta.primary.blockedReason) say(cta.primary.blockedReason);
              else run(cta.primary.id);
            }}
            onItem={(id) => run(id as CtaActionId)}
            menuLabel="More reservation actions"
          />
        </Box>
        <Box sx={{ mt: 2.5 }}>
          {multi ? (
            <RoomSelector
              rooms={detail.rooms}
              index={roomIndex}
              onIndex={setRoomIndex}
              onStub={say}
            />
          ) : (
            <RoomCard
              room={room}
              onEdit={() =>
                say('Editing a reservation arrives with the Reservation Hub (ticket 3.12).')
              }
            />
          )}
        </Box>
        {detail.rooms.some((r) => r.roomId === null) ? (
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1 }}>
            Not shown on the schedule until a room is assigned.
          </Typography>
        ) : null}
        <Box sx={{ mt: 2.5, pb: 2.5 }}>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ fontWeight: 700, color: 'text.primary' }}
          >
            Guests
          </Typography>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            {guestCountText(detail.adults, detail.children)}
          </Typography>
          <Typography
            variant="caption"
            component="div"
            sx={{ fontWeight: 700, color: 'text.secondary', mt: 1 }}
          >
            Lead Occupant
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge aria-hidden color="primary" fontSize="small" />
            <Typography variant="body1">
              {detail.leadOccupant.name}
              {detail.leadOccupant.memberNumber ? ` (${detail.leadOccupant.memberNumber})` : ''}
            </Typography>
          </Box>
        </Box>
      </Box>
      {/* Above the accordion, outside the scrolling content: a notice never moves the details. The
          status region is the only announcer (the Alert itself has no live role). */}
      <Box role="status" sx={{ flex: 'none', px: 2.5, pb: notice ? 1 : 0 }}>
        {notice ? (
          <Alert
            key={notice.id}
            severity="info"
            role="presentation"
            onClose={() => setNotice(null)}
          >
            {notice.text}
          </Alert>
        ) : null}
      </Box>
      <DetailsAccordion detail={detail} onStub={say} />
    </Box>
  );
}
