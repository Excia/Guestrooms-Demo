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
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { memo, useCallback, useId, useMemo, useRef, useState } from 'react';
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
import { filterRoomOptions } from '../../app/roomOptions';
import { daysBetween, type IsoDate } from '../../lib/dates';
import { newRequestId } from '../../lib/requestId';
import { changedNights, planFromBlocks, stayOf } from '../../lib/stayPlan';
import { focusOnMount } from '../shared/focusOnMount';
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
  autoFocus: boolean;
  dialogId: string;
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
  autoFocus,
  dialogId,
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
              // A disabled option stays readable: the dimming (0.38 opacity) would put its reason
              // below the 4.5:1 contrast, so the text colours carry the state instead.
              sx={{ '&.Mui-disabled': { opacity: 1 } }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, width: '100%' }}>
                <Box
                  component="span"
                  sx={{ color: choice.disabled ? 'text.secondary' : 'text.primary' }}
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
            autoFocus={autoFocus}
            slotProps={{
              ...params.slotProps,
              htmlInput: {
                ...params.slotProps?.htmlInput,
                'aria-label': `Room for night ${nightNo}, ${dateLabel(date)}`,
              },
            }}
            helperText={changed ? `Was Room ${wasNumber}` : undefined}
          />
        )}
      />
    </>
  );
});

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
  const [filter, setFilter] = useState<RoomFilter>(NO_ROOM_FILTER);
  const [answer, setAnswer] = useState<RateChoice>('retain');
  const [scrollTop, setScrollTop] = useState(0);
  const submitted = useRef(false);
  const onPick = useCallback(
    (date: IsoDate, roomId: string) => setEdits((e) => ({ ...e, [date]: roomId })),
    [],
  );

  const ready = data.status === 'ready' ? data : null;
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
  const blocker = confirmBlocker(current, plan);
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
        autoFocus={i === 0}
        dialogId={id}
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
      <DialogContent>
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
              <TextField
                select
                size="small"
                label="Location"
                value={filter.locationId}
                onChange={(e) => setFilter((f) => ({ ...f, locationId: e.target.value }))}
                sx={{ flex: '1 1 12rem' }}
              >
                <MenuItem value="">All locations</MenuItem>
                {ready?.inventory.locations.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Room type"
                value={filter.roomTypeId}
                onChange={(e) => setFilter((f) => ({ ...f, roomTypeId: e.target.value }))}
                sx={{ flex: '1 1 12rem' }}
              >
                <MenuItem value="">All room types</MenuItem>
                {ready?.inventory.roomTypes.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
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
                  {plan.slice(rows.first, rows.last).map((n, k) => {
                    const i = rows.first + k;
                    return (
                      <Box
                        role="listitem"
                        key={n.date}
                        aria-posinset={i + 1}
                        aria-setsize={plan.length}
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
    </Dialog>
  );
}
