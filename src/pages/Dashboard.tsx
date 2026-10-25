import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { HEADER_HEIGHT } from '../app/layout';
import ClubNewReservationSearch from '../components/ClubNewReservationSearch';
import ReservationManagement from '../components/ReservationManagement';
import DashboardColumn, { COLUMN_MAX_WIDTH_SPACING } from '../components/DashboardColumn';
import QuickStats from '../components/QuickStats';

/**
 * Slot contract: each slot is a ReactNode. `undefined` shows the default content, `null` renders an
 * empty column. Slot content must not set its own scroll or height (the column panel scrolls);
 * it is padded by the panel.
 */
export interface DashboardProps {
  /** Slot for the reservation shortcut list (ticket #15). */
  reservationManagement?: React.ReactNode;
  /** Slot for the Quick Stats stack (ticket #14). */
  quickStats?: React.ReactNode;
  /** Slot for the New Reservation search (ticket #16). */
  newReservation?: React.ReactNode;
}

/**
 * Dashboard (Figma 69:3712): three equal columns under the header. Desktop (>= 1200px): one row,
 * columns 450px wide at the 1512 design width (max 450px, centred on wider screens), 24px gutters,
 * filling the viewport below the 56px header; each column scrolls on its own. Below 1200px the
 * columns stack in the same order and the page scrolls.
 */
export default function Dashboard({
  reservationManagement = <ReservationManagement />,
  quickStats = <QuickStats placement="dashboard" />,
  newReservation = <ClubNewReservationSearch />,
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
          display: 'grid',
          // Three columns of at most 450px, centred; rows: titles (auto, shared) then panels (fill).
          gridTemplateColumns: `repeat(3, minmax(0, ${t.spacing(COLUMN_MAX_WIDTH_SPACING)}))`,
          gridTemplateRows: 'auto minmax(0, 1fr)',
          rowGap: 0, // title and panel touch; the title's own margin sets the spacing
          justifyContent: 'center',
          // vh first for browsers without dvh; dvh wins where supported.
          height: [
            `calc(100vh - ${t.spacing(HEADER_HEIGHT)})`,
            `calc(100dvh - ${t.spacing(HEADER_HEIGHT)})`,
          ],
          boxSizing: 'border-box',
        },
      })}
    >
      {/* Figma has no page title; the h1 is for screen readers. Column titles are h2. */}
      <Typography variant="h1" sx={visuallyHidden}>
        Dashboard
      </Typography>
      <DashboardColumn title="Reservation Management" disablePadding>
        {reservationManagement}
      </DashboardColumn>
      <DashboardColumn title="Quick Stats">{quickStats}</DashboardColumn>
      <DashboardColumn title="New Reservation">{newReservation}</DashboardColumn>
    </Box>
  );
}
