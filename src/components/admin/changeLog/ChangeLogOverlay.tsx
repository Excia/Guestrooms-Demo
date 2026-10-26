import { EditableIsland } from '../ReadOnlyProvider';
import Close from '@mui/icons-material/Close';
import ManageSearch from '@mui/icons-material/ManageSearch';
import Search from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
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
  changeTypeLabel,
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
  /** Only this record's changes (the setup list's three-dot menu); the title shows its name. */
  record?: { id: string; name: string };
  open: boolean;
  onClose: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;

const COLUMNS: { field: ChangeLogSortField | 'description'; label: string; width?: string }[] = [
  { field: 'date', label: 'Date', width: '15%' },
  { field: 'time', label: 'Time', width: '15%' },
  { field: 'changeType', label: 'Change Type', width: '15%' },
  { field: 'description', label: 'Description' },
  { field: 'actionBy', label: 'Action By', width: '25%' },
];

// Change Log dialog (Figma 16718:6217, decision D-AP-3): a page-specific log in a modal dialog, newest
// first, with sort and filter on date, time, change type and action by. The X closes it; so do Escape
// and a click on the backdrop. The table scrolls under a sticky header; the search sits in the header.
// The log is for looking things up: its filters stay usable on a View-only page (ticket 186).
export default function ChangeLogOverlay(props: ChangeLogOverlayProps) {
  return (
    <EditableIsland>
      <ChangeLogDialog {...props} />
    </EditableIsland>
  );
}

function ChangeLogDialog({ page, record, open, onClose }: ChangeLogOverlayProps) {
  const api = useApi();
  const titleId = useId();
  const [sort, setSort] = useState<ChangeLogSort>(DEFAULT_CHANGE_LOG_SORT);
  const [filters, setFilters] = useState<ChangeLogFilters>({});
  const [pageNumber, setPageNumber] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(CHANGE_LOG_ROWS_PER_PAGE);
  const [eventTypes, setEventTypes] = useState<ChangeEventType[]>([]);
  const [typesStatus, setTypesStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  // What is typed in the search box; it reaches the query after a pause (or on Done).
  const [searchDraft, setSearchDraft] = useState('');

  // The event types table drives the Change Type filter.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    api.changeLog
      .listEventTypes({ signal: controller.signal })
      .then((types) => {
        setEventTypes(types);
        setTypesStatus('ready');
      })
      .catch(() => {
        // The log still works; the Change Type filter says the types could not be loaded.
        if (!controller.signal.aborted) setTypesStatus('error');
      });
    return () => controller.abort();
  }, [api, open]);

  const appliedSearch = filters.search;
  // Search as the user pauses typing, not on every keystroke.
  useEffect(() => {
    const next = searchDraft.trim() || undefined;
    if (next === appliedSearch) return;
    const timer = setTimeout(() => {
      setFilters((f) => ({ ...f, search: next }));
      setPageNumber(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchDraft, appliedSearch]);

  const query: ChangeLogQuery = useMemo(
    () => ({ page, recordId: record?.id, sort, ...filters, pageNumber, limit: rowsPerPage }),
    [page, record?.id, sort, filters, pageNumber, rowsPerPage],
  );
  const { status, items, total, retry } = useChangeLog(query, open);
  const active = activeFilterColumns(filters);
  // Null until the types arrive, so no cell shows a raw id.
  const typeLabels = useMemo(
    () => (typesStatus === 'ready' ? new Map(eventTypes.map((t) => [t.id, t.label])) : null),
    [eventTypes, typesStatus],
  );
  const reloading = status === 'loading' && items.length > 0;

  const applyFilters = (next: ChangeLogFilters) => {
    setFilters(next);
    setPageNumber(1);
  };

  const clearAll = () => {
    setSearchDraft('');
    applyFilters({});
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
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      maxWidth={false}
      scroll="paper"
      slotProps={{
        paper: {
          sx: (t) => ({
            // Legacy hub change log modal: 85vw wide, 80vh tall. Below 600px it keeps 16px margins.
            width: '85vw',
            height: '80vh',
            m: 4,
            display: 'flex',
            flexDirection: 'column',
            [t.breakpoints.down('sm')]: {
              width: '100%',
              m: 2,
              maxHeight: `calc(100% - ${t.spacing(4)})`,
            },
          }),
        },
      }}
    >
      <Box
        sx={(t) => ({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          px: 2.5,
          pt: 2,
          pb: 1.5,
          borderBottom: `1px solid ${t.palette.divider}`,
        })}
      >
        <Typography
          id={titleId}
          variant="subtitle1"
          component="h2"
          sx={{ fontWeight: 'bold', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {changeLogTitle(page, record?.name)}
        </Typography>
        <Box
          component="form"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((f) => ({ ...f, search: searchDraft.trim() || undefined }));
            setPageNumber(1);
          }}
          sx={(t) => ({ flex: '0 1 auto', width: { xs: '100%', sm: t.spacing(40) } })}
        >
          <TextField
            label="Search descriptions"
            size="small"
            fullWidth
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    {active.has('search') ? (
                      <ManageSearch color="primary" aria-hidden />
                    ) : (
                      <Search color="primary" aria-hidden />
                    )}
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
        <IconButton aria-label="Close Change Log" onClick={onClose} edge="end">
          <Close />
        </IconButton>
      </Box>
      <Box component="p" role="status" sx={{ ...visuallyHidden }}>
        {status === 'loading'
          ? 'Loading change log'
          : status === 'ready'
            ? `${total} ${total === 1 ? 'change' : 'changes'}`
            : ''}
      </Box>
      {active.size > 0 ? (
        <Box sx={{ px: 2.5, pt: 1 }}>
          <Button onClick={clearAll}>Clear all filters</Button>
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 2.5 }}>
        <Table
          stickyHeader
          aria-labelledby={titleId}
          aria-busy={status === 'loading'}
          size="medium"
          sx={{ opacity: reloading ? 0.5 : 1 }}
        >
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
                        typesStatus={typesStatus}
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
                      : record
                        ? 'No changes have been recorded for this item in the last year.'
                        : 'No changes have been recorded for this page in the last year.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {items.map((entry) => (
              <TableRow key={entry.id} hover>
                <TableCell>{formatLogDate(entry.date)}</TableCell>
                <TableCell>{formatLogTime(entry.time)}</TableCell>
                <TableCell>{changeTypeLabel(entry.changeType, typeLabels) ?? '…'}</TableCell>
                <TableCell>{entry.description}</TableCell>
                <TableCell>{entry.actionBy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {body ? <Box sx={{ mt: 2 }}>{body}</Box> : null}
      </Box>
      <Box
        sx={(t) => ({
          px: 2.5,
          py: 1.5,
          borderTop: `1px solid ${t.palette.divider}`,
        })}
      >
        {status !== 'error' ? (
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
        ) : null}
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          Changes are kept for one year.
        </Typography>
      </Box>
    </Dialog>
  );
}
