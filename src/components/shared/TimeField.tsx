import AccessTime from '@mui/icons-material/AccessTime';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import type { SxProps, Theme } from '@mui/material/styles';
import { useRef, useState } from 'react';
import {
  formatFieldTime,
  fromClockParts,
  halfDayHasAllowed,
  nearestAllowed,
  parseTypedTime,
  toClockParts,
  type ClockParts,
  type IsAllowed,
} from '../../app/clockTime';
import { parseTime, TIME_STEP_MINUTES, formatTimeValue } from '../../app/systemSettings';
import ClockDial, { type ClockMode } from './ClockDial';

export interface TimeFieldProps {
  id?: string;
  label: string;
  /** `HH:mm` (24 hour), or '' for no time. Stored in this format; shown as hh:mm AM/PM. */
  value: string;
  onChange: (value: string) => void;
  /** Minutes between choices on the dial. */
  step?: number;
  /** Times the dial offers (late checkout: only between checkout and check-in). Typing is not limited. */
  isAllowed?: IsAllowed;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

const ALL: IsAllowed = () => true;
const NOON = 12 * 60;

/**
 * Time field: typed hh:mm AM/PM with a clock-style picker. The green clock button (or Alt+ArrowDown /
 * F4 in the input) opens a popover with the dial: hours, then minutes, with an AM/PM switch. The time
 * is applied with OK; Cancel and Escape drop it, and focus returns to the input. The value keeps the
 * `HH:mm` format; whether it is on the step or in range stays the form validation's rule.
 */
export default function TimeField({
  id,
  label,
  value,
  onChange,
  step = TIME_STEP_MINUTES,
  isAllowed = ALL,
  error,
  helperText,
  disabled,
  size = 'medium',
  sx,
}: TimeFieldProps) {
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  // Text being typed; null shows the formatted value.
  const [typed, setTyped] = useState<string | null>(null);
  const [parts, setParts] = useState<ClockParts>({ hour: 12, minute: 0, pm: false });
  const [mode, setMode] = useState<ClockMode>('hours');
  const input = useRef<HTMLInputElement>(null);
  const dial = useRef<SVGSVGElement>(null);
  const refocus = useRef(false);
  const name = label.toLowerCase();

  const openPicker = () => {
    if (disabled) return;
    const current = parseTime(value);
    const start = nearestAllowed(current ?? NOON, step, isAllowed) ?? current ?? NOON;
    setParts(toClockParts(current !== null && isAllowed(current) ? current : start));
    setMode('hours');
    setOpen(true);
  };
  const close = (focusInput = true) => {
    refocus.current = focusInput;
    setOpen(false);
  };
  const accept = () => {
    const total = fromClockParts(parts);
    if (!isAllowed(total)) return;
    onChange(formatTimeValue(total));
    setTyped(null);
    close();
  };

  const setHalf = (pm: boolean) => {
    const target = fromClockParts({ ...parts, pm });
    const next = isAllowed(target)
      ? target
      : nearestAllowed(target, step, (t) => isAllowed(t) && toClockParts(t).pm === pm);
    if (next !== null) setParts(toClockParts(next));
  };

  const shown = typed ?? formatFieldTime(value);
  const slotInput = (
    <InputAdornment position="end" sx={{ ml: 0 }}>
      <IconButton
        size="small"
        edge="end"
        color="primary"
        disabled={disabled}
        aria-label={`Choose ${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          input.current?.focus();
          openPicker();
        }}
        sx={{ p: 0.5 }}
      >
        <AccessTime fontSize="small" />
      </IconButton>
    </InputAdornment>
  );

  return (
    <>
      <TextField
        ref={setAnchor}
        id={id}
        label={label}
        value={shown}
        placeholder="hh:mm AM"
        onChange={(e) => {
          const text = e.target.value;
          setTyped(text);
          if (text.trim() === '') onChange('');
          else {
            const parsed = parseTypedTime(text);
            if (parsed !== null) onChange(parsed);
          }
        }}
        error={error}
        helperText={helperText}
        disabled={disabled}
        size={size}
        inputRef={input}
        sx={sx}
        slotProps={{
          inputLabel: { shrink: true },
          // Leaving the field (input or clock button), not moving between them or into the picker.
          root: {
            onBlur: (e: React.FocusEvent<HTMLElement>) => {
              if (open || (e.relatedTarget instanceof Node && anchor?.contains(e.relatedTarget)))
                return;
              setTyped(null);
            },
          },
          input: { endAdornment: slotInput },
          htmlInput: {
            autoComplete: 'off',
            onKeyDown: (e: React.KeyboardEvent) => {
              if ((e.altKey && e.key === 'ArrowDown') || e.key === 'F4') {
                e.preventDefault();
                openPicker();
              }
            },
          },
          formHelperText: { role: error ? 'alert' : undefined },
        }}
      />
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={(_, reason) => close(reason === 'escapeKeyDown')}
        disableRestoreFocus
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: { role: 'dialog', 'aria-label': `Choose ${name}`, sx: { p: 2, mt: 0.5 } },
          transition: {
            onEntered: () => dial.current?.focus(),
            onExited: () => {
              if (refocus.current) input.current?.focus();
              refocus.current = false;
            },
          },
        }}
      >
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_, next: ClockMode | null) => next && setMode(next)}
            aria-label="Hours or minutes"
          >
            <ToggleButton value="hours" aria-label="Hours">
              {String(parts.hour).padStart(2, '0')}
            </ToggleButton>
            <ToggleButton value="minutes" aria-label="Minutes">
              {String(parts.minute).padStart(2, '0')}
            </ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={parts.pm ? 'PM' : 'AM'}
            onChange={(_, next: 'AM' | 'PM' | null) => next && setHalf(next === 'PM')}
            aria-label="AM or PM"
          >
            <ToggleButton value="AM" disabled={!halfDayHasAllowed(false, step, isAllowed)}>
              AM
            </ToggleButton>
            <ToggleButton value="PM" disabled={!halfDayHasAllowed(true, step, isAllowed)}>
              PM
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <ClockDial
          ref={dial}
          mode={mode}
          parts={parts}
          step={step}
          isAllowed={isAllowed}
          onChange={setParts}
          onHourDone={() => {
            setMode('minutes');
            dial.current?.focus();
          }}
          onMinuteDone={accept}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button size="small" onClick={() => close()}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!isAllowed(fromClockParts(parts))}
            onClick={accept}
          >
            OK
          </Button>
        </Box>
      </Popover>
    </>
  );
}
