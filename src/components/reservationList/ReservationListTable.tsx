import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import type {
  ListStatus,
  ReservationListOptions,
  ReservationListRow,
  ReservationListSort,
  ReservationListSortField,
} from '../../api';
import { LIST_STATUSES } from '../../api';
import {
  formatListDate,
  headerCheckState,
  isCanceled,
  isSelectable,
  LIST_STATUS_LABELS,
  roomLabel,
  selectableRows,
} from '../../app/reservationList';
import { reservationHubPath } from '../../app/routes';
import type { TextFilterKey } from '../../app/reservationListUrl';
import ColumnFilter from './ColumnFilter';

type FilterSpec = { kind: 'text'; key: TextFilterKey } | { kind: 'status' } | { kind: 'roomType' };

interface Column {
  id: string;
  label: string;
  sort: ReservationListSortField;
  filter?: FilterSpec;
}

// Figma column order. Check In, Check Out and Location are filtered by the toolbar (date range,
// Location select), so their header carries no filter icon (see figma-deviations.md).
export const COLUMNS: readonly Column[] = [
  { id: 'arrival', label: 'Check In', sort: 'arrival' },
  { id: 'departure', label: 'Check Out', sort: 'departure' },
  {
    id: 'res',
    label: 'Res #',
    sort: 'confirmationNumber',
    filter: { kind: 'text', key: 'resNumber' },
  },
  { id: 'guest', label: 'Guest', sort: 'guestName', filter: { kind: 'text', key: 'guest' } },
  {
    id: 'reserver',
    label: 'Reserver',
    sort: 'reserverName',
    filter: { kind: 'text', key: 'reserver' },
  },
  { id: 'block', label: 'Block', sort: 'blockName', filter: { kind: 'text', key: 'block' } },
  { id: 'location', label: 'Location', sort: 'locationName' },
  { id: 'roomType', label: 'Room Type', sort: 'roomTypeName', filter: { kind: 'roomType' } },
  { id: 'room', label: 'Room', sort: 'roomNumber', filter: { kind: 'text', key: 'room' } },
  { id: 'status', label: 'Status', sort: 'status', filter: { kind: 'status' } },
];

const SKELETON_ROWS = 8;
const SEARCH_DELAY_MS = 300;

export interface ReservationListTableProps {
  rows: readonly ReservationListRow[];
  /** First load: skeleton rows. */
  loading: boolean;
  /** A changed query is loading; `rows` is the previous answer. */
  refreshing: boolean;
  sort: ReservationListSort;
  onSort: (field: ReservationListSortField) => void;
  text: Record<TextFilterKey, string>;
  onText: (key: TextFilterKey, value: string) => void;
  statuses: readonly ListStatus[];
  onStatuses: (value: ListStatus[]) => void;
  roomTypeIds: readonly string[];
  onRoomTypes: (value: string[]) => void;
  options: ReservationListOptions;
  search: string;
  onSearch: (value: string) => void;
  selected: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (row: ReservationListRow) => void;
  /** The Location column is hidden when the property has only one location (requirements doc 16.10.7). */
  showLocation: boolean;
  /** Replaces the rows (empty or error); the header stays so a filter can be changed or cleared. */
  message?: ReactNode;
}

/**
 * The Reservation List table (Figma 2524:23962). Server-side sort and filters: the header only
 * reports what the user picked. A row opens the Reservation Hub on click;
 * the checkbox selects without opening it. The Res # is a real link, so keyboard users reach the
 * hub with Tab and Enter (the row itself is not a tab stop).
 */
export default function ReservationListTable(props: ReservationListTableProps) {
  const { rows, loading, refreshing, sort, selected } = props;
  const columns = props.showLocation ? COLUMNS : COLUMNS.filter((c) => c.id !== 'location');
  const columnCount = columns.length + 1; // plus the search column
  const check = headerCheckState(rows, selected);
  const selectable = selectableRows(rows).length;
  return (
    <TableContainer
      sx={(t) => ({
        border: `1px solid ${t.palette.divider}`,
        overflowX: 'auto',
        opacity: refreshing ? 0.6 : 1,
        transition: t.transitions.create('opacity'),
      })}
    >
      <Table aria-label="Reservations" aria-busy={loading || refreshing} sx={{ minWidth: 1100 }}>
        <TableHead>
          <TableRow>
            {columns.map((c, i) => (
              <TableCell
                key={c.id}
                scope="col"
                aria-sort={
                  sort.field === c.sort
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
                sx={{ fontWeight: 500, whiteSpace: 'nowrap', py: 0.875, pl: i === 0 ? 0.5 : 2 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {i === 0 ? (
                    <Checkbox
                      checked={check === 'all'}
                      indeterminate={check === 'some'}
                      disabled={selectable === 0}
                      onChange={props.onToggleAll}
                      slotProps={{
                        input: { 'aria-label': 'Select all selectable reservations' },
                      }}
                    />
                  ) : null}
                  <TableSortLabel
                    active={sort.field === c.sort}
                    direction={sort.field === c.sort ? sort.direction : 'asc'}
                    onClick={() => props.onSort(c.sort)}
                  >
                    {c.label}
                    {sort.field === c.sort ? (
                      <Box component="span" sx={visuallyHidden}>
                        {sort.direction === 'asc' ? ', sorted ascending' : ', sorted descending'}
                      </Box>
                    ) : null}
                  </TableSortLabel>
                  {c.filter ? <HeaderFilter column={c} {...props} /> : null}
                </Box>
              </TableCell>
            ))}
            <TableCell align="right" sx={{ py: 0.5, pr: 1 }}>
              <SearchButton value={props.search} onChange={props.onSearch} />
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <SkeletonRows columnCount={columnCount} />
          ) : props.message ? (
            <TableRow>
              <TableCell colSpan={columnCount} sx={{ p: 0, borderBottom: 0 }}>
                {props.message}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => <ListRow key={row.id} row={row} {...props} />)
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function HeaderFilter({
  column,
  text,
  onText,
  statuses,
  onStatuses,
  roomTypeIds,
  onRoomTypes,
  options,
}: { column: Column } & ReservationListTableProps) {
  const filter = column.filter;
  if (!filter) return null;
  if (filter.kind === 'text') {
    return (
      <ColumnFilter
        kind="text"
        label={column.label}
        value={text[filter.key]}
        onChange={(v) => onText(filter.key, v)}
      />
    );
  }
  if (filter.kind === 'status') {
    return (
      <ColumnFilter
        kind="list"
        label="Status"
        options={LIST_STATUSES.map((s) => ({ value: s, label: LIST_STATUS_LABELS[s] }))}
        value={statuses}
        onChange={(v) => onStatuses(v as ListStatus[])}
      />
    );
  }
  return (
    <ColumnFilter
      kind="list"
      label="Room Type"
      options={options.roomTypes.map((t) => ({ value: t.id, label: t.name }))}
      value={roomTypeIds}
      onChange={onRoomTypes}
    />
  );
}

function SkeletonRows({ columnCount }: { columnCount: number }) {
  return (
    <>
      <TableRow>
        <TableCell colSpan={columnCount} sx={{ p: 0, border: 0 }}>
          <Box role="status" sx={visuallyHidden}>
            Loading reservations
          </Box>
        </TableCell>
      </TableRow>
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <TableRow key={i} aria-hidden>
          {Array.from({ length: columnCount }, (_, j) => (
            <TableCell key={j}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function ListRow({
  row,
  selected,
  onToggleRow,
  onOpen,
  showLocation,
}: { row: ReservationListRow } & ReservationListTableProps) {
  const canceled = isCanceled(row);
  const room = roomLabel(row);
  const canSelect = isSelectable(row);
  const isSelected = selected.has(row.id);
  return (
    <TableRow
      hover
      selected={isSelected}
      onClick={() => onOpen(row)}
      sx={{
        cursor: 'pointer',
        fontStyle: canceled ? 'italic' : undefined,
        '& > .MuiTableCell-root': { fontStyle: 'inherit' },
      }}
    >
      <TableCell sx={{ py: 0, pl: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {canSelect ? (
            <Checkbox
              checked={isSelected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onToggleRow(row.id)}
              slotProps={{
                input: { 'aria-label': `Select reservation ${row.confirmationNumber}` },
              }}
            />
          ) : (
            // Keeps the dates aligned with the selectable rows.
            <Box aria-hidden sx={{ width: (t) => t.spacing(5.75), flexShrink: 0 }} />
          )}
          <Typography variant="body2" component="span" sx={{ whiteSpace: 'nowrap' }}>
            {formatListDate(row.arrival)}
          </Typography>
        </Box>
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatListDate(row.departure)}</TableCell>
      <TableCell>
        <Box
          component={RouterLink}
          to={reservationHubPath(row.id)}
          onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
          sx={{
            color: 'inherit',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {row.confirmationNumber}
        </Box>
      </TableCell>
      <TableCell>{row.guestName}</TableCell>
      <TableCell>{row.reserverName}</TableCell>
      <TableCell>{row.blockName}</TableCell>
      {showLocation ? <TableCell>{row.locationName}</TableCell> : null}
      <TableCell>{row.roomTypeName}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        <Box component="span" sx={{ color: room.unassigned ? 'error.main' : undefined }}>
          {room.text}
        </Box>
        {room.extra > 0 ? ` +${room.extra}` : null}
      </TableCell>
      <TableCell sx={{ fontWeight: canceled ? 700 : undefined }}>
        {LIST_STATUS_LABELS[row.status]}
      </TableCell>
      <TableCell />
    </TableRow>
  );
}

/**
 * The search icon expands into a field (requirements doc 16.8); typing filters after a short pause,
 * the X clears it and collapses back to the icon.
 */
function SearchButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(value !== '');
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // The URL changed elsewhere (Clear filters, Back): follow it.
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
    setOpen(value !== '');
  }
  useEffect(() => {
    if (draft.trim() === value) return;
    const timer = setTimeout(() => onChange(draft.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  if (!open) {
    return (
      <IconButton
        aria-label="Search reservations"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        sx={(t) => ({
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: `${t.shape.borderRadius}px`,
          '&:hover': { bgcolor: 'primary.dark' },
        })}
      >
        <Search />
      </IconButton>
    );
  }
  return (
    <TextField
      autoFocus
      size="small"
      label="Search reservations"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') clear();
      }}
      sx={{ width: (t) => t.spacing(30) }}
      slotProps={{
        htmlInput: { maxLength: 200 },
        input: {
          endAdornment: (
            <IconButton size="small" edge="end" aria-label="Clear search" onClick={clear}>
              <Close fontSize="small" />
            </IconButton>
          ),
        },
      }}
    />
  );

  function clear() {
    setDraft('');
    setOpen(false);
    if (value !== '') onChange('');
  }
}
