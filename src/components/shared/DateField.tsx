import CalendarToday from '@mui/icons-material/CalendarToday';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import type { SxProps, Theme } from '@mui/material/styles';
import useForkRef from '@mui/utils/useForkRef';
import { useRef, useState, type FocusEventHandler, type Ref } from 'react';
import {
  isRangeDayDisabled,
  nextRangeSelection,
  rangeBounds,
  type RangeLimits,
  type RangeValue,
} from '../../app/dateRange';
import { isValidIsoDate, type IsoDate } from '../../app/dateSelection';
import { useClubToday } from '../../app/useClubToday';
import { clampDate, type WeekStartDay } from '../../lib/calendar';
import Calendar, { type CalendarHandle } from './Calendar';

/** Range mode: this field is one end of a pair that share a single calendar. */
export interface DateFieldRange {
  /** Which end of the pair this field edits; opening from 'to' keeps a valid start. */
  role: 'from' | 'to';
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
  /** `small` (40px) in toolbars, `medium` (56px, default) in forms; see controlSizes.ts. */
  size?: 'small' | 'medium';
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
  sx?: SxProps<Theme>;
}

/**
 * Date field: a typed yyyy-mm-dd input (native segments, keyboard friendly) with a themed calendar
 * popover. The calendar opens from the calendar button or Alt+ArrowDown (a click on the field itself
 * keeps editing the typed segments); Escape closes it and focus returns to the input.
 * With `range` the field edits one end of a pair on a single calendar: a complete range is
 * replaced only by a new complete one, and dismissing mid-pick restores the previous range.
 * Firefox and iOS Safari keep their own date affordance next to this one.
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
  size = 'medium',
  inputRef,
  onBlur,
  sx,
}: DateFieldProps) {
  const today = useClubToday(todayProp);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RangeValue>({ from: '', to: '' });
  // The range as it was when the calendar opened, restored if the pick is abandoned.
  const base = useRef<RangeValue>({ from: '', to: '' });
  const localInput = useRef<HTMLInputElement>(null);
  const inputRefs = useForkRef(localInput, inputRef);
  const calendar = useRef<CalendarHandle>(null);
  const name = (ariaLabel ?? label).toLowerCase();

  const openCalendar = () => {
    if (readOnly) return;
    if (range) {
      const start = { from: range.from, to: range.to };
      base.current = start;
      // From the check-out field a valid start stays and the first click picks the end only.
      setDraft(
        range.role === 'to' && isValidIsoDate(range.from) && range.to
          ? { from: range.from, to: '' }
          : start,
      );
    }
    setOpen(true);
  };
  // Focus returns to the input once the popover has gone (its focus trap would take it back before).
  const refocus = useRef(false);
  const close = (focusInput = true) => {
    refocus.current = focusInput;
    setOpen(false);
  };
  // Escape or a click outside while only the first date is picked: keep the previous range.
  const dismiss = (_: unknown, reason: 'escapeKeyDown' | 'backdropClick') => {
    if (range && draft.from !== '' && draft.to === '' && base.current.to !== '') {
      range.onChange(base.current);
    }
    close(reason === 'escapeKeyDown');
  };

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

  // The check-out field opens on the current check-out; the first date picked on a calendar opens on it.
  const candidate = range
    ? range.role === 'to' && range.to
      ? range.to
      : draft.from || value
    : value;
  const initial = clampDate(isValidIsoDate(candidate) ? candidate : today, bounds.min, bounds.max);
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
        error={error}
        helperText={helperText}
        fullWidth={fullWidth}
        size={size}
        inputRef={inputRefs}
        sx={[{ minWidth: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
        slotProps={{
          inputLabel: { shrink: true },
          // Leaving the field (input or calendar button). Focus moving between them, or into the
          // open calendar, is not leaving it.
          root: {
            onBlur: (e: React.FocusEvent<HTMLElement>) => {
              if (open || (e.relatedTarget instanceof Node && anchor?.contains(e.relatedTarget)))
                return;
              onBlur?.(e);
            },
          },
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
                  aria-label={`Open calendar for ${name}`}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  // Keeps focus (and "touched") in the input when the mouse presses the button.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    localInput.current?.focus();
                    openCalendar();
                  }}
                  // 24px minimum target (WCAG 2.5.8): 20px icon + 2px padding, 28px otherwise.
                  sx={{ p: compact ? 0.25 : 0.5 }}
                >
                  <CalendarToday fontSize="small" />
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
            // The browser's own picker would open next to ours.
            onKeyDown: (e: React.KeyboardEvent) => {
              if ((e.altKey && e.key === 'ArrowDown') || e.key === 'F4') {
                e.preventDefault();
                openCalendar();
              }
            },
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
        onClose={dismiss}
        // Focus goes back to the input (or stays where the user clicked), not the icon button.
        disableRestoreFocus
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': `Choose ${name}`,
            sx: { p: 2, mt: 0.5 },
          },
          // The popover focuses itself while it opens; the day takes focus once it has settled.
          transition: {
            onEntered: () => calendar.current?.focusDay(),
            onExited: () => {
              if (refocus.current) localInput.current?.focus();
              refocus.current = false;
            },
          },
        }}
      >
        <Calendar
          ref={calendar}
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
