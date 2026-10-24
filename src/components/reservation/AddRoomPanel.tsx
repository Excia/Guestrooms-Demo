import ArrowBack from '@mui/icons-material/ArrowBack';
import Close from '@mui/icons-material/Close';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApi } from '../../api';
import type { ReservationDetail } from '../../api';
import {
  addRoomBlocker,
  addRoomEstimate,
  addRoomFailure,
  defaultAddRoomForm,
  roomsFreeForStay,
  toAddRoomRequest,
  validateAddRoom,
  type AddRoomForm,
} from '../../app/addRoom';
import { checkInText, checkOutText, reservationTitle } from '../../app/reservationPanel';
import { formatMoney } from '../../app/quickStats';
import { buildRoomOptions } from '../../app/roomOptions';
import {
  roomChoices,
  selectLocation,
  selectRoom,
  selectRoomType,
  type RoomSelection,
} from '../../app/roomCascade';
import { MAX_PARTY } from '../../api/validation';
import Select from '../shared/Select';
import { focusOnMount } from '../shared/focusOnMount';
import { DETAILS_SECTIONS } from './DetailsAccordion';
import AddGuestDialog from './AddGuestDialog';
import CountStepper from './CountStepper';
import GuestAutocomplete from './GuestAutocomplete';
import RoomAutocomplete from './RoomAutocomplete';
import { useIdempotentSave } from './useIdempotentSave';
import { useReservationDetail } from './useReservationDetail';
import { useStayInventory } from './useStayInventory';

export interface AddRoomPanelProps {
  titleId: string;
  reservationId: string;
  /** "Back to reservation": the details of the same reservation. */
  onBackToReservation: () => void;
  /** The close button: the panel closes and the schedule is as it was. */
  onClose: () => void;
  /** The room was added; the answer is the reservation with its rooms. */
  onAdded: (detail: ReservationDetail) => void;
  /** The schedule behind the panel must load again (a room was refused or the outcome is unknown). */
  onChanged?: () => void;
}

/**
 * Add Another Room (ticket 151; Figma 16593:31892): the New Reservation form for one more room of
 * an existing reservation. The stay dates are the reservation's and are shown, not edited (reservation
 * number and dates on top). Only rooms that are free for every night of the stay can be chosen;
 * Unassigned is allowed. Adding sends the version on screen with an idempotency key that is kept
 * across an unknown outcome. The page then shows the reservation with its new room.
 */
export default function AddRoomPanel({
  titleId,
  reservationId,
  onBackToReservation,
  onClose,
  onAdded,
  onChanged,
}: AddRoomPanelProps) {
  const api = useApi();
  const state = useReservationDetail(reservationId);
  const detail = state.status === 'success' ? state.detail : null;
  const stay = useStayInventory(detail?.arrival ?? null, detail?.departure ?? null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hintId = useId();

  const [form, setForm] = useState<AddRoomForm>(defaultAddRoomForm);
  const [submitted, setSubmitted] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [addLead, setAddLead] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const save = useIdempotentSave();

  // ---- rooms free for the whole stay ----
  const inventory = stay.status === 'ready' ? stay.inventory : null;
  const free = useMemo(
    () =>
      inventory && detail
        ? roomsFreeForStay(
            inventory.rooms,
            inventory.blocks,
            inventory.closures,
            detail.arrival,
            detail.departure,
          )
        : [],
    [inventory, detail],
  );
  const freeIds = useMemo(() => new Set(free.map((r) => r.id)), [free]);
  const { locationId, roomTypeId, roomId, autoLocation, autoRoomType } = form;
  const selection = useMemo<RoomSelection>(
    () => ({ locationId, roomTypeId, roomId, autoLocation, autoRoomType }),
    [locationId, roomTypeId, roomId, autoLocation, autoRoomType],
  );
  const choices = useMemo(() => roomChoices(free, selection), [free, selection]);
  const options = useMemo(
    () =>
      inventory ? buildRoomOptions(choices.rooms, inventory.locations, inventory.roomTypes) : [],
    [inventory, choices.rooms],
  );
  const unassigned = { value: '', label: 'Unassigned' };
  const locationOptions = [
    unassigned,
    ...(inventory?.locations ?? [])
      .filter((l) => choices.locationIds.has(l.id))
      .map((l) => ({ value: l.id, label: l.name })),
  ];
  const roomTypeOptions = [
    unassigned,
    ...(inventory?.roomTypes ?? [])
      .filter((t) => choices.roomTypeIds.has(t.id))
      .map((t) => ({ value: t.id, label: t.name })),
  ];
  const chosen = free.find((r) => r.id === form.roomId);
  const roomType = inventory?.roomTypes.find(
    (t) => t.id === (chosen?.roomTypeId ?? form.roomTypeId),
  );
  const total = detail ? addRoomEstimate(detail, roomType) : null;
  // The reservation as it would be: what is on its folio now plus the new room's nights.
  const reservationTotal = detail ? detail.stay.folioTotalCents + (total ?? 0) : null;
  const pick = (next: RoomSelection) => {
    setRoomError(null);
    setForm((f) => ({ ...f, ...next }));
  };

  const blocker = detail ? addRoomBlocker(detail) : null;
  const errors = validateAddRoom(form, freeIds);
  const shown = submitted > 0 && stay.status === 'ready' ? errors : {};
  useEffect(() => {
    if (submitted === 0) return;
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [submitted]);

  const submit = () => {
    if (!detail || save.busy || blocker) return;
    setSubmitted((n) => n + 1);
    setFailure(null);
    setRoomError(null);
    // A chosen room cannot be checked while the free rooms are loading or failed: say so (an
    // unassigned room needs no inventory).
    if (form.roomId !== '' && stay.status !== 'ready') {
      setFailure(
        stay.status === 'error'
          ? 'The rooms could not be loaded, so the chosen room cannot be checked. Retry loading rooms, or choose Unassigned.'
          : 'The rooms are still loading. Try again in a moment.',
      );
      return;
    }
    if (Object.keys(errors).length > 0) return;
    const body = toAddRoomRequest(form, detail, '');
    // The body (with the version on screen) is the fingerprint: after an unknown outcome the screen
    // is NOT refreshed (see below), so a retry is the same request with the same key and the
    // backend replays the answer instead of adding a second room.
    void save
      .run(JSON.stringify({ ...body, requestId: undefined }), (requestId) =>
        api.reservations.addRoom({ ...body, requestId }),
      )
      .then((result) => {
        if (!result) return;
        if (result.ok) {
          onAdded(result.value);
          return;
        }
        const failed = addRoomFailure(result.error);
        if (save.isMounted()) {
          setFailure(failed.message);
          if (failed.roomError) setRoomError(failed.message);
        }
        if (!failed.refetch) return;
        onChanged?.();
        // Unknown outcome: keep the version, the inventory and the idempotency key as they were, so
        // pressing Add again replays the request. Anything else is reloaded.
        if (failed.outcomeUnknown) return;
        stay.reload();
        api.reservations.getDetail(reservationId).then(state.replace, () => undefined);
      });
  };

  const closeButton = (
    <IconButton
      aria-label="Close add room"
      color="primary"
      onClick={onClose}
      sx={{ ml: 'auto', mr: -1, mt: -0.5 }}
    >
      <Close fontSize="large" />
    </IconButton>
  );

  if (!detail) {
    return (
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex' }}>
          <Typography
            id={titleId}
            ref={focusOnMount}
            tabIndex={-1}
            variant="h6"
            component="h2"
            sx={{ outline: 'none' }}
          >
            Add Room to Reservation
          </Typography>
          {closeButton}
        </Box>
        {state.status === 'error' ? (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
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
        ) : (
          <Box aria-busy="true" role="status" aria-label="Loading reservation" sx={{ mt: 2 }}>
            <Skeleton width="60%" />
            <Skeleton width="45%" />
            <Skeleton variant="rounded" height={42} sx={{ mt: 2 }} />
          </Box>
        )}
      </Box>
    );
  }

  const nights = detail.nights;
  const ctaDisabled = save.busy || Boolean(blocker);
  return (
    <Box
      ref={rootRef}
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <Box sx={{ px: 2.5, pt: 2.5, flex: '1 1 auto', overflow: 'auto', minHeight: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              component="p"
              sx={{ fontWeight: 700, color: 'text.secondary' }}
            >
              {reservationTitle(detail)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {checkInText(detail)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {checkOutText({ departure: detail.departure, nights })}
            </Typography>
          </Box>
          {closeButton}
        </Box>
        <Button
          startIcon={<ArrowBack />}
          onClick={onBackToReservation}
          size="small"
          sx={{ mt: 1.5, ml: -1 }}
        >
          Back to reservation
        </Button>
        <Typography
          id={titleId}
          ref={focusOnMount}
          tabIndex={-1}
          variant="h6"
          component="h2"
          sx={{ mt: 1, outline: 'none' }}
        >
          Add Room to Reservation
        </Typography>
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
          The new room stays on the same dates as the reservation.
        </Typography>

        {blocker ? (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            {blocker}
          </Alert>
        ) : null}

        <Box component="form" noValidate onSubmit={(e) => e.preventDefault()} sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', gap: 5 }}>
            <CountStepper
              label="Adults"
              value={form.adults}
              min={1}
              max={MAX_PARTY}
              onChange={(v) => setForm((f) => ({ ...f, adults: v }))}
            />
            <CountStepper
              label="Children"
              value={form.children}
              min={0}
              max={MAX_PARTY}
              onChange={(v) => setForm((f) => ({ ...f, children: v }))}
            />
          </Box>

          <Typography
            variant="subtitle2"
            component="h3"
            sx={{ fontWeight: 700, color: 'text.secondary', mt: 2.5 }}
          >
            Reserver
          </Typography>
          <Typography variant="body1">
            {detail.leadOccupant.name}
            {detail.leadOccupant.memberNumber ? ` (${detail.leadOccupant.memberNumber})` : ''}
          </Typography>

          <Typography
            variant="subtitle2"
            component="h3"
            id={`${hintId}-lead`}
            sx={{ fontWeight: 700, color: 'text.secondary', mt: 2.5, mb: 1 }}
          >
            Lead Occupant
          </Typography>
          <GuestAutocomplete
            label="Lead occupant"
            value={form.leadOccupant}
            onChange={(m) => setForm((f) => ({ ...f, leadOccupant: m }))}
            onAdd={() => setAddLead(true)}
            addLabel="Add lead occupant"
            clearLabel="Clear lead occupant"
          />

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
              onChange={(v) => pick(selectLocation(free, selection, v))}
            />
            <Select
              label="Room Type"
              placeholder="Unassigned"
              size="small"
              fullWidth
              value={form.roomTypeId}
              options={roomTypeOptions}
              onChange={(v) => pick(selectRoomType(free, selection, v))}
            />
            <RoomAutocomplete
              options={options}
              value={form.roomId}
              onChange={(id) => pick(selectRoom(free, selection, id))}
              loading={stay.status === 'loading' || stay.status === 'idle'}
              unavailable={stay.status === 'error'}
              error={roomError ?? shown.room}
            />
            {stay.status === 'error' ? (
              <Button size="small" onClick={stay.reload} sx={{ alignSelf: 'flex-start' }}>
                Retry loading rooms
              </Button>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Only rooms free for every night of the stay are listed.
              </Typography>
            )}
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
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {s.id === 'rates'
                      ? total === null
                        ? 'Choose a room to see the estimate.'
                        : `${nights} ${nights === 1 ? 'night' : 'nights'} at ${formatMoney(roomType?.nightlyRate)}: ${formatMoney(total)}, excluding taxes and service charges.`
                      : s.id === 'guests'
                        ? 'Name the other guests of this room after it is added (Guest Details).'
                        : 'You can add this after the room is added.'}
                  </Typography>
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
          Estimated Reservation Total{total === null ? ' (excludes the new room)' : ''}:{' '}
          {reservationTotal === null ? 'to be calculated' : formatMoney(reservationTotal)}
        </Typography>
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={submit}
          aria-disabled={ctaDisabled || undefined}
          className={ctaDisabled ? 'Mui-disabled' : undefined}
          sx={{ '&.Mui-disabled': { pointerEvents: 'auto' } }}
        >
          {save.busy ? 'Adding…' : 'Add Room to Reservation'}
        </Button>
      </Box>

      <AddGuestDialog
        open={addLead}
        forLabel="lead occupant"
        onClose={() => setAddLead(false)}
        onAdded={(member) => {
          setForm((f) => ({ ...f, leadOccupant: member }));
          setAddLead(false);
        }}
      />
    </Box>
  );
}
