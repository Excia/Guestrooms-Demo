import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import MuiSelect, { type SelectChangeEvent } from '@mui/material/Select';
import { useId } from 'react';

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string | number = string> {
  label: string;
  value: T | '';
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** Text shown while no option is selected (Figma "[Input Selection]"). */
  placeholder?: string;
  helperText?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  variant?: 'outlined' | 'filled';
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  name?: string;
  id?: string;
}

// Themed MUI Select (Figma 79:8624). The label always sits on the border, as in the design.
export default function Select<T extends string | number = string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  helperText,
  error,
  disabled,
  required,
  variant = 'outlined',
  size = 'medium',
  fullWidth = true,
  name,
  id: idProp,
}: SelectProps<T>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const labelId = `${id}-label`;
  const helperId = `${id}-helper`;
  const handleChange = (event: SelectChangeEvent<T | ''>) => {
    // MUI types the value as T | ''; menu items only carry option values.
    onChange(event.target.value as T);
  };
  return (
    <FormControl
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      error={error}
      disabled={disabled}
      required={required}
    >
      <InputLabel id={labelId} shrink>
        {label}
      </InputLabel>
      <MuiSelect<T | ''>
        labelId={labelId}
        id={id}
        name={name}
        label={variant === 'outlined' ? label : undefined}
        value={value}
        onChange={handleChange}
        displayEmpty={Boolean(placeholder)}
        renderValue={
          placeholder
            ? (selected) => options.find((o) => o.value === selected)?.label ?? placeholder
            : undefined
        }
        notched={variant === 'outlined' ? true : undefined}
        aria-describedby={helperText ? helperId : undefined}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </MenuItem>
        ))}
      </MuiSelect>
      {helperText ? <FormHelperText id={helperId}>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}
