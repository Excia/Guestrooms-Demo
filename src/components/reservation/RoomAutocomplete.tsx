import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { filterRoomOptions, type RoomOption } from '../../app/roomOptions';

export interface RoomAutocompleteProps {
  options: readonly RoomOption[];
  value: string;
  onChange: (roomId: string) => void;
  loading?: boolean;
  error?: string;
  /** Shown instead of the list when the rooms could not be loaded. */
  unavailable?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  disabled?: boolean;
}

/**
 * The Room field: every room of the club, grouped "Location | Room type" and searchable by number,
 * location or type. It takes no filter on purpose (Figma annotation: all rooms regardless of
 * location and room type).
 */
export default function RoomAutocomplete({
  options,
  value,
  onChange,
  loading,
  error,
  unavailable,
  inputRef,
  disabled,
}: RoomAutocompleteProps) {
  const selected = options.find((o) => o.id === value) ?? null;
  return (
    <Autocomplete<RoomOption>
      options={options as RoomOption[]}
      value={selected}
      onChange={(_, option) => onChange(option?.id ?? '')}
      groupBy={(o) => o.group}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(all, { inputValue }) => filterRoomOptions(all, inputValue)}
      loading={loading}
      loadingText="Loading rooms…"
      noOptionsText="No rooms match."
      disabled={disabled || unavailable}
      autoHighlight
      renderInput={(params) => (
        <TextField
          {...params}
          label="Room"
          error={Boolean(error)}
          helperText={unavailable ? 'Rooms could not be loaded.' : error}
          slotProps={{
            ...params.slotProps,
            inputLabel: { ...params.slotProps?.inputLabel, shrink: true },
          }}
          inputRef={inputRef}
          placeholder="Unassigned"
        />
      )}
    />
  );
}
