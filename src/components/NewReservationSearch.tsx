import AddCircle from '@mui/icons-material/AddCircle';
import RemoveCircle from '@mui/icons-material/RemoveCircle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useId, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { addDays, todayIso } from '../app/dateSelection';
import { PLACEHOLDER_LOCATIONS, type SearchLocation } from '../app/placeholderLocations';
import {
  ALL_LOCATIONS_VALUE,
  MAX_ADULTS,
  MAX_CHILDREN,
  MIN_ADULTS,
  MIN_CHILDREN,
  canAddRoom,
  datesAreValid,
  formatCount,
  initialRooms,
  nightsBetween,
  roomsReducer,
  searchLabel,
  searchUrl,
  validateDates,
  type SearchCriteria,
} from '../app/reservationSearch';
import Select from './shared/Select';

export interface NewReservationSearchProps {
  /** Defaults to navigating to the search results route with the criteria in the URL. */
  onSearch?: (criteria: SearchCriteria) => void;
  locations?: readonly SearchLocation[];
  /** Local calendar date treated as "today"; injectable for tests. */
  today?: string;
}

interface StepperProps {
  label: string; // e.g. "Adults, Room 2"
  title: string; // visible heading, e.g. "Adults"
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  firstRef?: React.Ref<HTMLButtonElement>;
}

// Figma 69:3818: label above an outlined button group (minus, value, plus).
function Stepper({ label, title, value, min, max, onChange, firstRef }: StepperProps) {
  const id = useId();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
      <Typography
        id={id}
        variant="body2"
        component="span"
        color="text.secondary"
        sx={{ fontWeight: 'bold' }}
      >
        {title}
      </Typography>
      <ButtonGroup role="group" aria-label={label} variant="outlined" color="primary">
        <Button
          ref={firstRef}
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          —
        </Button>
        <Button
          // Display only: announced politely when it changes, never a tab stop.
          role="status"
          tabIndex={-1}
          disableRipple
          sx={{ pointerEvents: 'none', color: 'text.primary', minWidth: (t) => t.spacing(5.5) }}
        >
          {formatCount(value)}
        </Button>
        <Button
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </Button>
      </ButtonGroup>
    </Box>
  );
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
  const nights = nightsBetween(checkIn, checkOut);
  const showError = (key: 'checkIn' | 'checkOut', value: string) =>
    (touched[key] || value !== '') && errors[key];

  // Focus management: after adding, the new room's first control; after removing, the previous
  // room's Remove Room button (or Add Another Room when that is Room 1).
  const focusRequest = useRef<'new-room' | 'after-remove' | null>(null);
  const firstStepperRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const removeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const addRef = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const roomCount = rooms.length;
  useEffect(() => {
    const request = focusRequest.current;
    focusRequest.current = null;
    if (request === 'new-room') {
      firstStepperRefs.current[roomCount - 1]?.focus();
    } else if (request === 'after-remove') {
      (removeRefs.current[roomCount - 1] ?? addRef.current)?.focus();
    }
  }, [roomCount]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ checkIn: true, checkOut: true });
    if (!valid) return;
    const criteria: SearchCriteria = { checkIn, checkOut, location, rooms };
    if (onSearch) onSearch(criteria);
    else void navigate(searchUrl(criteria));
  };

  return (
    <Box
      component="form"
      noValidate
      onSubmit={submit}
      aria-label="Search available rooms"
      sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <Typography variant="body1" component="h3" sx={{ fontWeight: 'bold' }}>
        Search Available Rooms
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.875 }}>
        <Box sx={{ display: 'flex', gap: 1.875, alignItems: 'flex-start' }}>
          <TextField
            type="date"
            label="Check In"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, checkIn: true }))}
            error={Boolean(showError('checkIn', checkIn))}
            helperText={showError('checkIn', checkIn) || undefined}
            fullWidth
            sx={{ minWidth: 0 }}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: today, 'aria-required': true },
            }}
          />
          <TextField
            type="date"
            label="Check Out"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, checkOut: true }))}
            error={Boolean(showError('checkOut', checkOut))}
            helperText={showError('checkOut', checkOut) || undefined}
            fullWidth
            sx={{ minWidth: 0 }}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: {
                min: addDays(errors.checkIn ? today : checkIn || today, 1),
                'aria-required': true,
              },
            }}
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
                key={n}
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
                      ref={(el) => {
                        removeRefs.current[i] = el;
                      }}
                      size="small"
                      color="error"
                      startIcon={<RemoveCircle />}
                      aria-label={`Remove Room ${n}`}
                      onClick={() => {
                        focusRequest.current = 'after-remove';
                        dispatch({ type: 'removeRoom', index: i });
                        setAnnouncement(`Room ${n} removed`);
                      }}
                    >
                      Remove Room
                    </Button>
                  ) : null}
                </Box>
                <Box sx={{ display: 'flex', gap: 1.75, flexWrap: 'wrap' }}>
                  <Stepper
                    title="Adults"
                    label={`Adults, Room ${n}`}
                    value={room.adults}
                    min={MIN_ADULTS}
                    max={MAX_ADULTS}
                    firstRef={(el) => {
                      firstStepperRefs.current[i] = el;
                    }}
                    onChange={(value) => dispatch({ type: 'setAdults', index: i, value })}
                  />
                  <Stepper
                    title="Children"
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
        startIcon={<AddCircle />}
        disabled={!canAddRoom(rooms)}
        onClick={() => {
          focusRequest.current = 'new-room';
          dispatch({ type: 'addRoom' });
          setAnnouncement(`Room ${roomCount + 1} added`);
        }}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add Another Room
      </Button>

      <Button type="submit" variant="contained" size="large" fullWidth disabled={!valid}>
        {searchLabel(nights)}
      </Button>

      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {announcement}
      </Box>
    </Box>
  );
}
