import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import type { SettableHousekeepingStatus } from '../../api';
import { showLocations } from '../../app/locations';
import { HOUSEKEEPING_FILTER_OPTIONS } from '../../app/schedule';
import { toggleFilterId } from '../../app/scheduleUrl';

const btnSx = { minWidth: 0, px: 1, whiteSpace: 'nowrap', color: 'primary.dark' } as const;

interface Option<Id extends string = string> {
  id: Id;
  name: string;
}

export interface ScheduleFilterPanelProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  locations: readonly Option[];
  roomTypes: readonly Option[];
  /** null: all selected. */
  locationIds: readonly string[] | null;
  roomTypeIds: readonly string[] | null;
  onLocations: (ids: string[] | null) => void;
  onRoomTypes: (ids: string[] | null) => void;
  /** Room features (Room Options); the group is left out when there are none. */
  features: readonly Option[];
  /** Selected housekeeping statuses and features; empty is no filter (the legacy default). */
  housekeeping: readonly SettableHousekeepingStatus[];
  featureIds: readonly string[];
  onHousekeeping: (ids: SettableHousekeepingStatus[]) => void;
  onFeatures: (ids: string[]) => void;
}

interface SectionProps<Id extends string> {
  title: string;
  options: readonly Option<Id>[];
  selected: readonly Id[] | null;
  onChange: (ids: Id[] | null) => void;
  /**
   * Opt-in groups (housekeeping, features) start with nothing checked, which means "no filter";
   * Select all checks every box. The others start with everything checked (null).
   */
  optIn?: boolean;
}

function Section<Id extends string>({
  title,
  options,
  selected,
  onChange,
  optIn = false,
}: SectionProps<Id>) {
  const id = useId();
  const all = options.map((o) => o.id);
  const isChecked = (optionId: Id) =>
    optIn ? (selected ?? []).includes(optionId) : selected === null || selected.includes(optionId);
  const toggle = (optionId: Id) => {
    if (!optIn) return onChange(toggleFilterId(selected, all, optionId));
    const current = selected ?? [];
    onChange(
      current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId],
    );
  };
  return (
    <Box role="group" aria-labelledby={`${id}-title`}>
      <Typography
        id={`${id}-title`}
        variant="button_small"
        component="h3"
        sx={{ display: 'block', px: 2, pt: 1, pb: 0.5 }}
      >
        {title}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 0.5 }}>
        <Button
          size="small"
          sx={btnSx}
          onClick={() => onChange(optIn ? all : null)}
          aria-label={`Select all ${title.toLowerCase()}`}
        >
          Select all
        </Button>
        <Box component="span" aria-hidden sx={{ mx: 0.5, color: 'primary.dark' }}>
          |
        </Box>
        <Button
          size="small"
          sx={btnSx}
          onClick={() => onChange([])}
          aria-label={`Select none of the ${title.toLowerCase()}`}
        >
          Select none
        </Button>
      </Box>
      {options.map((o) => (
        <FormControlLabel
          key={o.id}
          sx={{
            display: 'flex',
            mx: 0,
            pr: 2,
            '& .MuiFormControlLabel-label': { typography: 'body1' },
          }}
          control={<Checkbox checked={isChecked(o.id)} onChange={() => toggle(o.id)} />}
          label={o.name}
        />
      ))}
    </Box>
  );
}

/**
 * Filter panel (Figma 13908:94238, extended to the legacy menu): Locations (only with two or more),
 * Room Types, Housekeeping Status and Room Features, each a checkbox list with Select All / Select None.
 */
export default function ScheduleFilterPanel({
  open,
  anchorEl,
  onClose,
  locations,
  roomTypes,
  locationIds,
  roomTypeIds,
  onLocations,
  onRoomTypes,
  features,
  housekeeping,
  featureIds,
  onHousekeeping,
  onFeatures,
}: ScheduleFilterPanelProps) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-label': 'Schedule filters',
          sx: { width: (t) => t.spacing(27.5), maxHeight: '80vh', py: 1, mt: 0.5 },
        },
      }}
    >
      {showLocations(locations) ? (
        <>
          <Section
            title="Locations"
            options={locations}
            selected={locationIds}
            onChange={onLocations}
          />
          <Divider sx={{ my: 1 }} />
        </>
      ) : null}
      <Section
        title="Room Types"
        options={roomTypes}
        selected={roomTypeIds}
        onChange={onRoomTypes}
      />
      <Divider sx={{ my: 1 }} />
      <Section
        title="Housekeeping Status"
        options={HOUSEKEEPING_FILTER_OPTIONS}
        selected={housekeeping}
        onChange={(ids) => onHousekeeping(ids ?? [])}
        optIn
      />
      {features.length > 0 ? (
        <>
          <Divider sx={{ my: 1 }} />
          <Section
            title="Room Features"
            options={features}
            selected={featureIds}
            onChange={(ids) => onFeatures(ids ?? [])}
            optIn
          />
        </>
      ) : null}
    </Popover>
  );
}
