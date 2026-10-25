import AddCircle from '@mui/icons-material/AddCircle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import type { Theme } from '@mui/material/styles';
import type { ScheduleLocation } from '../../api';
import { ALL_LOCATIONS_LABEL } from '../../app/locationSelection';
import type { IsoDate } from '../../lib/dates';
import { TOOLBAR_FIELD_SIZE, toolbarWidth } from '../shared/controlSizes';
import DateField from '../shared/DateField';
import NightAuditButton from '../shared/NightAuditButton';
import Select from '../shared/Select';

const ALL_LOCATIONS_VALUE = '__all__';

export interface ReservationListToolbarProps {
  today: IsoDate;
  checkInFrom: IsoDate | '';
  checkInTo: IsoDate | '';
  onDates: (range: { checkInFrom?: IsoDate | ''; checkInTo?: IsoDate | '' }) => void;
  unassignedOnly: boolean;
  onUnassignedOnly: (value: boolean) => void;
  locations: readonly ScheduleLocation[];
  locationIds: readonly string[];
  onLocations: (ids: string[]) => void;
  onNewReservation: () => void;
}

/** Filter row of the Reservation List (Figma 2524:31838): dates, Night Audit and New Reservation, Unassigned Only and Location. */
export default function ReservationListToolbar({
  today,
  checkInFrom,
  checkInTo,
  onDates,
  unassignedOnly,
  onUnassignedOnly,
  locations,
  locationIds,
  onLocations,
  onNewReservation,
}: ReservationListToolbarProps) {
  // Figma 14041:71098: both buttons 200px wide with a 16px gap (Night Audit is the shared button).
  const cta = { width: (t: Theme) => t.spacing(25), whiteSpace: 'nowrap' } as const;
  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        // Figma keeps the three groups on one row; below 1200px they wrap.
        [t.breakpoints.down('lg')]: { rowGap: 2 },
      })}
    >
      <Box
        role="group"
        aria-label="Check in dates"
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
      >
        <DateField
          label="Check in From"
          value={checkInFrom}
          today={today}
          onChange={(v) => onDates({ checkInFrom: v })}
          fullWidth={false}
          size={TOOLBAR_FIELD_SIZE}
          sx={{ width: toolbarWidth('date') }}
        />
        <DateField
          label="To"
          ariaLabel="Check in to"
          value={checkInTo}
          today={today}
          min={checkInFrom || undefined}
          onChange={(v) => onDates({ checkInTo: v })}
          fullWidth={false}
          size={TOOLBAR_FIELD_SIZE}
          sx={{ width: toolbarWidth('date') }}
        />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <NightAuditButton />
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={onNewReservation}
          startIcon={<AddCircle />}
          sx={cta}
        >
          New Reservation
        </Button>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <FormControlLabel
          label="Unassigned Only"
          control={<Switch checked={unassignedOnly} onChange={(_, v) => onUnassignedOnly(v)} />}
        />
        {/* Single select, shown only when the property has more than one location (requirements doc 16.7). */}
        {locations.length > 1 ? (
          <Select
            label="Location"
            value={locationIds[0] ?? ALL_LOCATIONS_VALUE}
            options={[
              { value: ALL_LOCATIONS_VALUE, label: ALL_LOCATIONS_LABEL },
              ...locations.map((l) => ({ value: l.id, label: l.name })),
            ]}
            onChange={(v) => onLocations(v === ALL_LOCATIONS_VALUE ? [] : [v])}
            size={TOOLBAR_FIELD_SIZE}
            sx={{ width: toolbarWidth('wideSelect') }}
          />
        ) : null}
      </Box>
    </Box>
  );
}
