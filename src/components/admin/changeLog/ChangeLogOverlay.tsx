import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useMemo, useState } from 'react';
import { useApi } from '../../../api';
import type {
  ChangeEventType,
  ChangeLogPageId,
  ChangeLogQuery,
  ChangeLogSort,
  ChangeLogSortField,
} from '../../../api/changeLogTypes';
import {
  activeFilterColumns,
  ariaSortFor,
  CHANGE_LOG_ROWS_PER_PAGE,
  changeLogTitle,
  DEFAULT_CHANGE_LOG_SORT,
  formatLogDate,
  formatLogTime,
  type ChangeLogFilters,
} from '../../../app/changeLog';
import Pagination from '../../shared/Pagination';
import ColumnFilter from './ColumnFilter';
import { useChangeLog } from './useChangeLog';

export interface ChangeLogOverlayProps {
  /** The admin page the overlay was opened from; only that page's changes are listed. */
  page: ChangeLogPageId;
  open: boolean;
  onClose: () => void;
}

const COLUMNS: { field: ChangeLogSortField | 'description'; label: string; width?: string }[] = [
  { field: 'date', label: 'Date', width: '15%' },
  { field: 'time', label: 'Time', width: '15%' },
  { field: 'changeType', label: 'Change Type', width: '15%' },
  { field: 'description', label: 'Description' },
  { field: 'actionBy', label: 'Action By', width: '25%' },
];

// Change Log overlay (Figma 16718:6217): a full-screen page-specific log, newest first, with sort and
// filter on date, time, change type and action by. The X closes it; Escape does too.
export default function ChangeLogOverlay({ page, open, onClose }: ChangeLogOverlayProps) {
  const api = useApi();
  const titleId = useId();
  const [sort, setSort] = useState<ChangeLogSort>(DEFAULT_CHANGE_LOG_SORT);
  const [filters, setFilters] = useState<ChangeLogFilters>({});
  const [pageNumber, setPageNumber] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(CHANGE_LOG_ROWS_PER_PAGE);
  const [eventTypes, setEventTypes] = useState<ChangeEventType[]>([]);
  const [searchAnchor, setSearchAnchor] = useState<HTMLElement | null>(null);

  // The event types table drives the Change Type filter.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    api.changeLog
      .listEventTypes({ signal: controller.signal })
      .then(setEventTypes)
      .catch(() => {
        // The log still works; the Change Type filter just has nothing to offer.
      });
    return () => controller.abort();
  }, [api, open]);

  const query: ChangeLogQuery = useMemo(
    () => ({ page, sort, ...filters, pageNumber, limit: rowsPerPage }),
    [page, sort, filters, pageNumber, rowsPerPage],
  );
  const { status, items, total, retry } = useChangeLog(query, open);
  const active = activeFilterColumns(filters);
  const typeLabels = useMemo(() => new Map(eventTypes.map((t) => [t.id, t.label])), [eventTypes]);

  const applyFilters = (next: ChangeLogFilters) => {
    setFilters(next);
    setPageNumber(1);
  };

  let body;
  if (status === 'error') {
    body = (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={retry}>
            Retry
          </Button>
        }
      >
        The change log could not be loaded.
      </Alert>
    );
  } else if (status === 'loading' && items.length === 0) {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading change log" />
      </Box>
    );
  }

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}
    >
      <IconButton
        aria-label="Close Change Log"
        onClick={onClose}
        sx={(t) => ({ position: 'absolute', top: t.spacing(1), right: t.spacing(1) })}
      >
        <Close fontSize="large" />
      </IconButton>
      <Box
        sx={(t) => ({
          bgcolor: 'background.paper',
          borderRadius: 1,
          mx: { xs: 1, lg: 5 },
          mt: 7.5,
          mb: 2,
          p: 2.5,
          [t.breakpoints.down('lg')]: { overflowX: 'auto' },
        })}
      >
        <Typography
          id={titleId}
          variant="subtitle1"
          component="h2"
          sx={{ fontWeight: 'bold', mb: 2 }}
        >
          {changeLogTitle(page)}
        </Typography>
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: 8, right: 0, zIndex: 1 }}>
            <IconButton
              aria-label="Search descriptions"
              aria-haspopup="dialog"
              onClick={(e) => setSearchAnchor(e.currentTarget)}
              sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                borderRadius: 1,
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <Search />
            </IconButton>
            <Popover
              open={Boolean(searchAnchor)}
              anchorEl={searchAnchor}
              onClose={() => setSearchAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{ paper: { role: 'dialog', 'aria-label': 'Search descriptions' } }}
            >
              <Box
                component="form"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearchAnchor(null);
                }}
                sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'center' }}
              >
                <TextField
                  autoFocus
                  label="Search descriptions"
                  size="small"
                  value={filters.search ?? ''}
                  onChange={(e) =>
                    applyFilters({ ...filters, search: e.target.value || undefined })
                  }
                />
                <Button type="submit" variant="contained">
                  Done
                </Button>
              </Box>
            </Popover>
          </Box>
          <Table aria-labelledby={titleId} size="medium">
            <TableHead>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableCell
                    key={c.field}
                    component="th"
                    scope="col"
                    aria-sort={c.field === 'description' ? undefined : ariaSortFor(sort, c.field)}
                    sx={{ width: c.width, whiteSpace: 'nowrap' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" component="span" sx={{ fontWeight: 500 }}>
                        {c.label}
                      </Typography>
                      {c.field !== 'description' ? (
                        <ColumnFilter
                          field={c.field}
                          label={c.label}
                          sort={sort}
                          onSort={(direction) => {
                            setSort({ field: c.field as ChangeLogSortField, direction });
                            setPageNumber(1);
                          }}
                          filters={filters}
                          onApply={applyFilters}
                          eventTypes={eventTypes}
                          active={active.has(c.field)}
                        />
                      ) : null}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {status === 'ready' && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length}>
                    <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      {active.size > 0
                        ? 'No changes match the filters.'
                        : 'No changes have been recorded for this page in the last year.'}
                    </Typography>
                    {active.size > 0 ? (
                      <Box sx={{ textAlign: 'center' }}>
                        <Button onClick={() => applyFilters({})}>Clear all filters</Button>
                      </Box>
                    ) : null}
                  </TableCell>
                </TableRow>
              ) : null}
              {items.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell>{formatLogDate(entry.date)}</TableCell>
                  <TableCell>{formatLogTime(entry.time)}</TableCell>
                  <TableCell>{typeLabels.get(entry.changeType) ?? entry.changeType}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>{entry.actionBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {body ? <Box sx={{ mt: 2 }}>{body}</Box> : null}
        {status !== 'error' ? (
          <Box sx={{ mt: 2 }}>
            <Pagination
              label="Change Log pages"
              page={pageNumber}
              rowsPerPage={rowsPerPage}
              total={status === 'ready' ? total : undefined}
              onChange={(next) => {
                setPageNumber(next.page);
                setRowsPerPage(next.rowsPerPage);
              }}
            />
          </Box>
        ) : null}
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
          Changes are kept for one year.
        </Typography>
      </Box>
    </Dialog>
  );
}
