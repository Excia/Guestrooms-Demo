import { useDisabled } from '../../../app/readOnlyContext';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import MuiSelect, { type SelectChangeEvent } from '@mui/material/Select';
import type { SxProps, Theme } from '@mui/material/styles';
import { useId } from 'react';

export interface CellSelectOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface CellSelectProps<T extends string | number> {
  id: string;
  /** Accessible name; the visible `label` (when there is one) is part of it. */
  ariaLabel: string;
  value: T | '';
  options: readonly CellSelectOption<T>[];
  onChange: (value: T) => void;
  /** Small caption above the value ("Require Name for:"). */
  label?: string;
  disabled?: boolean;
  error?: boolean;
  /** Id of an element that describes the select (an error message). */
  describedBy?: string;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
}

// Underlined select used inside the Booking Rules table cells (Figma 15957:83574).
export default function CellSelect<T extends string | number>({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  label,
  disabled,
  error,
  describedBy,
  fullWidth = true,
  sx,
}: CellSelectProps<T>) {
  const labelId = useId();
  return (
    <FormControl
      variant="standard"
      size="small"
      fullWidth={fullWidth}
      disabled={useDisabled(disabled)}
      error={error}
      sx={sx}
    >
      {label ? (
        <InputLabel id={labelId} shrink>
          {label}
        </InputLabel>
      ) : null}
      <MuiSelect<T | ''>
        id={id}
        value={value}
        displayEmpty
        onChange={(e: SelectChangeEvent<T | ''>) => onChange(e.target.value as T)}
        SelectDisplayProps={{
          'aria-label': ariaLabel,
          'aria-labelledby': undefined,
          'aria-describedby': describedBy,
        }}
        {...(label ? { labelId } : {})}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </MenuItem>
        ))}
      </MuiSelect>
    </FormControl>
  );
}
