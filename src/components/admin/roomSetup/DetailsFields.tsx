import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import type { LookupRef, RoomDetails } from '../../../api/types';
import { COUNT_LIMITS } from '../../../app/roomSetup';
import QuantityPicker from '../../shared/QuantityPicker';
import { SectionTitle } from '../systemSettings/fieldParts';

export interface DetailsFieldsProps {
  details: RoomDetails;
  bedSizes: readonly LookupRef[];
  onChange: (details: RoomDetails) => void;
  /** An inherited value is shown but cannot be changed. */
  disabled?: boolean;
  /** The Rooms screen spells the baths out ("Full Bathrooms"); Room Types abbreviates. */
  bathLabels: { full: string; half: string };
}

// "Occupancy and Capacity" and "Bed Types" (Figma 11964:18526): two columns of pickers with a
// vertical divider between them (stacked under 600px).
export default function DetailsFields({
  details,
  bedSizes,
  onChange,
  disabled,
  bathLabels,
}: DetailsFieldsProps) {
  const set = (patch: Partial<RoomDetails>) => onChange({ ...details, ...patch });
  const L = COUNT_LIMITS;
  const color = disabled ? 'text.disabled' : 'text.secondary';
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 3,
      }}
    >
      <Box
        component="section"
        aria-labelledby="details-occupancy"
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}
      >
        <Box sx={{ color }}>
          <SectionTitle id="details-occupancy">Occupancy and Capacity</SectionTitle>
        </Box>
        <QuantityPicker
          label="Max Occupancy"
          min={L.maxOccupancy.min}
          max={L.maxOccupancy.max}
          value={details.maxOccupancy}
          onChange={(v) => set({ maxOccupancy: v })}
          disabled={disabled}
        />
        <QuantityPicker
          label="Bedrooms"
          min={L.bedrooms.min}
          max={L.bedrooms.max}
          value={details.bedrooms}
          onChange={(v) => set({ bedrooms: v })}
          disabled={disabled}
        />
        <QuantityPicker
          label={bathLabels.full}
          min={L.fullBaths.min}
          max={L.fullBaths.max}
          value={details.fullBaths}
          onChange={(v) => set({ fullBaths: v })}
          disabled={disabled}
        />
        <QuantityPicker
          label={bathLabels.half}
          min={L.halfBaths.min}
          max={L.halfBaths.max}
          value={details.halfBaths}
          onChange={(v) => set({ halfBaths: v })}
          disabled={disabled}
        />
      </Box>
      <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
      <Box
        component="section"
        aria-labelledby="details-beds"
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}
      >
        <Box sx={{ color }}>
          <SectionTitle id="details-beds">Bed Types</SectionTitle>
        </Box>
        {bedSizes.map((bed) => (
          <QuantityPicker
            key={bed.id}
            label={bed.label}
            min={L.bedType.min}
            max={L.bedType.max}
            value={details.bedTypes[bed.id] ?? 0}
            onChange={(v) => set({ bedTypes: { ...details.bedTypes, [bed.id]: v } })}
            disabled={disabled}
          />
        ))}
      </Box>
    </Box>
  );
}
