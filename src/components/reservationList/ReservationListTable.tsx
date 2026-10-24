import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
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
import type { ReservationListRow, ReservationListSort, ReservationListSortField } from '../../api';
import type { IsoDate } from '../../lib/dates';
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

interface Column {
  id: string;
  label: string;
  sort: ReservationListSortField;
}

// Figma column order (2524:36168). The newest frame has no filter icons: the header only sorts, and
// filtering is the toolbar's dates, Unassigned Only and Location plus the search pop-up.
export const COLUMNS: readonly Column[] = [
  { id: 'arrival', label: 'Check In', sort: 'arrival' },
  { id: 'departure', label: 'Check Out', sort: 'departure' },
  { id: 'res', label: 'Res #', sort: 'confirmationNumber' },
  { id: 'guest', label: 'Guest', sort: 'guestName' },
  { id: 'reserver', label: 'Reserver', sort: 'reserverName' },
  { id: 'block', label: 'Block', sort: 'blockName' },
  { id: 'location', label: 'Location', sort: 'locationName' },
  { id: 'roomType', label: 'Room Type', sort: 'roomTypeName' },
  { id: 'room', label: 'Room', sort: 'roomNumber' },
  { id: 'status', label: 'Status', sort: 'status' },
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
  /** Ids of rows a bulk action could not process: tinted until the next refresh (Figma 2524:36173). */
  failedIds?: ReadonlySet<string>;
  search: string;
  onSearch: (value: string) => void;
  selected: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (row: ReservationListRow) => void;
  /** The club's today: only reservations arriving today can be selected for bulk check in (ticket 163). */
  today?: IsoDate | null;
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
  const check = headerCheckState(rows, selected, props.today);
  const selectable = selectableRows(rows, props.today).length;
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
                    hideSortIcon
                    onClick={() => props.onSort(c.sort)}
                  >
                    {c.label}
                    {sort.field === c.sort ? (
                      <Box component="span" sx={visuallyHidden}>
                        {sort.direction === 'asc' ? ', sorted ascending' : ', sorted descending'}
                      </Box>
                    ) : null}
                  </TableSortLabel>
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
  failedIds,
  today,
}: { row: ReservationListRow } & ReservationListTableProps) {
  const failed = failedIds?.has(row.id) ?? false;
  const canceled = isCanceled(row);
  const room = roomLabel(row);
  const canSelect = isSelectable(row, today);
  const isSelected = selected.has(row.id);
  return (
    <TableRow
      hover
      selected={isSelected}
      onClick={() => onOpen(row)}
      sx={{
        cursor: 'pointer',
        fontStyle: canceled ? 'italic' : undefined,
        // Failed bulk-action rows: orange tint that wins over the selected and hover shades.
        ...(failed && {
          '&.MuiTableRow-root, &.Mui-selected, &.Mui-selected:hover, &.MuiTableRow-hover:hover': {
            backgroundColor: 'warning.background',
          },
        }),
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
          {failed ? (
            <Box component="span" sx={visuallyHidden}>
              , could not be checked in
            </Box>
          ) : null}
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
 * The search icon opens a pop-up with the field (requirements doc 16.8), so the table never
 * changes size. Typing filters after a short pause, Enter applies at once and closes, Escape
 * closes and returns focus to the icon; the X clears the query. The Figma frames show only the
 * button (see figma-deviations.md), so the pop-up uses the standard MUI Popover.
 */
function SearchButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // The URL changed elsewhere (Clear filters, Back): follow it.
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft.trim() === value) return;
    const timer = setTimeout(() => onChange(draft.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  const open = anchor !== null;
  const close = () => setAnchor(null);
  return (
    <>
      <Badge variant="dot" color="info" invisible={value === ''} overlap="rectangular">
        <IconButton
          aria-label={value === '' ? 'Search reservations' : 'Search reservations, filter active'}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={(t) => ({
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            borderRadius: `${t.shape.borderRadius}px`,
            '&:hover': { bgcolor: 'primary.dark' },
          })}
        >
          <Search />
        </IconButton>
      </Badge>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { 'aria-label': 'Search reservations', role: 'dialog' } }}
      >
        <Box sx={{ p: 2 }}>
          <TextField
            autoFocus
            size="small"
            label="Search reservations"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (draft.trim() !== value) onChange(draft.trim());
                close();
              }
            }}
            sx={{ width: (t) => t.spacing(35) }}
            slotProps={{
              htmlInput: { maxLength: 200 },
              input: {
                endAdornment:
                  draft !== '' ? (
                    <IconButton size="small" edge="end" aria-label="Clear search" onClick={clear}>
                      <Close fontSize="small" />
                    </IconButton>
                  ) : null,
              },
            }}
          />
        </Box>
      </Popover>
    </>
  );

  function clear() {
    setDraft('');
    if (value !== '') onChange('');
  }
}
