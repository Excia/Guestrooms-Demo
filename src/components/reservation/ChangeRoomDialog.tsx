import { visuallyHidden } from '@mui/utils';
import Lock from '@mui/icons-material/Lock';
import LockOpen from '@mui/icons-material/LockOpen';
import ShieldMoon from '@mui/icons-material/ShieldMoon';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  ChangeRoomRequest,
  NightRoom,
  RateChoice,
  ReservationDetail,
  ReservationRoomDetail,
  ScheduleBlock,
} from '../../api';
import {
  buildNightIndex,
  changeToast,
  confirmBlocker,
  filterChoices,
  keepValidEdits,
  nightChoices,
  nightsText,
  NO_ROOM_FILTER,
  planRuns,
  planSentence,
  rateQuestion,
  runText,
  signedMoney,
  stayedNights,
  stayedPlan,
  toChangeRoomRequest,
  VIRTUALIZE_FROM_NIGHTS,
  visibleRows,
  type NightIndex,
  type RoomChoice,
  type RoomFilter,
} from '../../app/changeRoom';
import { formatPanelDate } from '../../app/newReservation';
import {
  changedFields,
  fieldsToUnlock,
  lockedFields,
  sentCodes,
  unlockMessage,
  UNLOCK_LABEL,
  UNLOCK_PERMISSION,
  type UnlockCodes,
  type UnlockField,
} from '../../app/overrideUnlock';
import { useAccess } from '../../app/useAccess';
import { showLocations } from '../../app/locations';
import { filterRoomOptions } from '../../app/roomOptions';
import { daysBetween, type IsoDate } from '../../lib/dates';
import { newRequestId } from '../../lib/requestId';
import { changedNights, planFromBlocks, stayOf } from '../../lib/stayPlan';
import { focusOnMount } from '../shared/focusOnMount';
import { OverridePinDialog } from '../shared/OverridePinDialog';
import { useChangeRoomData } from './useChangeRoomData';

/** A confirmed room plan, handed to the schedule page, which applies it and sends the request. */
export interface RoomChangeSubmission {
  request: ChangeRoomRequest;
  /** The reservation room as the user saw it (its id is the stay id): what the request is guarded by. */
  block: ScheduleBlock;
  /** The remaining nights with the room chosen for each. */
  plan: NightRoom[];
  /** The nights already stayed with their rooms: with the plan, the exact result on the grid. */
  stayed: NightRoom[];
  /** What the toast says once it is done ("Moved to Room 205"). */
  toast: string;
}

export interface ChangeRoomDialogProps {
  detail: ReservationDetail;
  room: ReservationRoomDetail;
  /** The first night not yet stayed (today, or the arrival if later). */
  effectiveDate: IsoDate;
  today: IsoDate;
  /** Choices to start from (the dialog reopened after the data drifted); invalid ones are dropped. */
  initialEdits?: Readonly<Record<IsoDate, string>>;
  /** The last save was refused with a lockout: the PIN prompt starts locked for this long. */
  initialLockedFor?: number;
  /** Cancel, Escape and the backdrop: nothing was changed. */
  onCancel: () => void;
  onSubmit: (submission: RoomChangeSubmission) => void;
}

const dateLabel = formatPanelDate;
/** "$199.00 per night", or "varies by night" as it is. */
const perNight = (rate: string) => (rate.startsWith('$') ? `${rate} per night` : rate);

/** Row height of the windowed night list, in theme spacing units, and the height of its viewport. */
const ROW_UNITS = 13;
const VIEWPORT_UNITS = 48;

interface NightRowProps {
  date: IsoDate;
  nightNo: number;
  roomId: string;
  currentRoomId: string;
  index: NightIndex;
  filter: RoomFilter;
  dialogId: string;
  /** The Room lock is closed: the night's room cannot be changed. */
  locked: boolean;
  /** Id of the lock button that explains a locked menu (`aria-describedby`). */
  lockId: string;
  onPick: (date: IsoDate, roomId: string) => void;
}

/**
 * One remaining night: "Night n: date" over its room menu (Figma 1326:19431). The menu's options are
 * built only when it opens, from the shared index, so a long stay costs nothing until a menu is used.
 */
const NightRow = memo(function NightRow({
  date,
  nightNo,
  roomId,
  currentRoomId,
  index,
  filter,
  dialogId,
  locked,
  lockId,
  onPick,
}: NightRowProps) {
  const [open, setOpen] = useState(false);
  const value = useMemo<RoomChoice>(
    () => ({
      option: index.optionById.get(roomId) ?? {
        id: roomId,
        number: '',
        label: roomId,
        group: '',
        locationName: '',
        roomTypeName: '',
        locationId: '',
        roomTypeId: '',
      },
      disabled: false,
      reason: null,
      current: roomId === currentRoomId,
    }),
    [index, roomId, currentRoomId],
  );
  const options = useMemo(
    () =>
      open ? filterChoices(nightChoices(index, date, currentRoomId), filter, roomId) : [value],
    [open, index, date, currentRoomId, filter, roomId, value],
  );
  const changed = roomId !== currentRoomId;
  const wasNumber = index.optionById.get(currentRoomId)?.number ?? '';
  return (
    <>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        Night {nightNo}: {dateLabel(date)}
      </Typography>
      <Autocomplete<RoomChoice, false, true>
        size="small"
        disableClearable
        disabled={locked}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        options={options}
        value={value}
        onChange={(_, choice) => {
          // A disabled room cannot be chosen, however the event arrives.
          if (choice.disabled) return;
          onPick(date, choice.option.id);
        }}
        groupBy={(c) => c.option.group}
        getOptionLabel={(c) => c.option.label}
        getOptionDisabled={(c) => c.disabled}
        isOptionEqualToValue={(a, b) => a.option.id === b.option.id}
        filterOptions={(all, { inputValue }) => {
          const ids = new Set(
            filterRoomOptions(
              all.map((c) => c.option),
              inputValue,
            ).map((o) => o.id),
          );
          return all.filter((c) => ids.has(c.option.id));
        }}
        noOptionsText="No rooms match."
        autoHighlight
        renderGroup={(params) => (
          <li key={params.key}>
            <ListSubheader component="div" sx={(t) => ({ top: t.spacing(-1) })}>
              {params.group}
            </ListSubheader>
            <Box component="ul" sx={{ p: 0 }}>
              {params.children}
            </Box>
          </li>
        )}
        renderOption={({ key, ...props }, choice) => {
          const reasonId = `${dialogId}-${date}-reason-${choice.option.id}`;
          const note = choice.reason ?? (choice.current ? 'Current room' : null);
          return (
            <Box
              component="li"
              key={key}
              {...props}
              aria-describedby={choice.reason ? reasonId : undefined}
              // A disabled option stays readable: MUI dims the whole row (opacity 0.38, selector
              // [aria-disabled="true"], inside the listbox: hence the repeated &), which would put the reason below 4.5:1 contrast. The row
              // keeps full opacity; the room name is dim and the reason is secondary text.
              sx={{ '&&&[aria-disabled="true"]': { opacity: 1 } }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, width: '100%' }}>
                <Box
                  component="span"
                  sx={{ color: choice.disabled ? 'text.disabled' : 'text.primary' }}
                >
                  {choice.option.label}
                </Box>
                {note ? (
                  <Typography
                    id={reasonId}
                    variant="body2"
                    component="span"
                    sx={{ color: 'text.secondary' }}
                  >
                    {note}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          );
        }}
        slotProps={{ popupIndicator: { 'aria-label': 'Show rooms', title: 'Show rooms' } }}
        renderInput={(params) => (
          <TextField
            {...params}
            hiddenLabel
            placeholder="Search by room number, location or room type"
            slotProps={{
              ...params.slotProps,
              htmlInput: {
                ...params.slotProps?.htmlInput,
                'aria-label': `Room for night ${nightNo}, ${dateLabel(date)}`,
                ...(locked ? { 'aria-describedby': lockId } : {}),
                // Focusing a menu (Tab, or the dialog opening on it) selects its text, so typing a
                // room number replaces "Room 210" instead of being appended to it.
                onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
                  (
                    params.slotProps?.htmlInput as { onFocus?: (e: unknown) => void } | undefined
                  )?.onFocus?.(e);
                  e.currentTarget.select();
                },
              },
            }}
            helperText={changed ? `Was Room ${wasNumber}` : undefined}
          />
        )}
      />
    </>
  );
});

/** The legacy lock icon: closed until a manager's PIN opens the field; open it only says so. */
function FieldLock({
  id,
  field,
  locked,
  onUnlock,
}: {
  id: string;
  field: UnlockField;
  locked: boolean;
  onUnlock: (field: UnlockField) => void;
}) {
  const label = UNLOCK_LABEL[field];
  return (
    <>
      <IconButton
        id={id}
        color="primary"
        aria-label={locked ? `Unlock ${label}` : `${label} unlocked`}
        disabled={!locked}
        onClick={() => onUnlock(field)}
      >
        {locked ? <Lock /> : <LockOpen />}
      </IconButton>
      {locked ? (
        <Box id={`${id}-why`} component="span" sx={visuallyHidden}>
          {label} is locked. Unlock it with an override code.
        </Box>
      ) : null}
    </>
  );
}

/**
 * Change Room During Stay (Figma 1326:19431 and the room menu 2623:14538; requirements 27.9.1.2).
 * Step 1 shows the stay one night per line: nights already stayed are locked (shield icon), every
 * remaining night has its own room menu listing the rooms available on that night (searchable,
 * grouped "location | room type", disabled rooms with the reason), with an optional Location and Room
 * Type filter. Step 2 confirms the resulting room plan and, when the setting asks and the rates of
 * the changed nights differ, whether to retain the current rate or update to the new rooms' rates.
 * Cancel and Escape leave everything unchanged; the primary action takes focus and works once.
 * A stay of more than 60 remaining nights lists its nights in a scrolling, windowed container.
 */
export default function ChangeRoomDialog({
  detail,
  room,
  effectiveDate,
  today,
  initialEdits,
  initialLockedFor,
  onCancel,
  onSubmit,
}: ChangeRoomDialogProps) {
  const id = useId();
  const theme = useTheme();
  const data = useChangeRoomData(room.id, effectiveDate, room.departure);
  const [step, setStep] = useState<'plan' | 'confirm'>('plan');
  // The rooms the user chose, by night; a night not listed keeps its current room (or the choice
  // carried over from a reopened dialog, when that is still valid).
  const [edits, setEdits] = useState<Record<IsoDate, string>>({});
  const [pickedFilter, setFilter] = useState<RoomFilter>(NO_ROOM_FILTER);
  // Locks: a field is locked while the user lacks its function and no PIN opened it. The PIN that
  // opened the last one is held here only, and sent with the request.
  const { can } = useAccess();
  const [unlocked, setUnlocked] = useState<ReadonlySet<UnlockField>>(new Set());
  const [codes, setCodes] = useState<UnlockCodes>({});
  // The field to move focus to once its prompt has closed.
  const [focusField, setFocusField] = useState<UnlockField | null>(null);
  const [unlocking, setUnlocking] = useState<UnlockField | null>(null);
  const locked = useMemo(() => lockedFields(can, unlocked), [can, unlocked]);
  const [answer, setAnswer] = useState<RateChoice>('retain');
  const [scrollTop, setScrollTop] = useState(0);
  const submitted = useRef(false);
  // Focus goes to the first night's menu ONCE, when step 1 first shows its nights (not each time the
  // first row of a windowed list is rendered again by scrolling back up).
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusedFirst = useRef(false);
  // The row that has focus stays rendered while the windowed list scrolls past it.
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const onPick = useCallback(
    (date: IsoDate, roomId: string) => setEdits((e) => ({ ...e, [date]: roomId })),
    [],
  );

  const ready = data.status === 'ready' ? data : null;
  // After a PIN unlocks a field, focus moves to that field (the lock button is disabled by then).
  useEffect(() => {
    if (!focusField || unlocking) return;
    const target =
      focusField === 'room'
        ? bodyRef.current?.querySelector<HTMLElement>('input[aria-label^="Room for night"]')
        : bodyRef.current?.querySelector<HTMLElement>(
            `[data-unlock-field="${focusField}"] [role="combobox"]`,
          );
    target?.focus();
  }, [focusField, unlocking]);
  // One location: the Location select is hidden and no location filter applies.
  const showLocation = ready ? showLocations(ready.inventory.locations) : false;
  const currentRoom = ready?.inventory.rooms.find((r) => r.id === room.roomId);
  // A locked Location or Room Type keeps the rooms to those of the current room.
  const filter = useMemo<RoomFilter>(
    () => ({
      ...pickedFilter,
      locationId: !showLocation
        ? ''
        : locked.has('location')
          ? (currentRoom?.locationId ?? '')
          : pickedFilter.locationId,
      roomTypeId: locked.has('roomType')
        ? (currentRoom?.roomTypeId ?? '')
        : pickedFilter.roomTypeId,
    }),
    [showLocation, pickedFilter, locked, currentRoom],
  );
  useEffect(() => {
    if (focusedFirst.current || !ready || step !== 'plan') return;
    const first = bodyRef.current?.querySelector<HTMLElement>(
      'input[aria-label^="Room for night"]',
    );
    if (first) {
      first.focus();
      focusedFirst.current = true;
    }
  });
  const current: NightRoom[] = useMemo(
    () =>
      ready
        ? planFromBlocks(
            ready.inventory.blocks.filter((b) => stayOf(b) === room.id),
            effectiveDate,
            room.departure,
          )
        : [],
    [ready, room.id, room.departure, effectiveDate],
  );
  // Indexed once: the room options, bookings and closures by room (not per night, not per render).
  const index = useMemo(
    () =>
      ready
        ? buildNightIndex({
            rooms: ready.inventory.rooms,
            locations: ready.inventory.locations,
            roomTypes: ready.inventory.roomTypes,
            blocks: ready.inventory.blocks,
            closures: ready.inventory.closures,
            stay: {
              id: room.id,
              roomTypeLocked: ready.block.roomTypeLocked,
              roomId: ready.block.roomId,
            },
          })
        : null,
    [ready, room.id],
  );
  const carried = useMemo(
    () => (index && initialEdits ? keepValidEdits(initialEdits, current, index) : {}),
    [index, initialEdits, current],
  );
  const plan: NightRoom[] = current.map((n) => ({
    ...n,
    roomId: edits[n.date] ?? carried[n.date] ?? n.roomId,
  }));
  // What the plan changes, and which of those fields are still locked (a reopened dialog can carry
  // choices that touch a locked field): saving would be refused, so Continue says what to unlock.
  const factsOf = (roomId: string) => ready?.inventory.rooms.find((r) => r.id === roomId);
  const changed = changedFields(
    current.flatMap((n, i) => {
      const from = factsOf(n.roomId);
      const to = factsOf(plan[i].roomId);
      return from && to ? [{ from, to }] : [];
    }),
  );
  const toUnlock = fieldsToUnlock(changed, locked);
  const blocker =
    confirmBlocker(current, plan) ?? (toUnlock.length > 0 ? unlockMessage(toUnlock) : null);
  const stayed = stayedNights(room, detail.arrival, effectiveDate);
  const roomsById = useMemo(
    () => new Map((ready?.inventory.rooms ?? []).map((r) => [r.id, r])),
    [ready],
  );
  const rateOf = (roomId: string) => {
    const type = roomsById.get(roomId)?.roomTypeId;
    return ready?.inventory.roomTypes.find((t) => t.id === type)?.nightlyRate ?? null;
  };
  const question =
    ready && step === 'confirm'
      ? rateQuestion({
          detail,
          reservationRoomId: room.id,
          current,
          plan,
          newRateCents: rateOf,
          today,
          ask: ready.rule.askRateOnRoomChange,
        })
      : null;
  // A lock shows only to a user who lacks the function (a user who holds it sees none).
  const lock = (field: UnlockField) =>
    can(UNLOCK_PERMISSION[field]) ? null : (
      <FieldLock
        id={`${id}-lock-${field}`}
        field={field}
        locked={locked.has(field)}
        onUnlock={setUnlocking}
      />
    );
  const title = step === 'plan' ? 'Change Room During Stay' : 'Confirm Room Change';

  const confirm = () => {
    if (submitted.current || !ready || !question || blocker) return;
    submitted.current = true;
    onSubmit({
      request: toChangeRoomRequest({
        block: ready.block,
        plan,
        asked: question.asked,
        answer,
        requestId: newRequestId(),
        // Only a PIN that was needed: with every function held there is no code to send.
        overrideCodes: sentCodes(codes, changed, can),
      }),
      block: ready.block,
      plan,
      stayed: stayedPlan(room, effectiveDate),
      toast: changeToast(current, plan, ready.inventory.rooms),
    });
  };

  const runs = ready ? planRuns(plan, current, ready.inventory.rooms) : [];
  const changedCount = changedNights(current, plan).length;
  const windowed = plan.length > VIRTUALIZE_FROM_NIGHTS;
  const rowPx = parseFloat(theme.spacing(ROW_UNITS));
  const viewportPx = parseFloat(theme.spacing(VIEWPORT_UNITS));
  const rows = windowed ? visibleRows(scrollTop, rowPx, viewportPx, plan.length) : null;
  const row = (n: NightRoom, i: number) =>
    index ? (
      <NightRow
        date={n.date}
        nightNo={daysBetween(detail.arrival, n.date) + 1}
        roomId={n.roomId}
        currentRoomId={current[i].roomId}
        index={index}
        filter={filter}
        dialogId={id}
        locked={locked.has('room')}
        lockId={`${id}-lock-room-why`}
        onPick={onPick}
      />
    ) : null;

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      aria-labelledby={`${id}-title`}
      aria-describedby={step === 'confirm' ? `${id}-message` : undefined}
      slotProps={{ paper: { sx: { maxWidth: (t) => t.spacing(60) } } }}
    >
      <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
      <DialogContent ref={bodyRef}>
        {data.status === 'loading' ? (
          <Box role="status" aria-busy="true" aria-label="Loading rooms">
            <Skeleton width="70%" />
            <Skeleton width="50%" />
            <Skeleton variant="rounded" height={56} sx={{ mt: 2 }} />
          </Box>
        ) : data.status === 'error' ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={data.retry}>
                Retry
              </Button>
            }
          >
            The rooms could not be loaded. Nothing was changed.
          </Alert>
        ) : step === 'plan' ? (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Reservation #{detail.confirmationNumber}. Choose the room for each night that has not
              been stayed yet.
            </Typography>
            {stayed.length > 0 ? (
              <Box
                component="ul"
                aria-label="Nights already stayed"
                sx={{ listStyle: 'none', m: 0, mt: 2, p: 0 }}
              >
                {stayed.map((n) => (
                  <Box
                    component="li"
                    key={n.date}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}
                  >
                    <Typography variant="body2">
                      Night {n.night}: {dateLabel(n.date)} | Room {n.roomNumber ?? ''}
                    </Typography>
                    <ShieldMoon
                      color="info"
                      fontSize="small"
                      titleAccess="Already stayed, cannot be changed"
                    />
                  </Box>
                ))}
              </Box>
            ) : null}
            <Box
              role="group"
              aria-label="Show rooms in"
              sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}
            >
              {showLocation ? (
                <Box
                  data-unlock-field="location"
                  sx={{ display: 'flex', alignItems: 'center', flex: '1 1 12rem' }}
                >
                  <TextField
                    select
                    size="small"
                    label="Location"
                    value={filter.locationId}
                    disabled={locked.has('location')}
                    slotProps={{
                      select: {
                        SelectDisplayProps: (locked.has('location')
                          ? { 'aria-describedby': `${id}-lock-location-why` }
                          : {}) as object,
                      },
                    }}
                    onChange={(e) => setFilter((f) => ({ ...f, locationId: e.target.value }))}
                    sx={{ flex: 1 }}
                  >
                    <MenuItem value="">All locations</MenuItem>
                    {ready?.inventory.locations.map((l) => (
                      <MenuItem key={l.id} value={l.id}>
                        {l.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  {lock('location')}
                </Box>
              ) : null}
              <Box
                data-unlock-field="roomType"
                sx={{ display: 'flex', alignItems: 'center', flex: '1 1 12rem' }}
              >
                <TextField
                  select
                  size="small"
                  label="Room type"
                  value={filter.roomTypeId}
                  disabled={locked.has('roomType')}
                  slotProps={{
                    select: {
                      SelectDisplayProps: (locked.has('roomType')
                        ? { 'aria-describedby': `${id}-lock-roomType-why` }
                        : {}) as object,
                    },
                  }}
                  onChange={(e) => setFilter((f) => ({ ...f, roomTypeId: e.target.value }))}
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="">All room types</MenuItem>
                  {ready?.inventory.roomTypes.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </TextField>
                {lock('roomType')}
              </Box>
            </Box>
            {can(UNLOCK_PERMISSION.room) ? null : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {locked.has('room')
                    ? 'Changing the room needs an override code.'
                    : 'Room unlocked with an override code.'}
                </Typography>
                {lock('room')}
              </Box>
            )}
            {rows ? (
              // Long stays: a scrolling container that renders only the rows in view.
              <Box
                tabIndex={0}
                role="region"
                aria-label="Remaining nights, scroll for more"
                onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                sx={(t) => ({ mt: 1.5, height: t.spacing(VIEWPORT_UNITS), overflow: 'auto' })}
              >
                <Box
                  role="list"
                  aria-label="Remaining nights"
                  style={{ height: plan.length * rowPx, position: 'relative' }}
                >
                  {plan
                    .map((n, i) => ({ n, i }))
                    .filter(({ i }) => (i >= rows.first && i < rows.last) || i === focusedRow)
                    .map(({ n, i }) => {
                      return (
                        <Box
                          role="listitem"
                          key={n.date}
                          aria-posinset={i + 1}
                          aria-setsize={plan.length}
                          onFocus={() => setFocusedRow(i)}
                          onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget)) setFocusedRow(null);
                          }}
                          style={{
                            position: 'absolute',
                            top: i * rowPx,
                            left: 0,
                            right: 0,
                            height: rowPx,
                          }}
                        >
                          {row(n, i)}
                        </Box>
                      );
                    })}
                </Box>
              </Box>
            ) : (
              <Box
                component="ul"
                aria-label="Remaining nights"
                sx={{ listStyle: 'none', m: 0, mt: 1.5, p: 0 }}
              >
                {plan.map((n, i) => (
                  <Box component="li" key={n.date} sx={{ mb: 1.5 }}>
                    {row(n, i)}
                  </Box>
                ))}
              </Box>
            )}
          </>
        ) : ready && question ? (
          <>
            <Typography id={`${id}-message`} variant="body1" component="p" sx={{ m: 0 }}>
              {planSentence(effectiveDate, room.departure)}:
            </Typography>
            <Box component="ul" aria-label="Room plan" sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {runs.map((r) => (
                <li key={`${r.roomId}-${r.startDate}`}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: (t) => (r.changed ? t.typography.fontWeightBold : undefined),
                    }}
                  >
                    {runText(r)}
                    {r.changed ? ' (changed)' : ''}
                  </Typography>
                </li>
              ))}
            </Box>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              {changedCount === 1 ? '1 night changes room.' : `${changedCount} nights change room.`}{' '}
              The reservation stays checked in.
              {stayed.length > 0
                ? stayed.length === 1
                  ? ' The 1 night already stayed keeps its room and price.'
                  : ` The ${nightsText(stayed.length)} already stayed keep their room and price.`
                : ''}
            </Typography>
            {question.asked ? (
              <FormControl sx={{ mt: 2 }}>
                <FormLabel
                  id={`${id}-rate`}
                  sx={{ color: 'text.primary', fontWeight: (t) => t.typography.fontWeightBold }}
                >
                  {question.changedNights === 1
                    ? 'Rate for the 1 night that changes room'
                    : `Rate for the ${nightsText(question.changedNights)} that change room`}
                </FormLabel>
                <RadioGroup
                  aria-labelledby={`${id}-rate`}
                  value={answer}
                  onChange={(_, value) => setAnswer(value as RateChoice)}
                >
                  <FormControlLabel
                    value="retain"
                    control={<Radio />}
                    label={`Retain the current rate (${perNight(question.currentRate)})`}
                  />
                  <FormControlLabel
                    value="update"
                    control={<Radio />}
                    label={
                      question.newRate
                        ? `Update to the new ${question.newRooms === 1 ? "room's rate" : "rooms' rates"} (${perNight(question.newRate)}, ${signedMoney(question.updateDeltaCents)} for ${nightsText(question.repricedNights)})`
                        : `Update to the new ${question.newRooms === 1 ? "room's rate" : "rooms' rates"}`
                    }
                  />
                </RadioGroup>
              </FormControl>
            ) : question.ratesDiffer && question.newRate ? (
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {question.newRooms === 1 ? "The new room's rate" : "The new rooms' rates"} (
                {perNight(question.newRate)}){' '}
                {question.changedNights === 1
                  ? 'applies to the 1 night that changes room.'
                  : `apply to the ${nightsText(question.changedNights)} that change room.`}
              </Typography>
            ) : null}
          </>
        ) : null}
        {step === 'plan' && ready && blocker ? (
          <Typography
            id={`${id}-blocker`}
            variant="caption"
            component="p"
            sx={{ color: 'text.secondary', mt: 1 }}
          >
            {blocker}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        {step === 'confirm' ? <Button onClick={() => setStep('plan')}>Back</Button> : null}
        <Button
          variant="outlined"
          onClick={onCancel}
          sx={{ borderColor: 'primary.outlinedBorder' }}
        >
          Cancel
        </Button>
        {step === 'plan' ? (
          <Button
            variant="contained"
            disabled={!ready || blocker !== null}
            aria-describedby={blocker ? `${id}-blocker` : undefined}
            onClick={() => setStep('confirm')}
          >
            Continue
          </Button>
        ) : (
          <Button ref={focusOnMount} variant="contained" onClick={confirm}>
            Update Reservation
          </Button>
        )}
      </DialogActions>
      {unlocking ? (
        <OverridePinDialog
          open
          title="Enter override code to unlock"
          confirmLabel="Unlock"
          permission={UNLOCK_PERMISSION[unlocking]}
          lockedForSeconds={initialLockedFor}
          onAuthorized={(pin) => {
            setUnlocked((u) => new Set(u).add(unlocking));
            setCodes((c) => ({ ...c, [unlocking]: pin }));
            setFocusField(unlocking);
            setUnlocking(null);
          }}
          onCancel={() => setUnlocking(null)}
        />
      ) : null}
    </Dialog>
  );
}
