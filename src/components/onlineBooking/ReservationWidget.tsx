import AddCircle from '@mui/icons-material/AddCircle';
import RemoveCircle from '@mui/icons-material/RemoveCircle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useId, useReducer, useRef, useState, type FormEvent } from 'react';
import { stayLimits } from '../../app/dateRange';
import { addDays, todayIso } from '../../app/dateSelection';
import {
  ALL_LOCATIONS_VALUE,
  DEFAULT_BOOKING_LIMITS,
  bookingDatesValid,
  bookingRoomsReducer,
  bookingSearchUrl,
  canAddBookingRoom,
  criteriaDiffer,
  defaultBookingCriteria,
  initialBookingRooms,
  maxAdults,
  maxChildren,
  nightsBetween,
  searchStayLabel,
  validateBookingDates,
  type BookingLimits,
  type SearchCriteria,
} from '../../app/bookingSearch';
import type { WeekStartDay } from '../../lib/calendar';
import { PLACEHOLDER_LOCATIONS, type SearchLocation } from '../../app/placeholderLocations';
import CountStepper from '../shared/CountStepper';
import DateField, { type DateFieldRange } from '../shared/DateField';
import Select from '../shared/Select';

export interface ReservationFormProps {
  /** Starting values (the widget's defaults when omitted; the current results criteria in Adjust Search). */
  initial?: SearchCriteria;
  locations?: readonly SearchLocation[];
  limits?: BookingLimits;
  /** Customizable per club ("Children" by default). */
  childrenLabel?: string;
  /** Global online booking message (Admin Setup 7.9, 150 characters); no box when empty. */
  globalMessage?: string;
  /**
   * 'search': the widget's "Search X Night Stay" button. 'update': Adjust Search's "Update Search"
   * button, plus the notice that shows while the options differ from the last search.
   */
  variant?: 'search' | 'update';
  /** Defaults to opening the results route in a new tab (search) or in this tab (update). */
  onSearch?: (criteria: SearchCriteria) => void;
  resultsPath?: string;
  /** Local calendar date treated as "today"; injectable for tests. */
  today?: string;
  weekStartsOn?: WeekStartDay;
}

const NOTICE =
  'You have changed search options, please click UPDATE SEARCH to refresh search results';

/**
 * The reservation form shared by the embeddable widget and the Adjust Search panel (Figma 12136:20608,
 * 12136:20582). Rules live in app/bookingSearch.ts.
 */
export function ReservationForm({
  initial,
  locations = PLACEHOLDER_LOCATIONS,
  limits = DEFAULT_BOOKING_LIMITS,
  childrenLabel = 'Children',
  globalMessage,
  variant = 'search',
  onSearch,
  resultsPath,
  today: todayProp,
  weekStartsOn,
}: ReservationFormProps) {
  const today = todayProp ?? todayIso();
  const start = initial ?? defaultBookingCriteria(today);
  const [checkIn, setCheckIn] = useState(start.checkIn);
  const [checkOut, setCheckOut] = useState(start.checkOut);
  const [location, setLocation] = useState(start.location);
  const [rooms, dispatch] = useReducer(
    bookingRoomsReducer(limits),
    start.rooms,
    initialBookingRooms,
  );
  // Adjust Search compares against the search the results currently show.
  const [applied, setApplied] = useState<SearchCriteria>(start);
  const [touched, setTouched] = useState({ checkIn: false, checkOut: false });
  const [announcement, setAnnouncement] = useState('');

  const errors = validateBookingDates(checkIn, checkOut, today, limits);
  const valid = bookingDatesValid(checkIn, checkOut, today, limits);
  const nights = nightsBetween(checkIn, checkOut);
  const showLocation = locations.length > 1;
  const current: SearchCriteria = {
    checkIn,
    checkOut,
    location: showLocation ? location : ALL_LOCATIONS_VALUE,
    rooms: rooms.map(({ adults, children }) => ({ adults, children })),
  };
  const changed = variant === 'update' && criteriaDiffer(current, applied);

  const range = (role: 'from' | 'to'): DateFieldRange => ({
    role,
    from: checkIn,
    to: checkOut,
    limits: stayLimits(today, limits.advanceDays, limits.maxNights),
    endNames: ['check-in', 'check-out'],
    onChange: (r) => {
      setCheckIn(r.from);
      setCheckOut(r.to);
    },
  });

  // After adding a room focus its first control; after removing, the Add Another Room button.
  const maxRoomsId = useId();
  const noticeId = useId();
  const addRef = useRef<HTMLButtonElement>(null);
  const firstStepperRefs = useRef(new Map<number, HTMLButtonElement | null>());
  const focusRequest = useRef<{ kind: 'new-room'; id: number } | { kind: 'add' } | null>(null);
  const roomCount = rooms.length;
  useEffect(() => {
    const request = focusRequest.current;
    focusRequest.current = null;
    if (!request) return;
    if (request.kind === 'add') addRef.current?.focus();
    else firstStepperRefs.current.get(request.id)?.focus();
  }, [roomCount]);
  const track = (id: number) => (el: HTMLButtonElement | null) => {
    if (el) firstStepperRefs.current.set(id, el);
    else firstStepperRefs.current.delete(id);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched({ checkIn: true, checkOut: true });
    if (!valid) return;
    if (variant === 'update') setApplied(current);
    if (onSearch) onSearch(current);
    else if (variant === 'search') {
      window.open(bookingSearchUrl(current, resultsPath), '_blank', 'noopener');
    } else window.location.assign(bookingSearchUrl(current, resultsPath));
  };

  const shownCheckIn = touched.checkIn || checkIn !== '' ? errors.checkIn : undefined;
  const shownCheckOut = touched.checkOut || checkOut !== '' ? errors.checkOut : undefined;

  return (
    <Box
      component="form"
      noValidate
      onSubmit={submit}
      aria-label="Search available rooms"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
    >
      {variant === 'search' ? (
        <Typography variant="h4_fixed" component="h2">
          Search Available Rooms
        </Typography>
      ) : null}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.875, alignItems: 'flex-start' }}>
          <DateField
            label="Check In"
            today={today}
            value={checkIn}
            onChange={setCheckIn}
            onBlur={() => setTouched((t) => ({ ...t, checkIn: true }))}
            error={Boolean(shownCheckIn)}
            helperText={shownCheckIn}
            required
            min={today}
            max={addDays(today, limits.advanceDays)}
            range={range('from')}
            weekStartsOn={weekStartsOn}
          />
          <DateField
            label="Check Out"
            today={today}
            value={checkOut}
            onChange={setCheckOut}
            onBlur={() => setTouched((t) => ({ ...t, checkOut: true }))}
            error={Boolean(shownCheckOut)}
            helperText={shownCheckOut}
            required
            min={addDays(errors.checkIn ? today : checkIn || today, 1)}
            max={errors.checkIn || !checkIn ? undefined : addDays(checkIn, limits.maxNights)}
            range={range('to')}
            weekStartsOn={weekStartsOn}
          />
        </Box>

        {showLocation ? (
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
        ) : null}

        <Box
          component="fieldset"
          sx={{ border: 0, m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <Typography variant="subtitle2" component="legend" sx={{ mb: 1 }}>
            Guests
          </Typography>
          {rooms.map((room, i) => {
            const n = i + 1;
            const last = i === rooms.length - 1;
            return (
              <Box
                key={room.id}
                role="group"
                aria-label={`Room ${n}`}
                sx={(t) => ({
                  border: `1px solid ${t.palette.grey[400]}`,
                  borderRadius: 2.5,
                  p: 2,
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
                  {/* Remove deletes the latest set only. */}
                  {last && i > 0 ? (
                    <Button
                      size="small"
                      color="error"
                      startIcon={<RemoveCircle aria-hidden />}
                      aria-label={`Remove Room ${n}`}
                      onClick={() => {
                        focusRequest.current = { kind: 'add' };
                        dispatch({ type: 'removeLast' });
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
                    min={1}
                    max={maxAdults(room.children, limits)}
                    firstRef={track(room.id)}
                    onChange={(value) => dispatch({ type: 'setAdults', index: i, value })}
                  />
                  <CountStepper
                    title={childrenLabel}
                    noun={childrenLabel.toLowerCase()}
                    roomNumber={n}
                    label={`${childrenLabel}, Room ${n}`}
                    value={room.children}
                    min={0}
                    max={maxChildren(room.adults, limits)}
                    onChange={(value) => dispatch({ type: 'setChildren', index: i, value })}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>

        <Button
          ref={addRef}
          size="large"
          startIcon={<AddCircle aria-hidden />}
          aria-label="Add Another Room"
          aria-describedby={canAddBookingRoom(rooms, limits) ? undefined : maxRoomsId}
          disabled={!canAddBookingRoom(rooms, limits)}
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
        {canAddBookingRoom(rooms, limits) ? null : (
          <Typography id={maxRoomsId} variant="caption" sx={{ color: 'text.secondary' }}>
            Maximum of {limits.maxRooms} rooms
          </Typography>
        )}
      </Box>

      <Button
        type="submit"
        size="large"
        variant={variant === 'search' ? 'contained' : 'outlined'}
        aria-describedby={changed ? noticeId : undefined}
      >
        {variant === 'search' ? searchStayLabel(nights) : 'Update Search'}
      </Button>

      {changed ? (
        <Typography
          id={noticeId}
          role="status"
          variant="button"
          sx={{ textAlign: 'center', color: 'text.primary' }}
        >
          {NOTICE}
        </Typography>
      ) : null}

      {globalMessage ? (
        <Typography
          variant="body2"
          sx={(t) => ({
            p: 1.25,
            textAlign: 'center',
            bgcolor: alpha(t.palette.info.main, 0.1),
            borderRadius: 0.5,
          })}
        >
          {globalMessage}
        </Typography>
      ) : null}

      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {announcement}
      </Box>
    </Box>
  );
}

/** The embeddable reservation widget (Figma 12136:20608): the club's site renders it; Search opens results in a new tab. */
export default function ReservationWidget(props: Omit<ReservationFormProps, 'variant'>) {
  return <ReservationForm {...props} variant="search" />;
}
