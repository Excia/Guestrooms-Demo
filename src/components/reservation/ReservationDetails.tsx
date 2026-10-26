import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Badge from '@mui/icons-material/Badge';
import Close from '@mui/icons-material/Close';
import Edit from '@mui/icons-material/Edit';
import EventAvailable from '@mui/icons-material/EventAvailable';
import EventBusy from '@mui/icons-material/EventBusy';
import SwapHoriz from '@mui/icons-material/SwapHoriz';
import Undo from '@mui/icons-material/Undo';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApi, type ReservationDetail, type ReservationRoomDetail } from '../../api';
import { changeRoomAvailability } from '../../app/changeRoom';
import { type EarlyLateValues } from '../../app/earlyLate';
import { checkInLevel, RESERVATION_EDIT_PERMISSION } from '../../app/permissions';
import { RESERVATION_PANEL_SIDE, toastSideFor } from '../../app/layout';
import { OVERRIDE_TITLE, splitConfirmation } from '../../app/checkInCopy';
import { roomParty } from '../../app/roomGuests';
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
import { openCardErrorMessage, openCardInNewTab } from '../../app/openCardPreview';
import { registrationCardReservation } from '../../app/registrationCard';
import { folioPath, NIGHT_AUDIT_HISTORY_PATH } from '../../app/routes';
import {
  cancelConfirmation,
  canUndoRoomCheckIn,
  reservationMenu,
  type MenuActionId,
} from '../../app/reservationMenu';
import { splitCta, STUB_TICKETS, type CtaActionId } from '../../app/splitCta';
import { useAccess } from '../../app/useAccess';
import { useSystemSettings } from '../../app/useSystemSettings';
import { clubClock } from '../../lib/clubTime';
import { todayIso, type IsoDate } from '../../lib/dates';
import CheckInResultDialog from '../reservationList/CheckInResultDialog';
import ConfirmDialog from '../shared/ConfirmDialog';
import SaveToast from '../shared/SaveToast';
import { focusOnMount } from '../shared/focusOnMount';
import SplitButton from '../shared/SplitButton';
import ChangeRoomDialog, { type RoomChangeSubmission } from './ChangeRoomDialog';
import CheckInPanel from './CheckInPanel';
import { AutoCheckOutDialog, PastDateCheckInDialog } from './CheckInDialogs';
import { OverridePinDialog } from '../shared/OverridePinDialog';
import PaymentMethodsDialog from './PaymentMethodsDialog';
import { useCheckInFlow } from './useCheckInFlow';
import DetailsAccordion from './DetailsAccordion';
import EarlyLateToggles from './EarlyLateToggles';
import { useEarlyLate } from './useEarlyLate';
import { useReservationMenuActions } from './useReservationMenuActions';
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
  /** Local calendar date treated as "today" (the first night a room change may move). */
  today?: IsoDate;
  /** A confirmed room change; the schedule page applies and sends it (ticket 2.3). Absent hides the action. */
  onChangeRoom?: (submission: RoomChangeSubmission) => void;
  /** A room change is being saved: the action is unavailable until it settles. */
  roomChangeBusy?: boolean;
  /** Raised after a room change settles: the detail reloads in place. */
  refreshToken?: number;
  /** Reopens the Change Room dialog on its first step (the data drifted); a new `nonce` each time. */
  reopenChange?: { stayId: string; edits: Record<string, string>; nonce: number } | null;
  /** The reservation was cancelled or a check in undone: the schedule behind the panel reloads. */
  onReservationChanged?: () => void;
  /** Opens another reservation in the panel (the one a room was split into). */
  onOpenReservation?: (reservationId: string) => void;
  /** Add Another Room: the page opens that panel for this reservation (ticket 151). */
  onAddRoom?: (reservationId: string) => void;
  /** The current instant, for the club clock's time of day (check-out time rule). Injectable for tests. */
  now?: () => number;
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
  lastAuditedDate,
  canEdit,
  busy,
  onUndo,
  onCheckIn,
}: {
  rooms: ReservationRoomDetail[];
  index: number;
  onIndex: (i: number) => void;
  onStub: (m: string) => void;
  lastAuditedDate: ReservationDetail['lastAuditedDate'];
  canEdit: boolean;
  busy: boolean;
  /** Undo the check in of this reservation room. */
  onUndo: (reservationRoomId: string) => void;
  /** Check in this one room (ticket 163). */
  onCheckIn: (reservationRoomId: string) => void;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  const room = rooms[index];
  const next = rooms[stepRoomIndex(index, 1, rooms.length)];
  const solid = room.status === 'checked-in';
  const out = room.status === 'checked-out';
  const unassigned = room.roomNumber === null && room.status === 'nyci';
  // "Remove after NA run": once the night audit has run for the check-in date, Undo Check In gives
  // way to Check Out Room (Figma "CheckedIn-NArun").
  const undoable = canUndoRoomCheckIn(rooms, room, lastAuditedDate);
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
            borderColor: unassigned ? 'error.main' : 'primary.main',
            ...(out && { bgcolor: 'grey.300', color: 'text.primary', borderColor: 'grey.300' }),
            ...(!solid && !out && { bgcolor: 'background.paper' }),
          }}
        >
          <Box>
            <Typography
              variant="subtitle1"
              component="div"
              sx={{
                fontWeight: 700,
                color: unassigned ? 'error.main' : 'inherit',
                textTransform: unassigned ? 'uppercase' : undefined,
                lineHeight: 1.3,
              }}
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
        {room.status === 'checked-out' ? null : undoable ? (
          canEdit ? (
            <Button
              size="small"
              startIcon={<Undo />}
              disabled={busy}
              onClick={() => onUndo(room.id)}
            >
              Undo Check In
            </Button>
          ) : null
        ) : (
          <Button
            size="small"
            onClick={() =>
              room.status === 'checked-in'
                ? onStub(
                    'Checking a single room out arrives with the Reservation Hub (ticket 3.12).',
                  )
                : onCheckIn(room.id)
            }
          >
            {room.status === 'checked-in' ? 'Check Out Room' : 'Check In Room'}
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
  today,
  onChangeRoom,
  roomChangeBusy,
  refreshToken,
  reopenChange,
  onReservationChanged,
  onOpenReservation,
  onAddRoom,
  now,
}: ReservationDetailsProps) {
  const state = useReservationDetail(reservationId, refreshToken);
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
      onPatched={state.patch}
      onEarlyLateSaved={onEarlyLateSaved}
      today={today}
      onChangeRoom={onChangeRoom}
      roomChangeBusy={roomChangeBusy}
      reopenChange={reopenChange}
      onReservationChanged={onReservationChanged}
      onOpenReservation={onOpenReservation}
      onAddRoom={onAddRoom}
      now={now}
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
  onPatched,
  onEarlyLateSaved,
  today,
  onChangeRoom,
  roomChangeBusy,
  reopenChange,
  onReservationChanged,
  onOpenReservation,
  onAddRoom,
  now,
}: {
  detail: ReservationDetail;
  reservationRoomId?: string;
  titleId: string;
  focusTitle?: boolean;
  closeButton: React.ReactNode;
  onReloaded: (d: ReservationDetail) => void;
  /** Fields saved without a reload (Early/Late and the new version) join the loaded detail. */
  onPatched: (changes: Partial<ReservationDetail>) => void;
  onEarlyLateSaved: ReservationDetailsProps['onEarlyLateSaved'];
  today?: IsoDate;
  onChangeRoom?: ReservationDetailsProps['onChangeRoom'];
  roomChangeBusy?: boolean;
  reopenChange?: ReservationDetailsProps['reopenChange'];
  onReservationChanged?: () => void;
  onOpenReservation?: (reservationId: string) => void;
  onAddRoom?: (reservationId: string) => void;
  now?: () => number;
}) {
  const navigate = useNavigate();
  const { can } = useAccess();
  const canEdit = can(RESERVATION_EDIT_PERMISSION);
  const editable = isEditable(detail.status);
  const early = useEarlyLate({
    detail,
    onSaved: (values, version) => {
      onEarlyLateSaved(detail.id, values);
      // Keep the version on screen current, so Cancel and Undo send the revision the user sees.
      if (version) onPatched({ ...values, version });
    },
    onReloaded,
  });
  // The room shown is chosen by its reservation-room id, not its position: after a reload (a room
  // change rebuilds the stay's blocks) the same room stays selected.
  const [selectedRoomId, setSelectedRoomId] = useState(
    () => detail.rooms[initialRoomIndex(detail.rooms, reservationRoomId)].id,
  );
  const roomIndex = Math.max(
    0,
    detail.rooms.findIndex((r) => r.id === selectedRoomId),
  );
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const say = (text: string) => setNotice((n) => ({ id: (n?.id ?? 0) + 1, text }));
  const changeRoomId = useId();
  // The Change Room dialog: closed (null), or open with the choices to start from.
  const [changing, setChanging] = useState<{ edits?: Record<string, string> } | null>(null);
  const [seenReopen, setSeenReopen] = useState(reopenChange?.nonce ?? 0);
  const cta = splitCta(detail);
  const api = useApi();
  const { settings: systemSettings } = useSystemSettings();
  const menu = reservationMenu({
    ...detail,
    canEdit,
    registrationCardEnabled: systemSettings?.registrationCard.enabled,
  });
  const [cancelOpen, setCancelOpen] = useState(false);
  const actions = useReservationMenuActions({
    detail,
    onReloaded,
    onChanged: onReservationChanged,
    say,
  });
  const room = detail.rooms[roomIndex];
  const todayDate = today ?? todayIso();
  const roomChange = changeRoomAvailability({
    room,
    today: todayDate,
    canEdit,
    busy: roomChangeBusy,
  });
  const multi = detail.rooms.length > 1;
  const party = roomParty(detail, room);
  const lead = room.leadOccupant ?? detail.leadOccupant;

  // ---- check in (ticket 163) ----
  const level = checkInLevel(can);
  const clock = {
    ...clubClock(systemSettings?.timeZone, now ? new Date(now()) : undefined),
    date: todayDate,
  };
  const titleRef = useRef<HTMLElement | null>(null);
  // Focus goes back to the reservation heading whenever the check in panel or a dialog it opened is gone.
  const [refocus, setRefocus] = useState(0);
  const flow = useCheckInFlow({
    detail,
    level,
    clock,
    checkOutTime: systemSettings?.checkOutTime ?? '12:00',
    onReloaded,
    onChanged: onReservationChanged,
    onEdit: (kind) => runMenu(kind),
    onOpenReservation,
  });
  const stepName = flow.step?.name ?? null;
  const showsPanel = stepName === 'panel';
  const wasPanel = useRef(false);
  const hadFinalDialog = useRef(false);
  useEffect(() => {
    // The panel closed without a dialog (Back, or a toast follows), or the result / automatic
    // check-out / split dialog was dismissed: back to the heading. A prompt that is cancelled needs nothing:
    // MUI hands focus back to the button that opened it.
    const final = stepName === 'result' || stepName === 'auto-checkout' || stepName === 'split';
    const panelClosed = wasPanel.current && !showsPanel && stepName === null;
    if (panelClosed || (hadFinalDialog.current && stepName === null)) setRefocus((n) => n + 1);
    wasPanel.current = showsPanel;
    hadFinalDialog.current = final;
  }, [stepName, showsPanel]);
  useEffect(() => {
    if (refocus > 0) titleRef.current?.focus();
  }, [refocus]);
  const waitingIds = detail.rooms.filter((r) => r.status === 'nyci').map((r) => r.id);
  const startCheckIn = (ids: string[]) => {
    const decision = flow.start(ids);
    if (decision.kind === 'disabled') say(decision.message);
  };
  const isCheckInCta =
    cta.primary.id === 'check-in' ||
    cta.primary.id === 'check-in-all' ||
    cta.primary.id === 'check-in-remaining';
  const checkInDecision = isCheckInCta ? flow.decide(waitingIds) : null;
  const primaryBlocked =
    checkInDecision?.kind === 'disabled'
      ? checkInDecision.message
      : isCheckInCta
        ? undefined
        : (cta.primary.blockedReason ?? undefined);
  const splitInfo = flow.step?.name === 'split' ? confirmSplit(flow.step.roomId) : null;
  function confirmSplit(roomId: string) {
    return splitConfirmation({
      roomNumber: detail.rooms.find((r) => r.id === roomId)?.roomNumber ?? null,
      confirmationNumber: detail.confirmationNumber,
    });
  }

  // The dialog cannot render (the date or the action is gone after a reload): forget that it was
  // asked for, so it cannot pop open later.
  if (changing && (!roomChange.effectiveDate || !onChangeRoom)) setChanging(null);
  // A change that failed because the data drifted reopens the dialog on step 1 (set state while
  // rendering, the documented pattern for state derived from a prop).
  if (
    reopenChange &&
    reopenChange.nonce !== seenReopen &&
    detail.rooms.some((r) => r.id === reopenChange.stayId)
  ) {
    setSeenReopen(reopenChange.nonce);
    setSelectedRoomId(reopenChange.stayId);
    setChanging({ edits: reopenChange.edits });
  }

  const run = (actionId: CtaActionId) => {
    if (isCheckInCta) return startCheckIn(waitingIds);
    say(STUB_TICKETS[actionId] ?? 'This action arrives in a later ticket.');
  };
  const printRegistrationCard = async () => {
    try {
      await openCardInNewTab(async () => {
        const saved = systemSettings ?? (await api.systemSettings.get());
        return api.registrationCard.requestPreview({
          settings: saved.registrationCard,
          folio: saved.folio,
          reservation: registrationCardReservation(detail, room?.id),
        });
      });
    } catch (error) {
      say(openCardErrorMessage(error).replace('preview', 'registration card'));
    }
  };
  const runMenu = (id: MenuActionId) => {
    switch (id) {
      case 'jump-to-folio':
        void navigate(folioPath(detail.id));
        return;
      case 'print-registration-card':
        // The backend generates the PDF from the saved settings; the UI opens it in a new tab (D-003).
        void printRegistrationCard();
        return;
      case 'cancel-reservation':
        setCancelOpen(true);
        return;
      case 'undo-check-in':
        actions.undoCheckIn();
        return;
      case 'add-room':
        onAddRoom?.(detail.id);
        return;
      case 'edit-reservation':
      case 'assign-room':
        say(
          id === 'assign-room'
            ? 'Assigning a room arrives with the Reservation Hub (ticket 3.12).'
            : 'Editing a reservation arrives with the Reservation Hub (ticket 3.12).',
        );
    }
  };
  const confirmation = cancelConfirmation({
    confirmationNumber: detail.confirmationNumber,
    rooms: detail.rooms.length,
  });

  const step = flow.step;
  const dialogs = (
    <>
      {step?.name === 'past-date' ? (
        <PastDateCheckInDialog
          open
          plan={step.decision}
          level={level}
          onFirst={flow.chooseFirst}
          onContinue={flow.chooseContinue}
          onClose={flow.close}
        />
      ) : null}
      {step?.name === 'override' ? (
        <OverridePinDialog
          open
          title={OVERRIDE_TITLE}
          confirmLabel="Override and check in"
          permission="reservation.check-in.any-time"
          onAuthorized={flow.authorizeOverride}
          onCancel={flow.cancelOverride}
        />
      ) : null}
      {step?.name === 'split' && splitInfo ? (
        <ConfirmDialog
          open
          title={splitInfo.title}
          message={splitInfo.message}
          // The safe choice is the focused primary action; splitting is the explicit secondary one.
          confirmLabel={splitInfo.keepLabel}
          discardLabel={splitInfo.confirmLabel}
          stacked
          onClose={flow.close}
          onConfirm={flow.close}
          onDiscard={() => void flow.splitRoom()}
        />
      ) : null}
      <PaymentMethodsDialog
        open={flow.payment !== null}
        busy={flow.busy}
        error={flow.payment?.error ?? false}
        onAdd={() => void flow.addPaymentMethod()}
        onClose={flow.cancelPayment}
      />
      {step?.name === 'result' ? (
        <CheckInResultDialog open results={step.results} onClose={flow.dismissResult} />
      ) : null}
      {step?.name === 'auto-checkout' ? (
        <AutoCheckOutDialog
          open
          departure={step.departure}
          rooms={step.rooms}
          onRunNightAudit={() => {
            flow.dismissAutoCheckOut();
            void navigate(NIGHT_AUDIT_HISTORY_PATH);
          }}
          onClose={flow.dismissAutoCheckOut}
        />
      ) : null}
      <SaveToast
        open={flow.toastOpen}
        onClose={flow.closeToast}
        message={flow.toast?.message ?? ''}
        saveId={flow.toast?.id}
        severity={flow.toast?.severity}
        side={toastSideFor(RESERVATION_PANEL_SIDE)}
      />
    </>
  );
  if (step?.name === 'panel') {
    return (
      <>
        <CheckInPanel
          titleId={titleId}
          detail={detail}
          plan={step.decision}
          priorDate={step.confirmed}
          timeZone={systemSettings?.timeZone}
          today={todayDate}
          busy={flow.busy}
          onBack={flow.close}
          onSubmit={flow.submit}
          onAssign={() => {
            flow.close();
            runMenu('assign-room');
          }}
        />
        {dialogs}
      </>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ px: 2.5, pt: 2.5, flex: '1 1 auto', overflow: 'auto', minHeight: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <StatusHeader detail={detail} />
            <Typography
              id={titleId}
              ref={(element: HTMLElement | null) => {
                titleRef.current = element;
                if (focusTitle) focusOnMount(element);
              }}
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
              blocked: primaryBlocked,
            }}
            items={menu}
            onPrimary={() => {
              if (primaryBlocked) say(primaryBlocked);
              else run(cta.primary.id);
            }}
            onItem={(id) => runMenu(id as MenuActionId)}
            menuLabel="More reservation actions"
          />
        </Box>
        <Box sx={{ mt: 2.5 }}>
          {multi ? (
            <RoomSelector
              rooms={detail.rooms}
              index={roomIndex}
              onIndex={(i) => setSelectedRoomId(detail.rooms[i].id)}
              onStub={say}
              lastAuditedDate={detail.lastAuditedDate}
              canEdit={canEdit}
              busy={actions.busy}
              onUndo={actions.undoCheckIn}
              onCheckIn={(id) => startCheckIn([id])}
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
        {room.previousStays?.length || room.upcomingStays?.length ? (
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1 }}>
            {[
              ['Earlier in this stay', room.previousStays],
              ['Later in this stay', room.upcomingStays],
            ]
              .filter(([, parts]) => (parts as unknown[] | undefined)?.length)
              .map(([label, parts]) => {
                const list = parts as NonNullable<ReservationRoomDetail['previousStays']>;
                return `${label}: ${list
                  .map(
                    (p) =>
                      `Room ${p.roomNumber ?? ''} (${formatPanelDate(p.arrival)} to ${formatPanelDate(p.departure)})`,
                  )
                  .join(', ')}`;
              })
              .join('. ')}
          </Typography>
        ) : null}
        {onChangeRoom ? (
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              startIcon={<SwapHoriz />}
              aria-disabled={!roomChange.available}
              aria-describedby={roomChange.available ? undefined : `${changeRoomId}-reason`}
              onClick={() =>
                roomChange.available ? setChanging({}) : say(roomChange.reason ?? '')
              }
              // Unavailable: the text stays readable (secondary, not the 0.38 disabled opacity).
              sx={roomChange.available ? undefined : { color: 'text.secondary' }}
            >
              Change Room
            </Button>
            {roomChange.reason ? (
              <Typography
                id={`${changeRoomId}-reason`}
                variant="caption"
                component="p"
                sx={{ color: 'text.secondary', mt: 0.25 }}
              >
                {roomChange.reason}
              </Typography>
            ) : null}
          </Box>
        ) : null}
        {detail.rooms.some((r) => r.roomId === null) ? (
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1 }}>
            Shown in the Unassigned section of the schedule until a room is assigned.
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
            {guestCountText(party.adults, party.children)}
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
              {lead.name}
              {lead.memberNumber ? ` (${lead.memberNumber})` : ''}
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
      <DetailsAccordion
        detail={detail}
        room={room}
        canEdit={canEdit}
        onReloaded={onReloaded}
        onChanged={onReservationChanged}
        onStub={say}
      />
      {dialogs}
      <ConfirmDialog
        open={cancelOpen}
        title={confirmation.title}
        message={confirmation.message}
        // The safe choice is the focused primary action; cancelling is the explicit secondary one.
        confirmLabel={confirmation.keepLabel}
        discardLabel={confirmation.confirmLabel}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => setCancelOpen(false)}
        onDiscard={() => {
          setCancelOpen(false);
          actions.cancel();
        }}
      />
      {changing && roomChange.effectiveDate && onChangeRoom ? (
        <ChangeRoomDialog
          detail={detail}
          room={room}
          effectiveDate={roomChange.effectiveDate}
          today={todayDate}
          initialEdits={changing.edits}
          onCancel={() => setChanging(null)}
          onSubmit={(submission) => {
            setChanging(null);
            onChangeRoom(submission);
          }}
        />
      ) : null}
    </Box>
  );
}
