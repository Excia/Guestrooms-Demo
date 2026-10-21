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
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useId, useMemo, useRef, useState } from 'react';
import type {
  ChangeRoomRequest,
  RateChoice,
  ReservationDetail,
  ReservationRoomDetail,
  ScheduleBlock,
} from '../../api';
import {
  changeRoomSummary,
  nightsText,
  rateQuestion,
  roomChoices,
  signedMoney,
  stayedNights,
  toChangeRoomRequest,
  type RoomChoice,
} from '../../app/changeRoom';
import { formatPanelDate } from '../../app/newReservation';
import { filterRoomOptions } from '../../app/roomOptions';
import { daysBetween, type IsoDate } from '../../lib/dates';
import { newRequestId } from '../../lib/requestId';
import { focusOnMount } from '../shared/focusOnMount';
import { useChangeRoomData } from './useChangeRoomData';

/** A confirmed room change, handed to the schedule page, which applies it and sends the request. */
export interface RoomChangeSubmission {
  request: ChangeRoomRequest;
  /** The reservation room as the user saw it: what an optimistic update starts from and reverts to. */
  block: ScheduleBlock;
  fromRoomNumber: string;
  toRoomNumber: string;
}

export interface ChangeRoomDialogProps {
  detail: ReservationDetail;
  room: ReservationRoomDetail;
  /** The first night that moves (today, or the arrival if later). */
  effectiveDate: IsoDate;
  today: IsoDate;
  /** Cancel, Escape and the backdrop: nothing was changed. */
  onCancel: () => void;
  onSubmit: (submission: RoomChangeSubmission) => void;
}

const dateLabel = formatPanelDate;

/**
 * Change Room During Stay (Figma 1326:19431 and the room menu 2623:14538). Step 1 chooses the new
 * room from a searchable menu grouped like the Room field (location | room type); rooms that cannot
 * take the remaining nights are shown disabled with the reason. Step 2 confirms old and new room and
 * the effective dates and, when the setting asks and the rates differ, whether to retain the current
 * rate or update to the new room's. Cancel and Escape leave everything unchanged; the primary action
 * takes focus and can only be used once.
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
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [picked, setPicked] = useState<RoomChoice | null>(null);
  const [answer, setAnswer] = useState<RateChoice>('retain');
  const submitted = useRef(false);

  const choices = useMemo(
    () =>
      data.status === 'ready'
        ? roomChoices({
            rooms: data.inventory.rooms,
            locations: data.inventory.locations,
            roomTypes: data.inventory.roomTypes,
            blocks: data.inventory.blocks,
            closures: data.inventory.closures,
            current: data.block,
            effectiveDate,
          })
        : [],
    [data, effectiveDate],
  );
  const stayed = stayedNights(room, detail.arrival, effectiveDate);
  const fromNumber = room.roomNumber ?? '';
  const nights = Math.max(0, daysBetween(effectiveDate, room.departure));

  const newRoomType =
    data.status === 'ready' && picked
      ? data.inventory.roomTypes.find(
          (t) => t.id === data.inventory.rooms.find((r) => r.id === picked.option.id)?.roomTypeId,
        )
      : undefined;
  const question =
    data.status === 'ready' && picked
      ? rateQuestion({
          detail,
          reservationRoomId: room.id,
          newRateCents: newRoomType?.nightlyRate ?? null,
          effectiveDate,
          today,
          ask: data.rule.askRateOnRoomChange,
        })
      : null;

  const title = step === 'pick' ? 'Change Room During Stay' : 'Confirm Room Change';

  const confirm = () => {
    if (submitted.current || data.status !== 'ready' || !picked || !question) return;
    submitted.current = true;
    onSubmit({
      request: toChangeRoomRequest({
        block: data.block,
        toRoomId: picked.option.id,
        effectiveDate,
        asked: question.asked,
        answer,
        requestId: newRequestId(),
      }),
      block: data.block,
      fromRoomNumber: fromNumber,
      toRoomNumber: picked.option.number,
    });
  };

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
        ) : step === 'pick' ? (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Reservation #{detail.confirmationNumber}, currently in Room {fromNumber}
            </Typography>
            {stayed.length > 0 ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700 }}>
                  Nights already stayed
                </Typography>
                <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                  They keep their room and their price.
                </Typography>
                <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 0.5, p: 0 }}>
                  {stayed.map((n) => (
                    <Box
                      component="li"
                      key={n.date}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}
                    >
                      <Typography variant="body2">
                        Night {n.night}: {dateLabel(n.date)} | Room {n.roomNumber ?? ''}
                      </Typography>
                      <ShieldMoon aria-hidden color="info" fontSize="small" />
                    </Box>
                  ))}
                </Box>
              </Box>
            ) : null}
            <Typography variant="body2" sx={{ mt: 2, mb: 1.5 }}>
              From {dateLabel(effectiveDate)} through {dateLabel(room.departure)} (
              {nightsText(nights)}) the stay moves to the room you choose.
            </Typography>
            <Autocomplete<RoomChoice>
              options={choices}
              value={picked}
              onChange={(_, choice) => {
                setPicked(choice);
                setAnswer('retain');
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
              openOnFocus
              renderGroup={(params) => (
                <li key={params.key}>
                  <ListSubheader component="div" sx={{ top: -8 }}>
                    {params.group}
                  </ListSubheader>
                  <ul style={{ padding: 0 }}>{params.children}</ul>
                </li>
              )}
              renderOption={({ key, ...props }, choice) => {
                const reasonId = `${id}-reason-${choice.option.id}`;
                return (
                  <li key={key} {...props} aria-describedby={choice.reason ? reasonId : undefined}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 2,
                        width: '100%',
                      }}
                    >
                      <span>{choice.option.label}</span>
                      {choice.reason ? (
                        <Typography
                          id={reasonId}
                          variant="body2"
                          component="span"
                          sx={{ color: 'text.secondary' }}
                        >
                          {choice.reason}
                        </Typography>
                      ) : null}
                    </Box>
                  </li>
                );
              }}
              slotProps={{
                popupIndicator: { 'aria-label': 'Show rooms', title: 'Show rooms' },
                clearIndicator: { 'aria-label': 'Clear room', title: 'Clear room' },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="New room"
                  placeholder="Search by room number, location or room type"
                  autoFocus
                />
              )}
            />
          </>
        ) : picked && question ? (
          <>
            <Typography id={`${id}-message`} variant="body1" component="p" sx={{ m: 0 }}>
              {
                changeRoomSummary({
                  fromNumber,
                  toNumber: picked.option.number,
                  effectiveDate,
                  departure: room.departure,
                }).sentence
              }
              .
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              The reservation stays checked in.
              {stayed.length > 0
                ? ` The ${nightsText(stayed.length)} already stayed stay in Room ${fromNumber} at their original price.`
                : ''}
            </Typography>
            {question.asked ? (
              <FormControl sx={{ mt: 2 }}>
                <FormLabel id={`${id}-rate`} sx={{ color: 'text.primary', fontWeight: 700 }}>
                  Rate for the remaining {nightsText(nights)}
                </FormLabel>
                <RadioGroup
                  aria-labelledby={`${id}-rate`}
                  value={answer}
                  onChange={(_, value) => setAnswer(value as RateChoice)}
                >
                  <FormControlLabel
                    value="retain"
                    control={<Radio />}
                    label={`Retain the current rate (${question.currentRate} per night)`}
                  />
                  <FormControlLabel
                    value="update"
                    control={<Radio />}
                    label={
                      question.newRate
                        ? `Update to the new room's rate (${question.newRate} per night, ${signedMoney(question.updateDeltaCents)} for ${nightsText(question.repricedNights)})`
                        : "Update to the new room's rate"
                    }
                  />
                </RadioGroup>
              </FormControl>
            ) : question.ratesDiffer && question.newRate ? (
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                The new room&apos;s rate ({question.newRate} per night) applies to the remaining{' '}
                {nightsText(nights)}.
              </Typography>
            ) : null}
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        {step === 'confirm' ? <Button onClick={() => setStep('pick')}>Back</Button> : null}
        <Button
          variant="outlined"
          onClick={onCancel}
          sx={{ borderColor: 'primary.outlinedBorder' }}
        >
          Cancel
        </Button>
        {step === 'pick' ? (
          <Button
            variant="contained"
            disabled={data.status !== 'ready' || !picked}
            onClick={() => setStep('confirm')}
          >
            Continue
          </Button>
        ) : (
          <Button ref={focusOnMount} variant="contained" onClick={confirm}>
            Move to New Room
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
