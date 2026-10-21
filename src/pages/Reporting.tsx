import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useId } from 'react';
import { HEADER_HEIGHT } from '../app/layout';
import QuickStats from '../components/QuickStats';
import CustomReportsPanel from '../components/reporting/CustomReportsPanel';
import StandardReportTiles from '../components/reporting/StandardReportTiles';

/**
 * Reporting landing (Figma 310:7003): Quick Stats and the standard report tiles on the left, saved
 * custom reports on the right. From lg (1200px) the page fills the viewport and each side scrolls
 * on its own; below it the regions stack and the page scrolls. No header breadcrumb (D-020).
 */
export default function Reporting() {
  const quickId = useId();
  const standardId = useId();
  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        px: 3,
        pt: 3.5,
        pb: 4,
        [t.breakpoints.up('lg')]: {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 24rem)',
          columnGap: 3,
          height: [
            `calc(100vh - ${t.spacing(HEADER_HEIGHT)})`,
            `calc(100dvh - ${t.spacing(HEADER_HEIGHT)})`,
          ],
          boxSizing: 'border-box',
        },
      })}
    >
      <Typography variant="h1" sx={visuallyHidden}>
        Reporting
      </Typography>
      <Box sx={(t) => ({ minWidth: 0, [t.breakpoints.up('lg')]: { overflowY: 'auto', pr: 1 } })}>
        <Box component="section" aria-labelledby={quickId}>
          <Typography
            id={quickId}
            variant="h2"
            sx={{ typography: 'body1', fontWeight: 'bold', mb: 2 }}
          >
            Quick Stats
          </Typography>
          <QuickStats placement="landing" />
        </Box>
        <Divider sx={{ my: 3 }} />
        <Box component="section" aria-labelledby={standardId}>
          <Typography
            id={standardId}
            variant="h2"
            sx={{ typography: 'body1', fontWeight: 'bold', mb: 2 }}
          >
            Standard Reports
          </Typography>
          <StandardReportTiles />
        </Box>
      </Box>
      <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' } }} />
      <Divider sx={{ display: { lg: 'none' } }} />
      <CustomReportsPanel />
    </Box>
  );
}
