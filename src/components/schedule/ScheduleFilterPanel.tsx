import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { toggleFilterId } from '../../app/scheduleUrl';

const btnSx = { minWidth: 0, px: 1, whiteSpace: 'nowrap', color: 'primary.dark' } as const;

interface Option {
  id: string;
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
}

interface SectionProps {
  title: string;
  options: readonly Option[];
  selected: readonly string[] | null;
  onChange: (ids: string[] | null) => void;
}

function Section({ title, options, selected, onChange }: SectionProps) {
  const id = useId();
  const all = options.map((o) => o.id);
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
          onClick={() => onChange(null)}
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
          control={
            <Checkbox
              checked={selected === null || selected.includes(o.id)}
              onChange={() => onChange(toggleFilterId(selected, all, o.id))}
            />
          }
          label={o.name}
        />
      ))}
    </Box>
  );
}

/** Filter panel (Figma 13908:94238): Locations and Room Types checkbox lists with Select All / Select None. */
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
}: ScheduleFilterPanelProps) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-label': 'Schedule filters',
          sx: { width: (t) => t.spacing(27.5), maxHeight: '80vh', py: 1, mt: 0.5 },
        },
      }}
    >
      <Section
        title="Locations"
        options={locations}
        selected={locationIds}
        onChange={onLocations}
      />
      <Divider sx={{ my: 1 }} />
      <Section
        title="Room Types"
        options={roomTypes}
        selected={roomTypeIds}
        onChange={onRoomTypes}
      />
    </Popover>
  );
}
