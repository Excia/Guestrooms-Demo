import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { HEADER_HEIGHT } from '../app/layout';
import DashboardColumn from '../components/DashboardColumn';

export interface DashboardProps {
  /** Slot for the reservation shortcut list (ticket #15). */
  reservationManagement?: React.ReactNode;
  /** Slot for the Quick Stats stack (ticket #14). */
  quickStats?: React.ReactNode;
  /** Slot for the New Reservation search (ticket #16). */
  newReservation?: React.ReactNode;
}

function Placeholder({ name }: { name: string }) {
  return <Typography color="text.secondary">{name} content arrives in a later ticket.</Typography>;
}

/**
 * Dashboard (Figma 69:3712): three equal columns under the header. Desktop (>= 1200px): one row,
 * columns 450px wide at the 1512 design width (max 450px, centred on wider screens), 24px gutters,
 * filling the viewport below the 56px header; each column scrolls on its own. Below 1200px the
 * columns stack in the same order and the page scrolls.
 */
export default function Dashboard({
  reservationManagement = <Placeholder name="Reservation Management" />,
  quickStats = <Placeholder name="Quick Stats" />,
  newReservation = <Placeholder name="New Reservation" />,
}: DashboardProps) {
  return (
    <Box
      sx={(t) => ({
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        px: 3,
        pt: 3.5,
        pb: 4,
        [t.breakpoints.up('lg')]: {
          flexDirection: 'row',
          justifyContent: 'center',
          height: `calc(100dvh - ${t.spacing(HEADER_HEIGHT)})`,
          boxSizing: 'border-box',
        },
      })}
    >
      {/* Figma has no page title; the h1 is for screen readers. Column titles are h2. */}
      <Typography
        variant="h1"
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        Dashboard
      </Typography>
      <DashboardColumn title="Reservation Management">{reservationManagement}</DashboardColumn>
      <DashboardColumn title="Quick Stats">{quickStats}</DashboardColumn>
      <DashboardColumn title="New Reservation">{newReservation}</DashboardColumn>
    </Box>
  );
}
