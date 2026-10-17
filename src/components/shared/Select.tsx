import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import MuiSelect, { type SelectChangeEvent } from '@mui/material/Select';
import type { SxProps, Theme } from '@mui/material/styles';
import { useId, type FocusEventHandler, type InputHTMLAttributes, type Ref } from 'react';

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
  onBlur?: FocusEventHandler<HTMLElement>;
  /** Text shown while no option is selected (Figma "[Input Selection]"). */
  placeholder?: string;
  helperText?: string;
  /** Accessible name when it must differ from the visible label (the visible one stays). */
  ariaLabel?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  variant?: 'outlined' | 'filled';
  size?: 'small' | 'medium';
  /** Fills its container; off by default so the select is as wide as its content. */
  fullWidth?: boolean;
  name?: string;
  id?: string;
  sx?: SxProps<Theme>;
  /** Attributes for the hidden native input (e.g. form autofill hints). */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  /** Ref to the field's root element. */
  ref?: Ref<HTMLDivElement>;
  [dataAttribute: `data-${string}`]: string | undefined;
}

// Themed MUI Select (Figma 79:8624). The label always sits on the border, as in the design.
export default function Select<T extends string | number = string>({
  label,
  value,
  options,
  onChange,
  onBlur,
  placeholder,
  helperText,
  ariaLabel,
  error,
  disabled,
  required,
  variant = 'outlined',
  size = 'medium',
  fullWidth = false,
  name,
  id: idProp,
  sx,
  inputProps,
  ref,
  ...rest
}: SelectProps<T>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const labelId = `${id}-label`;
  const helperId = `${id}-helper`;
  const handleChange = (event: SelectChangeEvent<T | ''>) => {
    // MUI types the value as T | ''; menu items only carry option values.
    onChange(event.target.value as T);
  };
  const dataAttributes = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key.startsWith('data-')),
  );
  return (
    <FormControl
      ref={ref}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      error={error}
      disabled={disabled}
      required={required}
      sx={sx}
      {...dataAttributes}
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
        onBlur={onBlur}
        displayEmpty={Boolean(placeholder)}
        renderValue={
          placeholder
            ? (selected) => options.find((o) => o.value === selected)?.label ?? placeholder
            : undefined
        }
        notched={variant === 'outlined' ? true : undefined}
        inputProps={inputProps}
        SelectDisplayProps={{
          'aria-describedby': helperText ? helperId : undefined,
          ...(ariaLabel ? { 'aria-label': ariaLabel, 'aria-labelledby': undefined } : {}),
        }}
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
