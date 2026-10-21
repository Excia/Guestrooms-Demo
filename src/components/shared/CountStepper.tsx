import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import type { Ref } from 'react';
import { formatCount } from '../../app/reservationSearch';

// Limit buttons keep the disabled look but must still take mouse focus, so a click does not drop it.
const limitSx = { '&.Mui-disabled': { pointerEvents: 'auto', cursor: 'default' } } as const;

export interface CountStepperProps {
  label: string; // e.g. "Adults, Room 2"
  title: string; // visible heading, e.g. "Adults"
  noun: string; // for the value announcement, e.g. "adults"
  roomNumber: number;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  firstRef?: Ref<HTMLButtonElement>;
}

// Figma 69:3818: label above an outlined button group (minus, value, plus). The limit buttons use
// aria-disabled (not `disabled`) so focus stays on the button a keyboard user just pressed.
export default function CountStepper({
  label,
  title,
  noun,
  roomNumber,
  value,
  min,
  max,
  onChange,
  firstRef,
}: CountStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <Typography variant="body2" component="span" sx={{ fontWeight: 'bold' }}>
        {title}
      </Typography>
      <ButtonGroup role="group" aria-label={label} variant="outlined" color="primary">
        <Button
          ref={firstRef}
          aria-label={`Decrease ${label}`}
          aria-disabled={atMin || undefined}
          className={atMin ? 'Mui-disabled' : undefined}
          sx={
            atMin
              ? // The value cell draws the divider; the disabled look must not add a second line.
                {
                  ...limitSx,
                  '&.Mui-disabled': {
                    ...limitSx['&.Mui-disabled'],
                    borderRightColor: 'transparent',
                  },
                }
              : undefined
          }
          onClick={() => {
            if (!atMin) onChange(value - 1);
          }}
        >
          —
        </Button>
        <Box
          component="span"
          aria-live="polite"
          sx={(t) => ({
            ...t.typography.button,
            fontWeight: 'bold',
            color: 'text.primary',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: t.spacing(5.5),
            px: 2,
            // ButtonGroup makes the minus button's right border transparent; this left border is
            // the divider (the plus button keeps its own left border).
            borderLeft: `1px solid ${t.palette.primary.outlinedBorder}`,
            borderTop: `1px solid ${t.palette.primary.outlinedBorder}`,
            borderBottom: `1px solid ${t.palette.primary.outlinedBorder}`,
          })}
        >
          <span aria-hidden>{formatCount(value)}</span>
          <Box component="span" sx={visuallyHidden}>
            {`${value} ${noun}, Room ${roomNumber}`}
          </Box>
        </Box>
        <Button
          aria-label={`Increase ${label}`}
          aria-disabled={atMax || undefined}
          className={atMax ? 'Mui-disabled' : undefined}
          sx={atMax ? limitSx : undefined}
          onClick={() => {
            if (!atMax) onChange(value + 1);
          }}
        >
          +
        </Button>
      </ButtonGroup>
    </Box>
  );
}
