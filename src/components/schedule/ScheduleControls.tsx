import AddCircle from '@mui/icons-material/AddCircle';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import CalendarMonth from '@mui/icons-material/CalendarMonth';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import FilterAlt from '@mui/icons-material/FilterAlt';
import KeyboardDoubleArrowLeft from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRight from '@mui/icons-material/KeyboardDoubleArrowRight';
import ShieldMoon from '@mui/icons-material/ShieldMoon';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import type { ScheduleAvailability, ScheduleDays } from '../../api';
import type { IsoDate } from '../../lib/dates';
import { SCHEDULE_DAYS } from '../../api';
import { SCHEDULE_VIEW_LABELS, type ScheduleStep } from '../../app/schedule';
import { NIGHT_AUDIT_HISTORY_PATH } from '../../app/routes';
import Calendar, { type CalendarHandle } from '../shared/Calendar';
import Select from '../shared/Select';

export const AVAILABILITY_LABELS: Record<ScheduleAvailability, string> = {
  all: 'All Rooms',
  available: 'Available only',
  booked: 'Booked only',
};
const AVAILABILITY: readonly ScheduleAvailability[] = ['all', 'available', 'booked'];

export interface ScheduleControlsProps {
  days: ScheduleDays;
  start: IsoDate;
  today: IsoDate;
  availability: ScheduleAvailability;
  activeFilters: number;
  filtersOpen: boolean;
  onDays: (days: ScheduleDays) => void;
  onShift: (direction: -1 | 1, step: ScheduleStep) => void;
  onStart: (date: IsoDate) => void;
  onToday: () => void;
  onAvailability: (value: ScheduleAvailability) => void;
  onToggleFilters: (button: HTMLElement) => void;
  /** Opens the New Reservation panel on the schedule. */
  onNewReservation: (button: HTMLElement) => void;
}

/** Icon button of the date navigation: 35px as in Figma. */
const navSx = {
  width: (t: { spacing: (n: number) => string }) => t.spacing(4.375),
  height: (t: { spacing: (n: number) => string }) => t.spacing(4.375),
};

const viewOptions = SCHEDULE_DAYS.map((d) => ({ value: d, label: SCHEDULE_VIEW_LABELS[d] }));

/** Controls row (Figma 13908:92289): view, date navigation, Today, Night Audit, New Reservation, room filters. */
export default function ScheduleControls({
  days,
  start,
  today,
  availability,
  activeFilters,
  filtersOpen,
  onDays,
  onShift,
  onStart,
  onToday,
  onAvailability,
  onToggleFilters,
  onNewReservation,
}: ScheduleControlsProps) {
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null);
  const [roomsAnchor, setRoomsAnchor] = useState<HTMLElement | null>(null);
  const calendar = useRef<CalendarHandle>(null);
  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        p: 2,
        borderBottom: `1px solid ${t.palette.divider}`,
        // Figma keeps the three groups on one row; below 1200px they wrap.
        [t.breakpoints.down('lg')]: { rowGap: 2 },
      })}
    >
      <Box
        component="div"
        role="group"
        aria-label="Date range"
        sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}
      >
        <Select<number>
          label="View"
          size="small"
          value={days}
          options={viewOptions}
          onChange={(v) => onDays(v as ScheduleDays)}
          sx={{ width: (t) => t.spacing(14.25) }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <IconButton aria-label="Previous page" sx={navSx} onClick={() => onShift(-1, 'page')}>
            <KeyboardDoubleArrowLeft />
          </IconButton>
          <IconButton aria-label="Previous day" sx={navSx} onClick={() => onShift(-1, 'day')}>
            <ChevronLeft />
          </IconButton>
          <IconButton aria-label="Next day" sx={navSx} onClick={() => onShift(1, 'day')}>
            <ChevronRight />
          </IconButton>
          <IconButton aria-label="Next page" sx={navSx} onClick={() => onShift(1, 'page')}>
            <KeyboardDoubleArrowRight />
          </IconButton>
          <IconButton
            aria-label="Choose start date"
            aria-haspopup="dialog"
            aria-expanded={calendarAnchor !== null}
            sx={navSx}
            onClick={(e) => setCalendarAnchor(e.currentTarget)}
          >
            <CalendarMonth />
          </IconButton>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={onToday}
          sx={{ borderColor: 'primary.outlinedBorder' }}
        >
          Today
        </Button>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color="info"
          size="large"
          component={RouterLink}
          to={NIGHT_AUDIT_HISTORY_PATH}
          startIcon={<ShieldMoon />}
          sx={{ minWidth: (t) => t.spacing(25), whiteSpace: 'nowrap' }}
        >
          Night Audit
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={(e) => onNewReservation(e.currentTarget)}
          startIcon={<AddCircle />}
          sx={{ minWidth: (t) => t.spacing(25), whiteSpace: 'nowrap' }}
        >
          New Reservation
        </Button>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="outlined"
          size="large"
          endIcon={<ArrowDropDown />}
          aria-haspopup="menu"
          aria-expanded={roomsAnchor !== null}
          onClick={(e) => setRoomsAnchor(e.currentTarget)}
          sx={{ borderColor: 'primary.outlinedBorder', minWidth: (t) => t.spacing(21.5) }}
        >
          {AVAILABILITY_LABELS[availability]}
        </Button>
        <Menu
          anchorEl={roomsAnchor}
          open={roomsAnchor !== null}
          onClose={() => setRoomsAnchor(null)}
          slotProps={{ list: { 'aria-label': 'Rooms shown' } }}
        >
          {AVAILABILITY.map((a) => (
            <MenuItem
              key={a}
              role="menuitemradio"
              aria-checked={a === availability}
              selected={a === availability}
              onClick={() => {
                onAvailability(a);
                setRoomsAnchor(null);
              }}
            >
              {AVAILABILITY_LABELS[a]}
            </MenuItem>
          ))}
        </Menu>
        <IconButton
          aria-label={activeFilters > 0 ? `Filters, ${activeFilters} active` : 'Filters'}
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          sx={navSx}
          onClick={(e) => onToggleFilters(e.currentTarget)}
        >
          <Badge color="primary" variant="dot" invisible={activeFilters === 0}>
            <FilterAlt />
          </Badge>
        </IconButton>
      </Box>
      <Popover
        open={calendarAnchor !== null}
        anchorEl={calendarAnchor}
        onClose={() => setCalendarAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: { role: 'dialog', 'aria-label': 'Choose start date', sx: { p: 2, mt: 0.5 } },
          transition: { onEntered: () => calendar.current?.focusDay() },
        }}
      >
        <Calendar
          ref={calendar}
          mode="single"
          value={{ from: start, to: '' }}
          today={today}
          initialFocus={start}
          isDisabled={() => false}
          onSelect={(day) => {
            onStart(day);
            setCalendarAnchor(null);
          }}
        />
      </Popover>
    </Box>
  );
}
