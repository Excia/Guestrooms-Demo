import { useDisabled } from '../../app/readOnlyContext';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useId } from 'react';

export interface QuantityPickerProps {
  /** Visible label and accessible name of the group, e.g. "Max Occupancy". */
  label: string;
  value: number;
  /** Whole numbers from `min` (0 by default) up to `max`. */
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

// Figma Quantity Picker 11964:13394: the label to the left of an outlined group (minus, value,
// plus). The limit buttons use aria-disabled so focus stays on the button a keyboard user just
// pressed; a disabled picker (an inherited value) disables both. D-029: dividers on both sides of
// the number.
export default function QuantityPicker({
  label,
  value,
  min = 0,
  max,
  onChange,
  disabled: disabledProp = false,
}: QuantityPickerProps) {
  const disabled = useDisabled(disabledProp) ?? false;
  const labelId = useId();
  const atMin = value <= min;
  const atMax = value >= max;
  const limit = { '&.Mui-disabled': { pointerEvents: 'auto', cursor: 'default' } } as const;
  const lower = label.toLowerCase();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Typography
        id={labelId}
        variant="body2"
        component="span"
        sx={{ fontWeight: 'bold', color: disabled ? 'text.disabled' : 'text.secondary', pl: 0.25 }}
      >
        {label}
      </Typography>
      <ButtonGroup
        role="group"
        aria-labelledby={labelId}
        variant="outlined"
        size="small"
        disabled={disabled}
      >
        <Button
          aria-label={`Decrease ${lower}`}
          aria-disabled={atMin || undefined}
          className={atMin && !disabled ? 'Mui-disabled' : undefined}
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
            minWidth: t.spacing(7),
            color: disabled ? 'text.disabled' : 'primary.main',
            border: `1px solid ${disabled ? t.palette.action.disabledBackground : t.palette.primary.outlinedBorder}`,
            borderRight: 'none',
          })}
        >
          <span aria-hidden>{value}</span>
          <Box component="span" sx={visuallyHidden}>{`${value} ${lower}`}</Box>
        </Box>
        <Button
          aria-label={`Increase ${lower}`}
          aria-disabled={atMax || undefined}
          className={atMax && !disabled ? 'Mui-disabled' : undefined}
          sx={atMax ? limit : undefined}
          onClick={() => !atMax && onChange(value + 1)}
        >
          +
        </Button>
      </ButtonGroup>
    </Box>
  );
}
