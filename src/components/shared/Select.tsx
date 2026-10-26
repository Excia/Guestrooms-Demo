import { useDisabled } from '../../app/readOnlyContext';
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
  /** Id of an element outside the select that describes it (e.g. an error list). */
  describedBy?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  variant?: 'outlined' | 'filled';
  /**
   * Compact pager style: no label on the border; the value reads "Label: value" and the label is
   * the accessible name. Use with `size="small"` (toolbar size).
   */
  inlineLabel?: boolean;
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
  describedBy,
  error,
  disabled,
  required,
  variant = 'outlined',
  inlineLabel = false,
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
      disabled={useDisabled(disabled)}
      required={required}
      sx={sx}
      {...dataAttributes}
    >
      {inlineLabel ? null : (
        <InputLabel id={labelId} shrink>
          {label}
        </InputLabel>
      )}
      <MuiSelect<T | ''>
        labelId={inlineLabel ? undefined : labelId}
        id={id}
        name={name}
        label={variant === 'outlined' && !inlineLabel ? label : undefined}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        displayEmpty={Boolean(placeholder)}
        renderValue={
          inlineLabel
            ? (selected) => `${label}: ${options.find((o) => o.value === selected)?.label ?? ''}`
            : placeholder
              ? (selected) => options.find((o) => o.value === selected)?.label ?? placeholder
              : undefined
        }
        notched={variant === 'outlined' && !inlineLabel ? true : undefined}
        inputProps={inputProps}
        SelectDisplayProps={{
          'aria-describedby':
            [helperText ? helperId : undefined, describedBy].filter(Boolean).join(' ') || undefined,
          ...(ariaLabel || inlineLabel
            ? { 'aria-label': ariaLabel ?? label, 'aria-labelledby': undefined }
            : {}),
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
