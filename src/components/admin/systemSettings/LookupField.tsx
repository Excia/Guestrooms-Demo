import Search from '@mui/icons-material/Search';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import type { LookupRef } from '../../../api/types';

export interface LookupFieldProps {
  label: string;
  value: LookupRef | null;
  options: readonly LookupRef[];
  onChange: (value: LookupRef | null) => void;
  id: string;
  /** Validation message; shown under the input and tied to it. */
  error?: string;
}

// Lookup with a search icon (Figma "Item | SKU", "Area", "Guest Member").
export default function LookupField({
  label,
  value,
  options,
  onChange,
  id,
  error,
}: LookupFieldProps) {
  return (
    <Autocomplete<LookupRef>
      id={id}
      value={value}
      options={options as LookupRef[]}
      onChange={(_, next) => onChange(next)}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      popupIcon={<Search />}
      forcePopupIcon
      slotProps={{ popupIndicator: { sx: { transform: 'none' }, 'aria-label': `Search ${label}` } }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={Boolean(error)}
          helperText={error}
          // Keep the slots Autocomplete wires up (the input ref, ARIA attributes), only add `shrink`.
          slotProps={{
            ...params.slotProps,
            inputLabel: { ...params.slotProps?.inputLabel, shrink: true },
          }}
        />
      )}
    />
  );
}
