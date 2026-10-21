import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useId, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  NEW_CUSTOM_REPORT_PATH,
  customReportPath,
  customReportSubtitle,
  filterCustomReports,
  sortCustomReports,
} from '../../app/reports';
import { useCustomReports } from './useCustomReports';

/** Right column of the Reporting landing page (Figma 310:7036 to 310:7039). */
export default function CustomReportsPanel() {
  const headingId = useId();
  const state = useCustomReports();
  const [query, setQuery] = useState('');
  const reports = state.status === 'success' ? state.reports : null;
  const sorted = useMemo(() => (reports ? sortCustomReports(reports) : []), [reports]);
  const visible = useMemo(() => filterCustomReports(sorted, query), [sorted, query]);
  const searching = query.trim() !== '';

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, height: '100%' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography id={headingId} variant="h2" sx={{ typography: 'body1', fontWeight: 'bold' }}>
          Custom Reports
        </Typography>
        <Button
          component={RouterLink}
          to={NEW_CUSTOM_REPORT_PATH}
          variant="outlined"
          size="large"
          startIcon={<AddIcon />}
        >
          New Report
        </Button>
      </Box>
      <TextField
        variant="standard"
        fullWidth
        placeholder="Search Custom Reports"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{
          htmlInput: { 'aria-label': 'Search Custom Reports' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon aria-hidden />
              </InputAdornment>
            ),
          },
        }}
      />
      {/* Announces the result count as the list filters. */}
      <Typography role="status" sx={visuallyHidden}>
        {reports ? `${visible.length} of ${reports.length} custom reports` : ''}
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {state.status === 'loading' && (
          <Box aria-busy="true" aria-label="Loading custom reports">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={64} sx={{ mb: 1 }} />
            ))}
          </Box>
        )}
        {state.status === 'error' && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={state.retry}>
                Retry
              </Button>
            }
          >
            Custom reports could not be loaded.
          </Alert>
        )}
        {reports && reports.length === 0 && (
          <Typography color="text.secondary">
            No custom reports yet. Use New Report to create one.
          </Typography>
        )}
        {reports && reports.length > 0 && visible.length === 0 && searching && (
          <Typography color="text.secondary">No custom reports match your search.</Typography>
        )}
        {visible.length > 0 && (
          <List aria-label="Custom reports" disablePadding>
            {visible.map((report) => (
              <ListItemButton
                key={report.id}
                component={RouterLink}
                to={customReportPath(report.id)}
                sx={{ borderBottom: 1, borderColor: 'divider', color: 'primary.dark' }}
              >
                <ListItemText
                  primary={report.name}
                  secondary={customReportSubtitle(report)}
                  slotProps={{ primary: { variant: 'body1' }, secondary: { variant: 'body2' } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
