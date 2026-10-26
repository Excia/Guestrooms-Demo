import type { Theme } from '@mui/material/styles';

// MUI controls that a View-only page disables by default. A component that sets `disabled`
// itself (true or false) keeps its own value, so shared field components also read `useReadOnly()`.
// Buttons, tabs and list rows are not here: navigation and selection stay usable; the actions that
// change data are hidden by the components that own them.
const CONTROLS = [
  'MuiTextField',
  'MuiAutocomplete',
  'MuiSelect',
  'MuiInputBase',
  'MuiOutlinedInput',
  'MuiFilledInput',
  'MuiCheckbox',
  'MuiRadio',
  'MuiSwitch',
  'MuiSlider',
  'MuiToggleButton',
  'MuiToggleButtonGroup',
  'MuiFormControl',
  'MuiFormControlLabel',
] as const;

/** The same theme with `disabled` as the default prop of every field control. Pure. */
export function readOnlyTheme(outer: Theme): Theme {
  const components = { ...outer.components } as Record<
    string,
    { defaultProps?: object } | undefined
  >;
  for (const name of CONTROLS) {
    components[name] = {
      ...components[name],
      defaultProps: { ...components[name]?.defaultProps, disabled: true },
    };
  }
  return { ...outer, components } as Theme;
}
