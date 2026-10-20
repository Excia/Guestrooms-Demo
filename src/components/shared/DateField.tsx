import CalendarToday from '@mui/icons-material/CalendarToday';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import type { SxProps, Theme } from '@mui/material/styles';
import { useState, type FocusEventHandler, type Ref } from 'react';
import {
  isRangeDayDisabled,
  nextRangeSelection,
  rangeBounds,
  type RangeLimits,
  type RangeValue,
} from '../../app/dateRange';
import { todayIso, type IsoDate } from '../../app/dateSelection';
import { clampDate, type WeekStartDay } from '../../lib/calendar';
import Calendar from './Calendar';

/** Range mode: this field is one end of a pair that share a single calendar. */
export interface DateFieldRange {
  from: IsoDate | '';
  to: IsoDate | '';
  limits: RangeLimits;
  /** Called on every click; `to` is '' while the second date is still to be picked. */
  onChange: (range: RangeValue) => void;
  /** Names for the two ends in the day buttons, e.g. ['check-in', 'check-out']. */
  endNames?: [string, string];
}

export interface DateFieldProps {
  label: string;
  /** yyyy-mm-dd, or '' for no date. */
  value: IsoDate | '';
  onChange?: (value: IsoDate | '') => void;
  /** Local calendar date treated as "today"; injectable for tests. */
  today?: IsoDate;
  /** Native input limits; in single mode they also disable days in the calendar. */
  min?: IsoDate;
  max?: IsoDate;
  range?: DateFieldRange;
  readOnly?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  /** Accessible name when it must differ from the visible label. */
  ariaLabel?: string;
  describedBy?: string;
  /** Half-width field: tighter padding so the full date and the calendar button fit in 105px. */
  compact?: boolean;
  weekStartsOn?: WeekStartDay;
  fullWidth?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
  sx?: SxProps<Theme>;
}

/**
 * Date field: a typed yyyy-mm-dd input (native segments, keyboard friendly) with a themed calendar
 * popover. The calendar opens from the calendar button (a click on the field itself keeps editing the typed
 * segments); Escape closes it.
 * With `range` the field edits one end of a pair on a single calendar.
 */
export default function DateField({
  label,
  value,
  onChange,
  today: todayProp,
  min,
  max,
  range,
  readOnly,
  required,
  error,
  helperText,
  ariaLabel,
  describedBy,
  compact,
  weekStartsOn,
  fullWidth = true,
  inputRef,
  onBlur,
  sx,
}: DateFieldProps) {
  const today = todayProp ?? todayIso();
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RangeValue>({ from: '', to: '' });

  const openCalendar = () => {
    if (readOnly) return;
    if (range) setDraft({ from: range.from, to: range.to });
    setOpen(true);
  };
  const close = () => setOpen(false);

  const limits = range?.limits;
  const bounds = limits ? rangeBounds(limits) : { min, max };
  const current: RangeValue = range ? draft : { from: value, to: '' };
  const isDisabled = (day: IsoDate) =>
    limits
      ? isRangeDayDisabled(day, draft, limits)
      : Boolean((min && day < min) || (max && day > max));

  const pick = (day: IsoDate) => {
    if (isDisabled(day)) return;
    if (range && limits) {
      const next = nextRangeSelection(draft, day, limits);
      setDraft(next);
      range.onChange(next);
      if (next.to !== '') close();
    } else {
      onChange?.(day);
      close();
    }
  };

  const initial = clampDate(
    (range ? (range.to && value === range.to ? value : range.from || value) : value) || today,
    bounds.min,
    bounds.max,
  );
  const hasValue = range ? current.from !== '' : value !== '';
  const clear = () => {
    if (range) {
      const empty = { from: '', to: '' } as const;
      setDraft(empty);
      range.onChange(empty);
    } else onChange?.('');
  };

  return (
    <>
      <TextField
        ref={setAnchor}
        type="date"
        label={label}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        // Opening the calendar moves focus out of the field; that is not leaving it.
        onBlur={(e) => {
          if (!open) onBlur?.(e);
        }}
        error={error}
        helperText={helperText}
        fullWidth={fullWidth}
        inputRef={inputRef}
        sx={[{ minWidth: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
        slotProps={{
          inputLabel: { shrink: true },
          // Dates use the 12px caption style in the half-width Date Selection fields (Figma 120:8668).
          input: {
            sx: {
              ...(compact && { pr: 0.25 }),
              '& input': {
                ...(compact && {
                  fontSize: (t: Theme) => t.typography.caption.fontSize,
                  height: (t: Theme) => t.spacing(3),
                  px: 0.75,
                }),
                minWidth: 0,
                // The browser's own calendar cannot be themed; the button below replaces it.
                '&::-webkit-calendar-picker-indicator': { display: 'none' },
              },
            },
            endAdornment: readOnly ? undefined : (
              <InputAdornment position="end" sx={{ ml: 0 }}>
                <IconButton
                  size="small"
                  edge="end"
                  aria-label={`Open calendar for ${label.toLowerCase()}`}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  onClick={openCalendar}
                  sx={{ p: compact ? 0.25 : 0.5 }}
                >
                  <CalendarToday sx={{ fontSize: compact ? 16 : 20 }} />
                </IconButton>
              </InputAdornment>
            ),
          },
          htmlInput: {
            min,
            max,
            readOnly,
            'aria-label': ariaLabel,
            'aria-required': required || undefined,
            ...(describedBy ? { 'aria-describedby': describedBy } : {}),
            // Derived values are display-only: keep them out of the tab order (three stops each).
            tabIndex: readOnly ? -1 : undefined,
          },
          formHelperText: { role: error ? 'alert' : undefined },
        }}
      />
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': `Choose ${label.toLowerCase()}`,
            sx: { p: 2, mt: 0.5 },
          },
        }}
      >
        <Calendar
          value={current}
          mode={range ? 'range' : 'single'}
          today={today}
          initialFocus={initial}
          min={bounds.min}
          max={bounds.max}
          isDisabled={isDisabled}
          onSelect={pick}
          weekStartsOn={weekStartsOn}
          endNames={range?.endNames}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Button size="small" disabled={!hasValue} onClick={clear}>
            Clear
          </Button>
          <Button size="small" disabled={isDisabled(today)} onClick={() => pick(today)}>
            Today
          </Button>
        </Box>
      </Popover>
    </>
  );
}
