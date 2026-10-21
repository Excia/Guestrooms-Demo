import AddCircle from '@mui/icons-material/AddCircle';
import RemoveCircle from '@mui/icons-material/RemoveCircle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useId, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { stayLimits } from '../app/dateRange';
import { addDays, todayIso } from '../app/dateSelection';
import type { WeekStartDay } from '../lib/calendar';
import { PLACEHOLDER_LOCATIONS, type SearchLocation } from '../app/placeholderLocations';
import {
  ALL_LOCATIONS_VALUE,
  MAX_ADULTS,
  MAX_ADVANCE_DAYS,
  MAX_CHILDREN,
  MAX_ROOMS,
  MAX_STAY_NIGHTS,
  MIN_ADULTS,
  MIN_CHILDREN,
  canAddRoom,
  dateHint,
  hintRepeatsFieldError,
  datesAreValid,
  initialRooms,
  nightsBetween,
  roomsReducer,
  searchLabel,
  searchUrl,
  validateDates,
  visibleDateErrors,
  type SearchCriteria,
} from '../app/reservationSearch';
import DateField, { type DateFieldRange } from './shared/DateField';
import CountStepper from './shared/CountStepper';
import Select from './shared/Select';

export interface NewReservationSearchProps {
  /** Defaults to navigating to the search results route with the criteria in the URL. */
  onSearch?: (criteria: SearchCriteria) => void;
  locations?: readonly SearchLocation[];
  /** Local calendar date treated as "today"; injectable for tests. */
  today?: string;
  /** First day of the week in the calendars (Sunday until club settings supply it). */
  weekStartsOn?: WeekStartDay;
}

/**
 * New Reservation search panel (Figma 69:3803): dates, location, rooms with guests, and the CTA.
 * The Figma layer named "Occasion Field" is a second Location field (it shows "All Locations"), so
 * there is no Occasion field. Rules live in app/reservationSearch.ts.
 */
export default function NewReservationSearch({
  onSearch,
  locations = PLACEHOLDER_LOCATIONS,
  today: todayProp,
  weekStartsOn,
}: NewReservationSearchProps) {
  const navigate = useNavigate();
  const today = todayProp ?? todayIso();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [touched, setTouched] = useState({ checkIn: false, checkOut: false });
  const [location, setLocation] = useState(ALL_LOCATIONS_VALUE);
  const [rooms, dispatch] = useReducer(roomsReducer, undefined, initialRooms);

  const errors = validateDates(checkIn, checkOut, today);
  const valid = datesAreValid(checkIn, checkOut, today);
  const hint = dateHint(checkIn, checkOut, today);
  const shown = visibleDateErrors(checkIn, checkOut, touched, today);
  const hintRepeated = hintRepeatsFieldError(checkIn, checkOut, touched, today);
  // One calendar serves both fields; the first click is the check-in, the second the check-out.
  const range = (role: 'from' | 'to'): DateFieldRange => ({
    role,
    from: checkIn,
    to: checkOut,
    limits: stayLimits(today, MAX_ADVANCE_DAYS, MAX_STAY_NIGHTS),
    endNames: ['check-in', 'check-out'],
    onChange: (r) => {
      setCheckIn(r.from);
      setCheckOut(r.to);
    },
  });
  const hintId = useId();
  const maxRoomsId = useId();

  // Focus management: after adding, the new room's first control; after removing, the Remove Room
  // button of the room before the deleted one, or Add Another Room when that is Room 1.
  type FocusRequest = { kind: 'new-room'; id: number } | { kind: 'remove'; id: number | null };
  const focusRequest = useRef<FocusRequest | null>(null);
  const firstStepperRefs = useRef(new Map<number, HTMLButtonElement | null>());
  const removeRefs = useRef(new Map<number, HTMLButtonElement | null>());
  const addRef = useRef<HTMLButtonElement>(null);
  const checkInRef = useRef<HTMLInputElement>(null);
  const checkOutRef = useRef<HTMLInputElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const roomCount = rooms.length;
  useEffect(() => {
    const request = focusRequest.current;
    focusRequest.current = null;
    if (!request) return;
    if (request.kind === 'new-room') firstStepperRefs.current.get(request.id)?.focus();
    else (request.id === null ? addRef.current : removeRefs.current.get(request.id))?.focus();
  }, [roomCount]);

  // Ref callbacks keyed by room id (read only when React attaches or detaches the element).
  const track = (kind: 'remove' | 'stepper', id: number) => (el: HTMLButtonElement | null) => {
    const map = kind === 'remove' ? removeRefs.current : firstStepperRefs.current;
    if (el) map.set(id, el);
    else map.delete(id);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const criteria: SearchCriteria = {
      checkIn,
      checkOut,
      location,
      rooms: rooms.map(({ adults, children }) => ({ adults, children })),
    };
    if (onSearch) onSearch(criteria);
    else void navigate(searchUrl(criteria));
  };

  // Enter in a field does not submit while the CTA is disabled, so explain instead of doing nothing.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' || valid || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    setTouched({ checkIn: true, checkOut: true });
    setAnnouncement(hint);
    (errors.checkIn ? checkInRef : checkOutRef).current?.focus();
  };

  return (
    <Box
      component="form"
      noValidate
      onSubmit={submit}
      onKeyDown={handleKeyDown}
      aria-label="Search available rooms"
      sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <Typography variant="body1" component="h3" sx={{ fontWeight: 'bold' }}>
        Search Available Rooms
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.875 }}>
        <Box sx={{ display: 'flex', gap: 1.875, alignItems: 'flex-start' }}>
          <DateField
            label="Check In"
            today={today}
            inputRef={checkInRef}
            value={checkIn}
            onChange={setCheckIn}
            onBlur={() => setTouched((t) => ({ ...t, checkIn: true }))}
            error={Boolean(shown.checkIn)}
            helperText={shown.checkIn || undefined}
            required
            min={today}
            max={addDays(today, MAX_ADVANCE_DAYS)}
            range={range('from')}
            weekStartsOn={weekStartsOn}
          />
          <DateField
            label="Check Out"
            today={today}
            inputRef={checkOutRef}
            value={checkOut}
            onChange={setCheckOut}
            onBlur={() => setTouched((t) => ({ ...t, checkOut: true }))}
            error={Boolean(shown.checkOut)}
            helperText={shown.checkOut || undefined}
            required
            min={addDays(errors.checkIn ? today : checkIn || today, 1)}
            max={errors.checkIn || !checkIn ? undefined : addDays(checkIn, MAX_STAY_NIGHTS)}
            range={range('to')}
            weekStartsOn={weekStartsOn}
          />
        </Box>

        <Select
          label="Location"
          value={location}
          options={[
            { value: ALL_LOCATIONS_VALUE, label: 'All Locations' },
            ...locations.map((l) => ({ value: l.id, label: l.name })),
          ]}
          onChange={setLocation}
          fullWidth
        />

        <Box
          component="fieldset"
          sx={{ border: 0, m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <Typography variant="subtitle2" component="legend" sx={{ mb: 1 }}>
            Guests
          </Typography>
          {rooms.map((room, i) => {
            const n = i + 1;
            return (
              <Box
                key={room.id}
                role="group"
                aria-label={`Room ${n}`}
                sx={(t) => ({
                  border: `1px solid ${t.palette.grey[400]}`,
                  borderRadius: 2.5,
                  p: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.875,
                })}
              >
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Typography variant="subtitle2" color="primary">
                    Room {n}
                  </Typography>
                  {i > 0 ? (
                    <Button
                      ref={track('remove', room.id)}
                      size="small"
                      color="error"
                      startIcon={<RemoveCircle aria-hidden />}
                      aria-label={`Remove Room ${n}`}
                      onClick={() => {
                        focusRequest.current = {
                          kind: 'remove',
                          id: i > 1 ? rooms[i - 1].id : null,
                        };
                        dispatch({ type: 'removeRoom', index: i });
                        setAnnouncement(`Room ${n} removed`);
                      }}
                    >
                      Remove Room
                    </Button>
                  ) : null}
                </Box>
                <Box sx={{ display: 'flex', gap: 1.75, flexWrap: 'wrap' }}>
                  <CountStepper
                    title="Adults"
                    noun="adults"
                    roomNumber={n}
                    label={`Adults, Room ${n}`}
                    value={room.adults}
                    min={MIN_ADULTS}
                    max={MAX_ADULTS}
                    firstRef={track('stepper', room.id)}
                    onChange={(value) => dispatch({ type: 'setAdults', index: i, value })}
                  />
                  <CountStepper
                    title="Children"
                    noun="children"
                    roomNumber={n}
                    label={`Children, Room ${n}`}
                    value={room.children}
                    min={MIN_CHILDREN}
                    max={MAX_CHILDREN}
                    onChange={(value) => dispatch({ type: 'setChildren', index: i, value })}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Button
        ref={addRef}
        size="large"
        startIcon={<AddCircle aria-hidden />}
        aria-label="Add Another Room"
        aria-describedby={canAddRoom(rooms) ? undefined : maxRoomsId}
        disabled={!canAddRoom(rooms)}
        onClick={() => {
          focusRequest.current = {
            kind: 'new-room',
            id: Math.max(0, ...rooms.map((r) => r.id)) + 1,
          };
          dispatch({ type: 'addRoom' });
          setAnnouncement(`Room ${roomCount + 1} added`);
        }}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add Another Room
      </Button>

      {canAddRoom(rooms) ? null : (
        <Typography id={maxRoomsId} variant="caption" sx={{ color: 'text.secondary' }}>
          Maximum of {MAX_ROOMS} rooms
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={!valid}
          aria-describedby={valid ? undefined : hintId}
        >
          {searchLabel(valid ? nightsBetween(checkIn, checkOut) : NaN)}
        </Button>
        {valid ? null : (
          <Typography
            id={hintId}
            variant="caption"
            // Guidance only; a message a field already shows as an error is not repeated visibly.
            sx={[{ color: 'text.secondary' }, hintRepeated && visuallyHidden]}
          >
            {hint}
          </Typography>
        )}
      </Box>

      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {announcement}
      </Box>
    </Box>
  );
}
