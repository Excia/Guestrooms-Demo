import CalendarMonth from '@mui/icons-material/CalendarMonth';
import FormatListBulleted from '@mui/icons-material/FormatListBulleted';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import type { ReservationListRow } from '../api';
import { applyPanel } from '../app/panelUrl';
import { selectedRows, toggleAllRows, toggleRow } from '../app/reservationList';
import { useSystemSettings } from '../app/useSystemSettings';
import { clubClock } from '../lib/clubTime';
import {
  applyReservationListView,
  clearFilters,
  hasActiveFilters,
  nextSort,
  parseReservationListView,
  toListQuery,
  type ReservationListView,
} from '../app/reservationListUrl';
import { reservationHubPath, SCHEDULE_PATH } from '../app/routes';
import BulkCheckInButton from '../components/reservationList/BulkCheckInButton';
import CheckInResultDialog from '../components/reservationList/CheckInResultDialog';
import { useBulkCheckIn } from '../components/reservationList/useBulkCheckIn';
import ReservationListTable from '../components/reservationList/ReservationListTable';
import ReservationListToolbar from '../components/reservationList/ReservationListToolbar';
import {
  useReservationList,
  useReservationListOptions,
} from '../components/reservationList/useReservationList';
import Pagination from '../components/shared/Pagination';
import { todayIso, type IsoDate } from '../lib/dates';

export interface ReservationListProps {
  /** Local calendar date treated as "today". Injectable for tests. */
  today?: IsoDate;
  /** Called whenever the selected rows change; what bulk actions (ticket 3.2) build on. */
  onSelectionChange?: (rows: ReservationListRow[]) => void;
  /** Replaces the built-in "Check in N rooms" button under the table. */
  renderBulkActions?: (selected: ReservationListRow[]) => ReactNode;
  /** Extra rows to tint orange, besides those the built-in bulk check-in could not process. */
  failedIds?: ReadonlySet<string>;
}

const NO_OPTIONS = { locations: [], roomTypes: [] };

/**
 * Reservation List (Figma 2524:23962): a filterable, sortable, paged table with row selection for
 * bulk actions. Filters, sort and page live in the URL; the server does the filtering. Desktop-first:
 * the toolbar wraps below 1200px and the table scrolls sideways inside its container.
 */
export default function ReservationList({
  today: todayProp,
  onSelectionChange,
  renderBulkActions,
  failedIds,
}: ReservationListProps) {
  const today = useMemo(() => todayProp ?? todayIso(), [todayProp]);
  // Bulk check in: "today" is the club's date (its time zone), not the browser's (ticket 163).
  const { settings: clubSettings } = useSystemSettings();
  const selectionToday = useMemo(
    () => todayProp ?? clubClock(clubSettings?.timeZone).date,
    [todayProp, clubSettings?.timeZone],
  );
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => parseReservationListView(params, today), [params, today]);
  const navigate = useNavigate();
  const query = useMemo(() => toListQuery(view), [view]);
  const queryKey = JSON.stringify(query);
  const bulk = useBulkCheckIn();
  const list = useReservationList(query, queryKey, bulk.reloadToken);
  const optionsState = useReservationListOptions();
  const options = optionsState.status === 'success' ? optionsState.options : NO_OPTIONS;

  // Two quick changes must both count: each builds on the latest URL state.
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  }, [params]);
  const update = useCallback(
    (patch: Partial<ReservationListView>) => {
      const current = parseReservationListView(latest.current, today);
      // Any change to what is listed goes back to the first page.
      const next = applyReservationListView(
        latest.current,
        { ...current, page: 1, ...patch },
        today,
      );
      latest.current = next;
      setParams(next);
    },
    [setParams, today],
  );

  // Selection belongs to the query it was made in: a new page, sort or filter starts empty.
  const [selection, setSelection] = useState<{ key: string; ids: ReadonlySet<string> }>({
    key: queryKey,
    ids: new Set(),
  });
  const rows = useMemo(() => (list.status === 'success' ? list.page.items : []), [list]);
  const selected = selection.key === queryKey ? selection.ids : EMPTY;
  const chosen = useMemo(
    () => selectedRows(rows, selected, selectionToday),
    [rows, selected, selectionToday],
  );
  const notify = useRef(onSelectionChange);
  useEffect(() => {
    notify.current = onSelectionChange;
  });
  const chosenKey = chosen.map((r) => r.id).join(',');
  useEffect(() => {
    notify.current?.(chosen);
    // `chosen` changes identity with `rows`; its ids are the real change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenKey]);

  const allFailed = useMemo(
    () => (failedIds ? new Set([...failedIds, ...bulk.failedIds]) : bulk.failedIds),
    [failedIds, bulk.failedIds],
  );

  const loading = list.status === 'loading';
  const total = list.status === 'success' ? list.page.total : undefined;
  const filtered = hasActiveFilters(view, today);

  let message: ReactNode = null;
  if (list.status === 'error') {
    message = (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={list.retry}>
              Retry
            </Button>
          }
        >
          The reservations could not be loaded.
        </Alert>
      </Box>
    );
  } else if (list.status === 'success' && rows.length === 0) {
    message = (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="subtitle1">
          {filtered ? 'No reservations match the filters.' : 'No reservations to show.'}
        </Typography>
        {filtered ? (
          <Button sx={{ mt: 1 }} onClick={() => update(clearFilters(view, today))}>
            Clear filters
          </Button>
        ) : (
          <Typography sx={{ color: 'text.secondary' }}>
            Reservations appear here once they are made.
          </Typography>
        )}
      </Box>
    );
  }

  const onSearch = useCallback((search: string) => update({ search }), [update]);
  const setSelected = (ids: Set<string>) => setSelection({ key: queryKey, ids });
  const viewButton = { minWidth: (t: { spacing: (n: number) => string }) => t.spacing(5) };

  return (
    <Box sx={{ px: 2.5, pt: 2, pb: 2.5, boxSizing: 'border-box' }}>
      <Typography variant="h1" sx={visuallyHidden}>
        Reservations
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          bgcolor: 'background.paper',
          p: 2,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ButtonGroup
            variant="outlined"
            aria-label="Reservation view"
            sx={{ '& .MuiButton-root': { borderColor: 'primary.outlinedBorder' } }}
          >
            <Button
              variant="contained"
              aria-label="List view"
              aria-current="page"
              sx={viewButton}
              disableElevation
            >
              <FormatListBulleted />
            </Button>
            <Button
              component={RouterLink}
              to={SCHEDULE_PATH}
              aria-label="Calendar view"
              sx={viewButton}
            >
              <CalendarMonth />
            </Button>
          </ButtonGroup>
        </Box>
        <ReservationListToolbar
          today={today}
          checkInFrom={view.checkInFrom}
          checkInTo={view.checkInTo}
          onDates={update}
          unassignedOnly={view.unassignedOnly}
          onUnassignedOnly={(unassignedOnly) => update({ unassignedOnly })}
          locations={options.locations}
          locationIds={view.locationIds}
          onLocations={(locationIds) => update({ locationIds })}
          onNewReservation={() =>
            void navigate({
              pathname: SCHEDULE_PATH,
              search: applyPanel(new URLSearchParams(), { kind: 'new' }).toString(),
            })
          }
        />
        <ReservationListTable
          rows={rows}
          loading={loading}
          refreshing={list.status === 'success' && list.refreshing}
          sort={view.sort}
          onSort={(field) => update({ sort: nextSort(view.sort, field) })}
          failedIds={allFailed}
          search={view.search}
          onSearch={onSearch}
          selected={selected}
          onToggleRow={(id) => setSelected(toggleRow(selected, id))}
          onToggleAll={() => setSelected(toggleAllRows(rows, selected, selectionToday))}
          today={selectionToday}
          showLocation={optionsState.status !== 'success' || options.locations.length > 1}
          onOpen={(row) => void navigate(reservationHubPath(row.id))}
          message={message}
        />
        {total !== undefined && total > 0 ? (
          <Pagination
            label="Reservations pages"
            page={view.page}
            rowsPerPage={view.rowsPerPage}
            total={total}
            onChange={({ page, rowsPerPage }) => update({ page, rowsPerPage })}
          />
        ) : null}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          {renderBulkActions ? (
            renderBulkActions(chosen)
          ) : (
            <BulkCheckInButton
              rows={chosen}
              running={bulk.running}
              onCheckIn={() => void bulk.checkIn(chosen)}
            />
          )}
        </Box>
        <CheckInResultDialog
          open={bulk.results !== null}
          results={bulk.results ?? []}
          onClose={bulk.dismiss}
        />
        <Box role="status" sx={visuallyHidden}>
          {chosen.length > 0 ? `${chosen.length} selected` : ''}
        </Box>
      </Box>
    </Box>
  );
}

const EMPTY: ReadonlySet<string> = new Set();
