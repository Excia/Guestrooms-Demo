import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { visuallyHidden } from '@mui/utils';

export interface NightsStepperProps {
  /** Accessible name of the group, e.g. "Alternative Base Rate 1 nights". */
  label: string;
  value: number;
  min: number;
  /** Omit for no upper limit. */
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  id?: string;
  /** Unit read after the value by screen readers; default "nights". */
  unit?: string;
}

// "— 07 +" stepper beside "or more nights" (Figma 11895:16081). The limit buttons use aria-disabled
// so focus stays on the button that was just pressed.
export default function NightsStepper({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
  id,
  unit = 'nights',
}: NightsStepperProps) {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;
  return (
    <ButtonGroup
      id={id}
      role="group"
      aria-label={label}
      variant="outlined"
      size="small"
      disabled={disabled}
    >
      <Button
        aria-label={`Decrease ${label}`}
        aria-disabled={atMin || undefined}
        onClick={() => !atMin && onChange(value - 1)}
      >
        —
      </Button>
      <Box
        component="span"
        aria-live="polite"
        sx={(t) => ({
          ...t.typography.button,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: t.spacing(5.5),
          color: 'primary.main',
          // ButtonGroup hides the minus button's right border, so this left border is the divider
          // that shows where the minus control ends (the plus button keeps its own left border).
          borderLeft: `1px solid ${t.palette.primary.outlinedBorder}`,
          borderTop: `1px solid ${t.palette.primary.outlinedBorder}`,
          borderBottom: `1px solid ${t.palette.primary.outlinedBorder}`,
          opacity: disabled ? 0.5 : 1,
        })}
      >
        <span aria-hidden>{String(value).padStart(2, '0')}</span>
        <Box component="span" sx={visuallyHidden}>{`${value} ${unit}`}</Box>
      </Box>
      <Button
        aria-label={`Increase ${label}`}
        aria-disabled={atMax || undefined}
        onClick={() => !atMax && onChange(value + 1)}
      >
        +
      </Button>
    </ButtonGroup>
  );
}
