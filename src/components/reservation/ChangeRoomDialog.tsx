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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useId, useMemo, useRef, useState } from 'react';
import type {
  ChangeRoomRequest,
  NightRoom,
  RateChoice,
  ReservationDetail,
  ReservationRoomDetail,
  ScheduleBlock,
} from '../../api';
import {
  changeToast,
  confirmBlocker,
  filterChoices,
  nightChoices,
  nightsText,
  NO_ROOM_FILTER,
  planRuns,
  planSentence,
  rateQuestion,
  runText,
  signedMoney,
  stayedNights,
  toChangeRoomRequest,
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
  /** What the toast says once it is done ("Moved to Room 205"). */
  toast: string;
}

export interface ChangeRoomDialogProps {
  detail: ReservationDetail;
  room: ReservationRoomDetail;
  /** The first night not yet stayed (today, or the arrival if later). */
  effectiveDate: IsoDate;
  today: IsoDate;
  /** Cancel, Escape and the backdrop: nothing was changed. */
  onCancel: () => void;
  onSubmit: (submission: RoomChangeSubmission) => void;
}

const dateLabel = formatPanelDate;
/** "$199.00 per night", or "varies by night" as it is. */
const perNight = (rate: string) => (rate.startsWith('$') ? `${rate} per night` : rate);

/**
 * Change Room During Stay (Figma 1326:19431 and the room menu 2623:14538; requirements 27.9.1.2).
 * Step 1 shows the stay one night per line: nights already stayed are locked (shield icon), every
 * remaining night has its own room menu listing the rooms available on that night (searchable,
 * grouped "location | room type", disabled rooms with the reason), with an optional Location and Room
 * Type filter. Step 2 confirms the resulting room plan and, when the setting asks and the rates of
 * the changed nights differ, whether to retain the current rate or update to the new rooms' rates.
 * Cancel and Escape leave everything unchanged; the primary action takes focus and works once.
 */
export default function ChangeRoomDialog({
  detail,
  room,
  effectiveDate,
  today,
  onCancel,
  onSubmit,
}: ChangeRoomDialogProps) {
  const id = useId();
  const data = useChangeRoomData(room.id, effectiveDate, room.departure);
  const [step, setStep] = useState<'plan' | 'confirm'>('plan');
  // The rooms chosen so far, by night; a night not listed keeps its current room.
  const [edits, setEdits] = useState<Record<IsoDate, string>>({});
  const [filter, setFilter] = useState<RoomFilter>(NO_ROOM_FILTER);
  const [answer, setAnswer] = useState<RateChoice>('retain');
  const submitted = useRef(false);

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
  const plan: NightRoom[] = current.map((n) => ({ ...n, roomId: edits[n.date] ?? n.roomId }));
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
  const question = ready
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

  const choicesFor = (date: IsoDate, currentRoomId: string): RoomChoice[] =>
    ready
      ? nightChoices({
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
          date,
          currentRoomId,
        })
      : [];

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
      toast: changeToast(current, plan, ready.inventory.rooms),
    });
  };

  const runs = ready ? planRuns(plan, current, ready.inventory.rooms) : [];
  const changedCount = changedNights(current, plan).length;

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
            <Box
              component="ul"
              aria-label="Remaining nights"
              sx={{ listStyle: 'none', m: 0, mt: 1.5, p: 0 }}
            >
              {plan.map((n, i) => {
                const nightNo = daysBetween(detail.arrival, n.date) + 1;
                const choices = filterChoices(
                  choicesFor(n.date, current[i].roomId),
                  filter,
                  n.roomId,
                );
                const value = choices.find((c) => c.option.id === n.roomId) ?? null;
                const changed = n.roomId !== current[i].roomId;
                return (
                  <Box component="li" key={n.date} sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      Night {nightNo}: {dateLabel(n.date)}
                    </Typography>
                    <Autocomplete<RoomChoice, false, true>
                      size="small"
                      disableClearable
                      options={choices}
                      value={value as RoomChoice}
                      onChange={(_, choice) => {
                        // A disabled room cannot be chosen, however the event arrives.
                        if (choice.disabled) return;
                        setEdits((e) => ({ ...e, [n.date]: choice.option.id }));
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
                          <ListSubheader component="div" sx={{ top: -8 }}>
                            {params.group}
                          </ListSubheader>
                          <ul style={{ padding: 0 }}>{params.children}</ul>
                        </li>
                      )}
                      renderOption={({ key, ...props }, choice) => {
                        const reasonId = `${id}-${n.date}-reason-${choice.option.id}`;
                        const note = choice.reason ?? (choice.current ? 'Current room' : null);
                        return (
                          <li
                            key={key}
                            {...props}
                            aria-describedby={choice.reason ? reasonId : undefined}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 2,
                                width: '100%',
                              }}
                            >
                              <span>{choice.option.label}</span>
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
                          </li>
                        );
                      }}
                      slotProps={{
                        popupIndicator: { 'aria-label': 'Show rooms', title: 'Show rooms' },
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          hiddenLabel
                          placeholder="Search by room number, location or room type"
                          autoFocus={i === 0}
                          slotProps={{
                            ...params.slotProps,
                            htmlInput: {
                              ...params.slotProps?.htmlInput,
                              'aria-label': `Room for night ${nightNo}, ${dateLabel(n.date)}`,
                            },
                          }}
                          helperText={
                            changed
                              ? `Was Room ${roomsById.get(current[i].roomId)?.number ?? ''}`
                              : undefined
                          }
                        />
                      )}
                    />
                  </Box>
                );
              })}
            </Box>
          </>
        ) : ready && question ? (
          <>
            <Typography id={`${id}-message`} variant="body1" component="p" sx={{ m: 0 }}>
              {planSentence(effectiveDate, room.departure)}:
            </Typography>
            <Box component="ul" aria-label="Room plan" sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {runs.map((r) => (
                <li key={`${r.roomId}-${r.startDate}`}>
                  <Typography variant="body2" sx={{ fontWeight: r.changed ? 700 : 400 }}>
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
                ? ` The ${nightsText(stayed.length)} already stayed keep their room and price.`
                : ''}
            </Typography>
            {question.asked ? (
              <FormControl sx={{ mt: 2 }}>
                <FormLabel id={`${id}-rate`} sx={{ color: 'text.primary', fontWeight: 700 }}>
                  Rate for the {nightsText(question.changedNights)} that change room
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
                        ? `Update to the new rooms' rates (${perNight(question.newRate)}, ${signedMoney(question.updateDeltaCents)} for ${nightsText(question.repricedNights)})`
                        : "Update to the new rooms' rates"
                    }
                  />
                </RadioGroup>
              </FormControl>
            ) : question.ratesDiffer && question.newRate ? (
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                The new rooms&apos; rate ({perNight(question.newRate)}) applies to the{' '}
                {nightsText(question.changedNights)} that change room.
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
