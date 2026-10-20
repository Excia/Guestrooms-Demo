import AddCircle from '@mui/icons-material/AddCircle';
import Cancel from '@mui/icons-material/Cancel';
import Close from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import { useId } from 'react';
import {
  ALL_LOCATIONS_LABEL,
  isAllLocations,
  normalizeSelection,
  toReported,
  toggleLocation,
} from '../../app/locationSelection';

export interface LocationOption {
  id: string;
  name: string;
}

interface CtaProps {
  variant: 'cta';
  /** The CTA reveals the field variant; the caller swaps `variant`. */
  onOpen: () => void;
}

interface FieldProps {
  variant: 'field';
  locations: readonly LocationOption[];
  /** Selected location ids. Empty means "All Locations". */
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** The red cancel button next to the field: remove the filter. */
  onRemove?: () => void;
}

export type LocationFilterProps = CtaProps | FieldProps;

// Location Filter (Figma 120:6825): a text CTA, or a multi-select field with chips and a clear button.
export default function LocationFilter(props: LocationFilterProps) {
  if (props.variant === 'cta') {
    return (
      <Button size="large" startIcon={<AddCircle />} onClick={props.onOpen}>
        Filter by location
      </Button>
    );
  }
  return <LocationField {...props} />;
}

function LocationField({ locations, value, onChange: onChangeProp, onRemove }: FieldProps) {
  const id = useId();
  const allIds = locations.map((l) => l.id);
  const selected = normalizeSelection(value, allIds);
  const nameOf = (locId: string) => locations.find((l) => l.id === locId)?.name ?? locId;
  // Every location selected is reported as [] so consumers see a single "All Locations" form.
  const onChange = (next: string[]) => onChangeProp(toReported(next, allIds));
  const labelId = `${id}-label`;

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    // The "All Locations" item has the empty-string value and is "selected" while nothing is, so
    // picking it clears the selection and picking a location drops it.
    const picked = event.target.value;
    const list = typeof picked === 'string' ? picked.split(',') : picked;
    onChange(selected.length === 0 ? list.filter(Boolean) : list.includes('') ? [] : list);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <FormControl sx={{ width: (t) => t.spacing(25) }}>
        <InputLabel id={labelId} shrink>
          Location
        </InputLabel>
        <Select<string[]>
          multiple
          displayEmpty
          notched
          labelId={labelId}
          id={id}
          label="Location"
          value={selected.length === 0 ? [''] : selected}
          onChange={handleChange}
          renderValue={(picked) =>
            isAllLocations(picked.filter(Boolean), allIds) ? (
              ALL_LOCATIONS_LABEL
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {picked.map((locId) => (
                  <Chip
                    key={locId}
                    size="small"
                    // Display only: no nested buttons inside the combobox. Removal is via the menu
                    // and the Clear button; the X is a mouse shortcut.
                    role="presentation"
                    tabIndex={-1}
                    label={nameOf(locId)}
                    // Deleting a chip must not open the menu behind it.
                    onMouseDown={(e) => e.stopPropagation()}
                    onDelete={() => onChange(toggleLocation(selected, locId))}
                  />
                ))}
              </Box>
            )
          }
          endAdornment={
            selected.length > 0 ? (
              <IconButton
                size="small"
                aria-label="Clear locations"
                onClick={() => onChange([])}
                sx={{ mr: 3 }}
              >
                <Close fontSize="small" />
              </IconButton>
            ) : undefined
          }
        >
          <MenuItem value="">
            <Checkbox checked={selected.length === 0} tabIndex={-1} disableRipple />
            <ListItemText primary={ALL_LOCATIONS_LABEL} />
          </MenuItem>
          {locations.map((l) => (
            <MenuItem key={l.id} value={l.id}>
              <Checkbox checked={selected.includes(l.id)} tabIndex={-1} disableRipple />
              <ListItemText primary={l.name} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {onRemove ? (
        <IconButton color="error" aria-label="Remove location filter" onClick={onRemove}>
          <Cancel />
        </IconButton>
      ) : null}
    </Box>
  );
}
