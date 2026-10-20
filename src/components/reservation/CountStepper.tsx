import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { padCount } from '../../app/newReservation';

export interface CountStepperProps {
  /** Visible heading and accessible name, e.g. "Adults". */
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

// Figma 11896:14319: label above an outlined group (minus, value as two digits, plus). The limit
// buttons use aria-disabled so focus stays on the button a keyboard user just pressed.
export default function CountStepper({ label, value, min, max, onChange }: CountStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;
  const limit = { '&.Mui-disabled': { pointerEvents: 'auto', cursor: 'default' } } as const;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <Typography variant="body2" component="span" sx={{ fontWeight: 'bold' }}>
        {label}
      </Typography>
      <ButtonGroup role="group" aria-label={label} variant="outlined" size="small">
        <Button
          aria-label={`Decrease ${label.toLowerCase()}`}
          aria-disabled={atMin || undefined}
          className={atMin ? 'Mui-disabled' : undefined}
          sx={atMin ? limit : undefined}
          onClick={() => !atMin && onChange(value - 1)}
        >
          —
        </Button>
        <Box
          component="span"
          aria-live="polite"
          sx={(t) => ({
            ...t.typography.button,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: t.spacing(5.5),
            borderTop: `1px solid ${t.palette.primary.outlinedBorder}`,
            borderBottom: `1px solid ${t.palette.primary.outlinedBorder}`,
            borderLeft: `1px solid ${t.palette.primary.outlinedBorder}`,
          })}
        >
          <span aria-hidden>{padCount(value)}</span>
          <Box component="span" sx={visuallyHidden}>{`${value} ${label.toLowerCase()}`}</Box>
        </Box>
        <Button
          aria-label={`Increase ${label.toLowerCase()}`}
          aria-disabled={atMax || undefined}
          className={atMax ? 'Mui-disabled' : undefined}
          sx={atMax ? limit : undefined}
          onClick={() => !atMax && onChange(value + 1)}
        >
          +
        </Button>
      </ButtonGroup>
    </Box>
  );
}
