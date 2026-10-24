import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import type { LookupRef } from '../../../api/types';

export interface RoomTypesFieldProps {
  id: string;
  label: string;
  options: readonly LookupRef[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

// Multi-select chips for the excluded room types (Figma "AutocompleteTag").
export default function RoomTypesField({
  id,
  label,
  options,
  value,
  onChange,
  disabled,
}: RoomTypesFieldProps) {
  const selected = options.filter((o) => value.includes(o.id));
  return (
    <Autocomplete<LookupRef, true>
      multiple
      id={id}
      size="small"
      disabled={disabled}
      options={options as LookupRef[]}
      value={disabled ? [] : selected}
      onChange={(_, next) => onChange(next.map((o) => o.id))}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      disableCloseOnSelect
      renderValue={(items, getItemProps) =>
        items.map((item, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return <Chip key={key} size="small" label={item.label} {...itemProps} />;
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          variant="standard"
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, 'aria-label': label },
          }}
        />
      )}
    />
  );
}
