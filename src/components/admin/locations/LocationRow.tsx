import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import type { LocationInput, LookupRef } from '../../../api/types';
import { LOCATION_NAME_MAX, type LocationField } from '../../../app/locations';
import LookupField from '../systemSettings/LookupField';

/** DOM id of a row's control; the page focuses the first invalid one after a refused save. */
export const locationFieldId = (rowId: string, field: LocationField) =>
  `location-${rowId}-${field}`;

export interface LocationRowProps {
  /** 1-based position, for the accessible names. */
  index: number;
  row: LocationInput;
  areas: readonly LookupRef[];
  errors?: Partial<Record<LocationField, string>>;
  readOnly: boolean;
  /** False for the only row (a club keeps one location). */
  removable: boolean;
  onChange: (row: LocationInput) => void;
  onRemove: () => void;
}

// One location: Name (counter), Area (type-ahead over the areas) and Remove (legacy LocationsEdit).
export default function LocationRow({
  index,
  row,
  areas,
  errors,
  readOnly,
  removable,
  onChange,
  onRemove,
}: LocationRowProps) {
  const nameId = locationFieldId(row.id, 'name');
  return (
    <Box
      component="li"
      role="group"
      aria-label={`Location ${index}`}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr) auto' },
        gap: 2,
        alignItems: 'start',
        listStyle: 'none',
      }}
    >
      <TextField
        id={nameId}
        label="Location Name"
        value={row.name}
        onChange={(e) => onChange({ ...row, name: e.target.value })}
        error={Boolean(errors?.name)}
        helperText={errors?.name ?? `${row.name.length} / ${LOCATION_NAME_MAX}`}
        slotProps={{ htmlInput: { maxLength: LOCATION_NAME_MAX } }}
        disabled={readOnly}
        required
        fullWidth
      />
      <LookupField
        id={locationFieldId(row.id, 'area')}
        label="Location Area"
        value={row.area}
        options={areas}
        onChange={(area) => onChange({ ...row, area })}
        error={errors?.area}
        disabled={readOnly}
        required
      />
      {readOnly ? null : (
        <Button
          variant="outlined"
          onClick={onRemove}
          disabled={!removable}
          aria-label={`Remove ${row.name.trim() || `location ${index}`}`}
          sx={{ mt: { md: 0.5 }, borderColor: 'primary.outlinedBorder' }}
        >
          Remove
        </Button>
      )}
    </Box>
  );
}
