import Autocomplete from '@mui/material/Autocomplete';
import ListSubheader from '@mui/material/ListSubheader';
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
  /** False for the closure form: a closure needs a room (no Unassigned entry). Default true. */
  allowUnassigned?: boolean;
  required?: boolean;
}

/** The first entry of the list: puts the room back to Unassigned (also available as the Clear button). */
const UNASSIGNED_OPTION: RoomOption = {
  id: '',
  number: '',
  label: 'Unassigned',
  group: '',
  locationName: '',
  roomTypeName: '',
  locationId: '',
  roomTypeId: '',
};

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
  allowUnassigned = true,
  required,
}: RoomAutocompleteProps) {
  const selected = options.find((o) => o.id === value) ?? null;
  const withUnassigned = allowUnassigned ? [UNASSIGNED_OPTION, ...options] : [...options];
  return (
    <Autocomplete<RoomOption>
      options={withUnassigned}
      value={selected}
      onChange={(_, option) => onChange(option?.id ?? '')}
      groupBy={(o) => o.group}
      // Unassigned has no group header.
      renderGroup={(params) => (
        <li key={params.key}>
          {params.group === '' ? null : (
            <ListSubheader component="div" sx={{ top: -8 }}>
              {params.group}
            </ListSubheader>
          )}
          <ul style={{ padding: 0 }}>{params.children}</ul>
        </li>
      )}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(all, { inputValue }) => {
        const rooms = filterRoomOptions(
          all.filter((o) => o.id !== ''),
          inputValue,
        );
        const words = inputValue.trim().toLowerCase();
        return allowUnassigned && (words === '' || 'unassigned'.includes(words))
          ? [UNASSIGNED_OPTION, ...rooms]
          : rooms;
      }}
      loading={loading}
      loadingText="Loading rooms…"
      noOptionsText="No rooms match."
      disabled={disabled || unavailable}
      autoHighlight
      // The built-in buttons would only be named "Open" and "Clear".
      slotProps={{
        popupIndicator: { 'aria-label': 'Show rooms', title: 'Show rooms' },
        clearIndicator: { 'aria-label': 'Clear room', title: 'Clear room' },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Room"
          required={required}
          error={Boolean(error)}
          helperText={unavailable ? 'Rooms could not be loaded.' : error}
          slotProps={{
            ...params.slotProps,
            inputLabel: { ...params.slotProps?.inputLabel, shrink: true },
          }}
          inputRef={inputRef}
          placeholder={allowUnassigned ? 'Unassigned' : 'Choose a room'}
        />
      )}
    />
  );
}
