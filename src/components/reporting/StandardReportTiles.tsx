import Paid from '@mui/icons-material/Paid';
import CleaningServices from '@mui/icons-material/CleaningServices';
import DoorFront from '@mui/icons-material/DoorFront';
import Event from '@mui/icons-material/Event';
import Groups from '@mui/icons-material/Groups';
import KingBed from '@mui/icons-material/KingBed';
import MeetingRoom from '@mui/icons-material/MeetingRoom';
import NoMeetingRoom from '@mui/icons-material/NoMeetingRoom';
import PermContactCalendar from '@mui/icons-material/PermContactCalendar';
import PeopleIcon from '@mui/icons-material/People';
import PointOfSale from '@mui/icons-material/PointOfSale';
import Receipt from '@mui/icons-material/Receipt';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router';
import { STANDARD_REPORTS, type StandardReportIcon } from '../../app/reports';

// Icons as in Figma (310:7008): the same Material icon names.
const ICONS: Record<StandardReportIcon, SvgIconComponent> = {
  housekeeping: CleaningServices,
  'room-type': KingBed,
  'month-end': Event,
  arrival: MeetingRoom,
  'occupancy-summary': Groups,
  cancelation: NoMeetingRoom,
  'folio-balance': Receipt,
  'daily-occupancy': PermContactCalendar,
  departure: DoorFront,
  'guest-list': PeopleIcon,
  'rooms-sold': Paid,
  'sales-forecast': PointOfSale,
};

/** Tile grid (Figma 310:7008): 3 columns at the design width, reflowing to fewer on narrow screens. */
export default function StandardReportTiles() {
  return (
    <Box
      component="ul"
      aria-label="Standard reports"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gap: 3,
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
      }}
    >
      {STANDARD_REPORTS.map((report) => {
        const Icon = ICONS[report.icon];
        return (
          <li key={report.id}>
            <ButtonBase
              component={RouterLink}
              to={report.path}
              focusRipple
              sx={(t) => ({
                width: '100%',
                minHeight: t.spacing(8.125), // 65px
                justifyContent: 'flex-start',
                gap: 2,
                px: 2,
                py: 1,
                border: 1,
                borderColor: 'primary.light',
                borderRadius: '10px',
                color: 'primary.dark',
                textAlign: 'left',
                '&:hover': { bgcolor: 'primary.tint' },
              })}
            >
              <Icon aria-hidden sx={{ color: 'primary.main' }} />
              <Typography variant="body1" component="span" sx={{ color: 'inherit' }}>
                {report.label}
              </Typography>
            </ButtonBase>
          </li>
        );
      })}
    </Box>
  );
}
