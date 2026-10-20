import ArrowBack from '@mui/icons-material/ArrowBack';
import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
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
import InputAdornment from '@mui/material/InputAdornment';
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
import type { ReservationDetail, ScheduleData } from '../../api';
import { ApiError } from '../../api';
import { stayLimits } from '../../app/dateRange';
import { ADMIN_HOLD_AUDIENCE, describeHold, formatHold, holdMinutes } from '../../app/holdTimer';
import {
  createFailure,
  defaultNewReservation,
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
import { useAccess } from '../../app/useAccess';
import { addDays, type IsoDate } from '../../lib/dates';
import { newRequestId } from '../../lib/requestId';
import { MAX_NOTES_LENGTH, MAX_PARTY } from '../../api/validation';
import DateField, { type DateFieldRange } from '../shared/DateField';
import { focusOnMount } from '../shared/focusOnMount';
import { DETAILS_SECTIONS } from './DetailsAccordion';
import CountStepper from './CountStepper';
import RoomAutocomplete from './RoomAutocomplete';
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
  active = true,
  now,
}: NewReservationPanelProps) {
  const api = useApi();
  const { can } = useAccess();
  const canCreate = can(RESERVATION_EDIT_PERMISSION);
  const rootRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<NewReservationForm>(() =>
    defaultNewReservation(today, addDays(today, 1)),
  );
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
    setForm((f) => ({ ...f, [key]: value }));
  };

  // ---- rooms: every room, whatever the schedule is filtered to ----
  const options = useMemo(
    () => (data ? buildRoomOptions(data.rooms, data.locations, data.roomTypes) : []),
    [data],
  );
  const chosen = options.find((o) => o.id === form.roomId);
  const roomType = data?.roomTypes.find((t) => t.id === chosen?.roomTypeId);
  const nights = stayNights(form.arrival, form.departure);
  const total = estimateTotal(nights, roomType);

  // ---- time limit ----
  // The time limit is a UI countdown for now (Booking Rules "Reservation Hold" minutes): nothing
  // server-side holds the room while the panel is open. A real backend needs a hold/reserve call
  // when the panel opens and a hold token sent with the create request (see README, API conventions).
  const holdState = useBookingHold();
  const minutes =
    holdState.status === 'success' ? holdMinutes(holdState.hold, ADMIN_HOLD_AUDIENCE) : null;
  const timer = useHoldTimer(minutes, now, active);
  const phase = timer.status?.phase;
  const expired = phase === 'expired' && active;
  // Discrete announcements only (start, under a minute, expired), not every second.
  const announcement =
    phase === 'warning'
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
            value={0}
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
            <Tab label="New Reservation" id={`${titleId}-tab`} />
            {/* Room closures arrive with Room Blocks (not built yet). */}
            <Tab label="New Room Closure" disabled />
          </Tabs>
          <IconButton aria-label="Close new reservation" onClick={onBack} sx={{ mr: -1 }}>
            <Close fontSize="large" />
          </IconButton>
        </Box>
        <Button startIcon={<ArrowBack />} onClick={onBack} size="small" sx={{ mt: 1.5, ml: -1 }}>
          Back to schedule
        </Button>
        <Typography id={titleId} variant="h6" component="h2" sx={{ mt: 1 }}>
          New Reservation
        </Typography>

        {!canCreate ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            You do not have permission to create reservations.
          </Alert>
        ) : null}
        {holdState.status === 'error' ? (
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
        {timer.status ? (
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

        <Box component="form" noValidate onSubmit={(e) => e.preventDefault()} sx={{ mt: 2 }}>
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
              onChange={(_, v) => set('role', v as NewReservationForm['role'])}
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
          <TextField
            label="Booking guest"
            required
            fullWidth
            value={form.guestName}
            onChange={(e) => set('guestName', e.target.value)}
            error={Boolean(shown.guestName)}
            helperText={
              shown.guestName ??
              'PLACEHOLDER: type the name. Member search arrives with the Member Directory.'
            }
            sx={{ mt: 1 }}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { maxLength: 200 },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search aria-hidden />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Typography
            variant="subtitle2"
            component="h3"
            sx={{ fontWeight: 700, color: 'text.secondary', mt: 2.5 }}
          >
            Room Details
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <TextField
              label="Location"
              size="small"
              value={chosen?.locationName ?? ''}
              placeholder="Set by the room"
              slotProps={{
                inputLabel: { shrink: true },
                input: { readOnly: true },
                htmlInput: { tabIndex: -1 },
              }}
            />
            <TextField
              label="Room Type"
              size="small"
              value={chosen?.roomTypeName ?? ''}
              placeholder="Set by the room"
              slotProps={{
                inputLabel: { shrink: true },
                input: { readOnly: true },
                htmlInput: { tabIndex: -1 },
              }}
            />
            <RoomAutocomplete
              options={options}
              value={form.roomId}
              onChange={(id) => set('roomId', id)}
              loading={!data && !dataFailed}
              unavailable={dataFailed}
              error={shown.roomId ?? roomError ?? undefined}
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
