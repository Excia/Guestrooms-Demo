import ArrowBack from '@mui/icons-material/ArrowBack';
import Close from '@mui/icons-material/Close';
import Timer from '@mui/icons-material/Timer';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApi } from '../../api';
import type { ReservationDetail, ScheduleClosure, ScheduleData } from '../../api';
import { ApiError } from '../../api';
import { stayLimits } from '../../app/dateRange';
import { ADMIN_HOLD_AUDIENCE, describeHold, formatHold, holdMinutes } from '../../app/holdTimer';
import {
  createFailure,
  prefilledNewReservation,
  estimateTotal,
  stayNights,
  toCreateRequest,
  validateNewReservation,
  type NewReservationForm,
} from '../../app/newReservation';
import { RESERVATION_EDIT_PERMISSION } from '../../app/permissions';
import { formatMoney } from '../../app/quickStats';
import { MAX_ADVANCE_DAYS, MAX_STAY_NIGHTS } from '../../app/reservationSearch';
import { buildRoomOptions } from '../../app/roomOptions';
import {
  roomChoices,
  selectLocation,
  selectRoom,
  selectRoomType,
  type RoomSelection,
} from '../../app/roomCascade';
import { useAccess } from '../../app/useAccess';
import { addDays, type IsoDate } from '../../lib/dates';
import { newRequestId } from '../../lib/requestId';
import { MAX_NOTES_LENGTH, MAX_PARTY } from '../../api/validation';
import Select from '../shared/Select';
import AddGuestDialog from './AddGuestDialog';
import GuestAutocomplete from './GuestAutocomplete';
import DateField, { type DateFieldRange } from '../shared/DateField';
import { focusOnMount } from '../shared/focusOnMount';
import { DETAILS_SECTIONS } from './DetailsAccordion';
import CountStepper from './CountStepper';
import RoomAutocomplete from './RoomAutocomplete';
import NewClosureTab from './NewClosureTab';
import { useBookingHold } from './useBookingHold';
import { useHoldTimer } from './useHoldTimer';

export interface NewReservationPanelProps {
  titleId: string;
  today: IsoDate;
  /** The unfiltered schedule data: the room list ignores the schedule's filters. Null until loaded. */
  data: ScheduleData | null;
  dataFailed: boolean;
  onRetryData: () => void;
  /** "Back to schedule": the panel closes and the schedule is as it was. */
  onBack: () => void;
  onCreated: (detail: ReservationDetail) => void;
  /** The create answer is unknown (timeout, network, 5xx): the schedule reloads to show the truth. */
  onUnknownOutcome: () => void;
  /** A dialog of the panel is open (the hold expired): Escape and outside clicks must not close the panel. */
  onGuardChange: (guarded: boolean) => void;
  /** Opened from an empty grid cell: the room and Check In to start with. */
  prefill?: {
    roomId?: string;
    arrival?: IsoDate;
    /** Open on the New Room Closure tab; `end` and `description` come from a duplicated closure. */
    tab?: 'closure';
    end?: IsoDate;
    description?: string;
  };
  /** The tab changed (the URL follows). */
  onTabChange?: (tab: 'reservation' | 'closure') => void;
  /** A closure was saved: the page reloads the schedule and closes the panel. */
  onClosureSaved?: (closure: ScheduleClosure) => void;
  /** False while the drawer is closing: the hold stops and its expiry dialog never shows. */
  active?: boolean;
  /** Injectable clock (epoch ms) for the hold timer; Date.now by default. */
  now?: () => number;
}

export default function NewReservationPanel({
  titleId,
  today,
  data,
  dataFailed,
  onRetryData,
  onBack,
  onCreated,
  onUnknownOutcome,
  onGuardChange,
  prefill,
  onTabChange,
  onClosureSaved,
  active = true,
  now,
}: NewReservationPanelProps) {
  const api = useApi();
  const { can } = useAccess();
  const canCreate = can(RESERVATION_EDIT_PERMISSION);
  const rootRef = useRef<HTMLDivElement>(null);
  // On the closure tab the room and day describe the closure, not the reservation.
  const reservationPrefill = prefill?.tab === 'closure' ? undefined : prefill;
  const [initial] = useState(() =>
    prefilledNewReservation(today, addDays(today, 1), reservationPrefill),
  );
  const [form, setForm] = useState<NewReservationForm>(initial.form);
  // Opened from a past day: Check In was set to today, and the panel says so until it is edited.
  const [pastNote, setPastNote] = useState(initial.pastDate);
  const [tab, setTab] = useState(prefill?.tab === 'closure' ? 1 : 0);
  // The URL is the truth: Back or Forward that adds or drops tab=closure moves the visible tab.
  const urlTab = prefill?.tab === 'closure' ? 1 : 0;
  const [seenUrlTab, setSeenUrlTab] = useState(urlTab);
  if (seenUrlTab !== urlTab) {
    setSeenUrlTab(urlTab);
    setTab(urlTab);
  }
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null);
  const [addFor, setAddFor] = useState<'booking' | 'lead' | null>(null);
  // The room of a clicked cell is applied once the rooms have loaded (a reload opens the panel first).
  const [roomApplied, setRoomApplied] = useState(!reservationPrefill?.roomId);
  if (!roomApplied && data) {
    setRoomApplied(true);
    const room = data.rooms.find((r) => r.id === reservationPrefill?.roomId);
    if (room) setForm((f) => ({ ...f, ...selectRoom(data.rooms, f, room.id) }));
  }
  const [notes, setNotes] = useState({ publicNotes: '', privateNotes: '' });
  const [submitted, setSubmitted] = useState(0);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);
  // A refused room (409 conflict) is also shown on the Room field; cleared when the room or dates change.
  const [roomError, setRoomError] = useState<string | null>(null);
  // The idempotency key of the create request: kept while the form is unchanged, so a retry after an
  // unknown outcome (timeout, network, 5xx) replays instead of creating a second reservation. It is
  // dropped after a definitive answer, and replaced as soon as anything in the request body changes.
  const attempt = useRef<{ id: string; body: string } | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const set = <K extends keyof NewReservationForm>(key: K, value: NewReservationForm[K]) => {
    if (key === 'roomId' || key === 'arrival' || key === 'departure') setRoomError(null);
    if (key === 'arrival' || key === 'departure') setPastNote(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  // ---- rooms: every room, whatever the schedule is filtered to ----
  const allRooms = useMemo(() => data?.rooms ?? [], [data]);
  const { locationId, roomTypeId, roomId, autoLocation, autoRoomType } = form;
  const selection = useMemo<RoomSelection>(
    () => ({ locationId, roomTypeId, roomId, autoLocation, autoRoomType }),
    [locationId, roomTypeId, roomId, autoLocation, autoRoomType],
  );
  const choices = useMemo(() => roomChoices(allRooms, selection), [allRooms, selection]);
  const options = useMemo(
    () => (data ? buildRoomOptions(choices.rooms, data.locations, data.roomTypes) : []),
    [data, choices.rooms],
  );
  const unassigned = { value: '', label: 'Unassigned' };
  const locationOptions = [
    unassigned,
    ...(data?.locations ?? [])
      .filter((l) => choices.locationIds.has(l.id))
      .map((l) => ({ value: l.id, label: l.name })),
  ];
  const roomTypeOptions = [
    unassigned,
    ...(data?.roomTypes ?? [])
      .filter((t) => choices.roomTypeIds.has(t.id))
      .map((t) => ({ value: t.id, label: t.name })),
  ];
  const chosenRoom = allRooms.find((r) => r.id === form.roomId);
  const roomType = data?.roomTypes.find(
    (t) => t.id === (chosenRoom?.roomTypeId ?? form.roomTypeId),
  );
  const pick = (next: RoomSelection) => {
    setRoomError(null);
    setForm((f) => ({ ...f, ...next }));
  };
  const nights = stayNights(form.arrival, form.departure);
  const total = estimateTotal(nights, roomType);

  // ---- time limit ----
  // The time limit is a UI countdown for now (Booking Rules "Reservation Hold" minutes): nothing
  // server-side holds the room while the panel is open. A real backend needs a hold/reserve call
  // when the panel opens and a hold token sent with the create request (see README, API conventions).
  const holdState = useBookingHold();
  const minutes =
    holdState.status === 'success' ? holdMinutes(holdState.hold, ADMIN_HOLD_AUDIENCE) : null;
  // The time limit pauses on the New Room Closure tab: that time does not count, and the countdown
  // resumes with what was left.
  const timer = useHoldTimer(minutes, now, active, tab !== 0);
  const phase = timer.status?.phase;
  const expired = phase === 'expired' && active;
  // Discrete announcements only (start, under a minute, expired), not every second.
  const announcement =
    tab !== 0
      ? ''
      : phase === 'warning'
        ? 'Less than a minute left to complete this reservation.'
        : phase === 'expired'
          ? 'Your time to complete this reservation has expired.'
          : phase === 'running' && minutes !== null
            ? `Complete this reservation within ${describeHold(minutes * 60_000)}.`
            : '';
  useEffect(() => {
    onGuardChange(expired);
    return () => onGuardChange(false);
  }, [expired, onGuardChange]);

  // ---- validation and submit ----
  const errors = validateNewReservation(form, today);
  const shown = submitted > 0 ? errors : {};
  useEffect(() => {
    if (submitted === 0) return;
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [submitted]);

  const submit = () => {
    if (inFlight.current || expired || !canCreate) return;
    setSubmitted((n) => n + 1);
    setFailure(null);
    setRoomError(null);
    if (Object.keys(errors).length > 0) return;
    inFlight.current = true;
    setSaving(true);
    const body = {
      ...toCreateRequest(form, ''),
      publicNotes: notes.publicNotes || undefined,
      privateNotes: notes.privateNotes || undefined,
    };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.body !== fingerprint) {
      attempt.current = { id: newRequestId(), body: fingerprint };
    }
    api.reservations.create({ ...body, requestId: attempt.current.id }).then(
      (detail) => {
        attempt.current = null;
        onCreated(detail);
      },
      (error: unknown) => {
        const status = error instanceof ApiError ? error.status : 0;
        const code = error instanceof ApiError ? error.code : undefined;
        const result = createFailure(status, code);
        setFailure(result.message);
        if (code === 'conflict') setRoomError(result.message);
        if (result.unknown) onUnknownOutcome();
        else attempt.current = null; // nothing was applied: the next attempt is a new request
        inFlight.current = false;
        setSaving(false);
      },
    );
  };

  const range = (role: 'from' | 'to'): DateFieldRange => ({
    role,
    from: form.arrival,
    to: form.departure,
    limits: stayLimits(today, MAX_ADVANCE_DAYS, MAX_STAY_NIGHTS),
    endNames: ['check-in', 'check-out'],
    onChange: (r) => {
      setRoomError(null);
      setPastNote(false);
      setForm((f) => ({ ...f, arrival: r.from, departure: r.to }));
    },
  });
  const hintId = useId();

  return (
    <Box
      ref={rootRef}
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <Box sx={{ px: 2.5, pt: 2.5, flex: '1 1 auto', overflow: 'auto', minHeight: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tabs
            value={tab}
            onChange={(_, v: number) => {
              setTab(v);
              onTabChange?.(v === 1 ? 'closure' : 'reservation');
            }}
            aria-label="Create"
            variant="scrollable"
            scrollButtons={false}
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              '& .MuiTab-root': { px: 1, minWidth: 0, typography: 'button_small' },
            }}
          >
            <Tab
              label="New Reservation"
              id={`${titleId}-tab-0`}
              aria-controls={`${titleId}-panel-0`}
            />
            <Tab
              label="New Room Closure"
              id={`${titleId}-tab-1`}
              aria-controls={`${titleId}-panel-1`}
            />
          </Tabs>
          <IconButton
            aria-label="Close new reservation"
            color="primary"
            onClick={onBack}
            sx={{ mr: -1 }}
          >
            <Close fontSize="large" />
          </IconButton>
        </Box>
        <Button startIcon={<ArrowBack />} onClick={onBack} size="small" sx={{ mt: 1.5, ml: -1 }}>
          Back to schedule
        </Button>
        <Typography id={titleId} variant="h6" component="h2" sx={{ mt: 1 }}>
          {tab === 0 ? 'New Reservation' : 'New Room Closure'}
        </Typography>

        {!canCreate && tab === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            You do not have permission to create reservations.
          </Alert>
        ) : null}
        {holdState.status === 'error' && tab === 0 ? (
          <Alert
            severity="warning"
            sx={{ mt: 1 }}
            action={
              <Button color="inherit" size="small" onClick={holdState.retry}>
                Retry
              </Button>
            }
          >
            The time limit could not be loaded, so this reservation has no timer.
          </Alert>
        ) : null}
        {timer.status && tab === 0 ? (
          <Box
            role="timer"
            aria-label="Time to complete this reservation"
            sx={{
              mt: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              border: (t) =>
                `1px solid ${phase === 'running' ? t.palette.primary.outlinedBorder : t.palette.error.main}`,
              color: phase === 'running' ? 'text.primary' : 'error.main',
              bgcolor: phase === 'running' ? 'primary.tint' : 'background.paper',
            }}
          >
            <Timer aria-hidden fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {expired ? 'Time expired' : `Time left: ${formatHold(timer.status.remainingMs)}`}
            </Typography>
          </Box>
        ) : null}
        <Box role="status" sx={visuallyHidden}>
          {announcement}
        </Box>

        <Box
          role="tabpanel"
          id={`${titleId}-panel-1`}
          aria-labelledby={`${titleId}-tab-1`}
          hidden={tab !== 1}
          sx={{ mt: 2 }}
        >
          <NewClosureTab
            today={today}
            data={data}
            dataFailed={dataFailed}
            onRetryData={onRetryData}
            footerEl={tab === 1 ? footerEl : null}
            prefill={prefill}
            onCancel={onBack}
            onSaved={(closure) => onClosureSaved?.(closure)}
            onUnknownOutcome={onUnknownOutcome}
          />
        </Box>
        <Box
          component="form"
          role="tabpanel"
          id={`${titleId}-panel-0`}
          aria-labelledby={`${titleId}-tab-0`}
          hidden={tab !== 0}
          noValidate
          onSubmit={(e) => e.preventDefault()}
          sx={{ mt: 2 }}
        >
          {pastNote ? (
            <Alert severity="info" role="status" sx={{ mb: 1.5 }}>
              Check In was set to today because the day you clicked has passed.
            </Alert>
          ) : null}
          <Typography
            variant="subtitle2"
            component="h3"
            sx={{ fontWeight: 700, color: 'text.secondary' }}
          >
            Stay{nights !== null ? ` (${nights} ${nights === 1 ? 'Night' : 'Nights'})` : ''}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <DateField
              label="Check In"
              today={today}
              value={form.arrival}
              onChange={(v) => set('arrival', v)}
              error={Boolean(shown.arrival)}
              helperText={shown.arrival}
              required
              min={today}
              range={range('from')}
            />
            <DateField
              label="Check Out"
              today={today}
              value={form.departure}
              onChange={(v) => set('departure', v)}
              error={Boolean(shown.departure)}
              helperText={shown.departure}
              required
              min={addDays(form.arrival || today, 1)}
              range={range('to')}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 5, mt: 2.5 }}>
            <CountStepper
              label="Adults"
              value={form.adults}
              min={1}
              max={MAX_PARTY}
              onChange={(v) => set('adults', v)}
            />
            <CountStepper
              label="Children"
              value={form.children}
              min={0}
              max={MAX_PARTY}
              onChange={(v) => set('children', v)}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
            <Typography
              variant="subtitle2"
              component="span"
              id={`${hintId}-guest`}
              sx={{ fontWeight: 700, color: 'text.secondary' }}
            >
              Booking Guest
            </Typography>
            <RadioGroup
              row
              aria-labelledby={`${hintId}-guest`}
              value={form.role}
              onChange={(_, v) =>
                setForm((f) => ({
                  ...f,
                  role: v as NewReservationForm['role'],
                  // The lead occupant is the booking guest for an occupant: nothing to keep.
                  leadOccupant: v === 'reserver' ? f.leadOccupant : null,
                }))
              }
            >
              <FormControlLabel
                value="occupant"
                control={<Radio size="small" />}
                label="Occupant"
              />
              <FormControlLabel
                value="reserver"
                control={<Radio size="small" />}
                label="Reserver"
              />
            </RadioGroup>
          </Box>
          <Box sx={{ mt: 1 }}>
            <GuestAutocomplete
              label="Booking guest"
              value={form.guest}
              onChange={(m) => set('guest', m)}
              onAdd={() => setAddFor('booking')}
              addLabel="Add booking guest"
            />
          </Box>
          {form.role === 'reserver' ? (
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="subtitle2"
                component="h3"
                id={`${hintId}-lead`}
                sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}
              >
                Lead Occupant
              </Typography>
              <GuestAutocomplete
                label="Lead occupant"
                value={form.leadOccupant}
                onChange={(m) => set('leadOccupant', m)}
                onAdd={() => setAddFor('lead')}
                addLabel="Add lead occupant"
                clearLabel="Clear lead occupant"
              />
            </Box>
          ) : null}

          <Typography
            variant="subtitle2"
            component="h3"
            sx={{ fontWeight: 700, color: 'text.secondary', mt: 2.5 }}
          >
            Room Details
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Select
              label="Location"
              placeholder="Unassigned"
              size="small"
              fullWidth
              value={form.locationId}
              options={locationOptions}
              onChange={(v) => pick(selectLocation(allRooms, selection, v))}
            />
            <Select
              label="Room Type"
              placeholder="Unassigned"
              size="small"
              fullWidth
              value={form.roomTypeId}
              options={roomTypeOptions}
              onChange={(v) => pick(selectRoomType(allRooms, selection, v))}
            />
            <RoomAutocomplete
              options={options}
              value={form.roomId}
              onChange={(id) => pick(selectRoom(allRooms, selection, id))}
              loading={!data && !dataFailed}
              unavailable={dataFailed}
              error={roomError ?? undefined}
            />
            {dataFailed ? (
              <Button size="small" onClick={onRetryData} sx={{ alignSelf: 'flex-start' }}>
                Retry loading rooms
              </Button>
            ) : null}
          </Box>

          <Box sx={{ borderTop: (t) => `1px solid ${t.palette.divider}`, mt: 2.5, pt: 2.5 }}>
            <Typography
              variant="subtitle2"
              component="h3"
              sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}
            >
              Optional Information
            </Typography>
            {DETAILS_SECTIONS.map((s) => (
              <Accordion
                key={s.id}
                disableGutters
                square
                elevation={0}
                expanded={openSection === s.id}
                onChange={(_, open) => setOpenSection(open ? s.id : null)}
                slotProps={{ transition: { unmountOnExit: true } }}
                sx={{
                  '&:before': { display: 'none' },
                  borderBottom: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  sx={{
                    '& .MuiAccordionSummary-content': {
                      alignItems: 'center',
                      gap: 1.5,
                      color: 'text.secondary',
                    },
                    '& .MuiSvgIcon-root:first-of-type': { color: 'primary.main' },
                    '&.Mui-expanded': { bgcolor: 'primary.tint' },
                  }}
                >
                  {s.icon}
                  <Typography>{s.title}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, py: 2 }}>
                  {s.id === 'notes' ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Public Notes"
                        multiline
                        minRows={2}
                        value={notes.publicNotes}
                        onChange={(e) => setNotes((n) => ({ ...n, publicNotes: e.target.value }))}
                        slotProps={{
                          inputLabel: { shrink: true },
                          htmlInput: { maxLength: MAX_NOTES_LENGTH },
                        }}
                      />
                      <TextField
                        label="Private Notes"
                        multiline
                        minRows={2}
                        value={notes.privateNotes}
                        onChange={(e) => setNotes((n) => ({ ...n, privateNotes: e.target.value }))}
                        slotProps={{
                          inputLabel: { shrink: true },
                          htmlInput: { maxLength: MAX_NOTES_LENGTH },
                        }}
                      />
                    </Box>
                  ) : s.id === 'rates' ? (
                    <Typography variant="body2">
                      {total === null
                        ? 'Choose a room and dates to see the estimate.'
                        : `${nights} ${nights === 1 ? 'night' : 'nights'} at ${formatMoney(roomType?.nightlyRate)}: ${formatMoney(total)}, excluding taxes and service charges. Payment is taken after the reservation is created.`}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      You can add this after the reservation is created.
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Box>
      </Box>

      {tab === 1 ? (
        <Box ref={setFooterEl} sx={{ bgcolor: 'primary.tint', px: 3.75, py: 2, flex: 'none' }} />
      ) : null}
      {tab === 0 ? (
        <Box sx={{ bgcolor: 'primary.tint', px: 3.75, py: 2, flex: 'none' }}>
          {failure ? (
            <Alert severity="error" role="alert" sx={{ mb: 1.5 }}>
              {failure}
            </Alert>
          ) : null}
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Estimated Reservation Total: {total === null ? 'to be calculated' : formatMoney(total)}
          </Typography>
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={submit}
            aria-disabled={saving || expired || !canCreate || undefined}
            className={saving || expired || !canCreate ? 'Mui-disabled' : undefined}
            sx={{ '&.Mui-disabled': { pointerEvents: 'auto' } }}
          >
            {saving ? 'Creating…' : 'Create New Reservation'}
          </Button>
        </Box>
      ) : null}

      <AddGuestDialog
        open={addFor !== null}
        forLabel={addFor === 'lead' ? 'lead occupant' : 'booking guest'}
        onClose={() => setAddFor(null)}
        onAdded={(member) => {
          if (addFor === 'lead') set('leadOccupant', member);
          else set('guest', member);
          setAddFor(null);
        }}
      />

      <Dialog
        open={expired}
        role="alertdialog"
        onClose={() => undefined}
        aria-labelledby={`${titleId}-expired`}
        aria-describedby={`${titleId}-expired-text`}
      >
        <DialogTitle id={`${titleId}-expired`}>
          Your time to complete this reservation has expired
        </DialogTitle>
        <DialogContent>
          <DialogContentText id={`${titleId}-expired-text`} sx={{ color: 'text.primary' }}>
            Nothing was saved. Restart the timer to keep what you entered, or go back to the
            schedule.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={onBack}
            sx={{ borderColor: 'primary.outlinedBorder' }}
          >
            Back to schedule
          </Button>
          <Button ref={focusOnMount} variant="contained" onClick={timer.restart}>
            Restart timer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
