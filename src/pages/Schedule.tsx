import CalendarMonth from '@mui/icons-material/CalendarMonth';
import FormatListBulleted from '@mui/icons-material/FormatListBulleted';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { useApi } from '../api';
import type { ScheduleBlock, ScheduleDays, ScheduleRoom } from '../api';
import { HEADER_HEIGHT } from '../app/layout';
import { RESERVATIONS_PATH } from '../app/routes';
import {
  applyScheduleFilters,
  isScheduleEmpty,
  shiftScheduleStart,
  type ScheduleStep,
} from '../app/schedule';
import { applyMoves, mergeChangedBlocks, moveFailure, revertMoves } from '../app/scheduleGrid';
import { toMoveDatesRequest, toMoveRoomRequest, type DropResult } from '../app/scheduleDrag';
import {
  activeFilterCount,
  applyScheduleView,
  parseScheduleView,
  type ScheduleViewState,
} from '../app/scheduleUrl';
import { todayIso, type IsoDate } from '../lib/dates';
import { newRequestId } from '../lib/requestId';
import MoveConfirmDialog from '../components/schedule/MoveConfirmDialog';
import ScheduleControls from '../components/schedule/ScheduleControls';
import ScheduleFilterPanel from '../components/schedule/ScheduleFilterPanel';
import ScheduleSkeleton from '../components/schedule/ScheduleSkeleton';
import ScheduleGrid from '../components/schedule/ScheduleGrid';
import { useSchedule } from '../components/schedule/useSchedule';
import SaveToast from '../components/shared/SaveToast';

type Accepted = Extract<DropResult, { ok: true }>;

export interface ScheduleProps {
  /** Local calendar date treated as "today". Injectable for tests. */
  today?: IsoDate;
}

interface Pending {
  block: ScheduleBlock;
  result: Accepted;
}

interface Toast {
  id: number;
  message: string;
}

/**
 * Schedule (Figma 15967:188321): rooms down the side, dates across the top, reservations placed on
 * the grid. The view (start date, length, filters) lives in the URL. Desktop-first: the controls
 * wrap below 1200px and the grid scrolls inside its own container.
 */
export default function Schedule({ today: todayProp }: ScheduleProps) {
  const api = useApi();
  const today = useMemo(() => todayProp ?? todayIso(), [todayProp]);
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => parseScheduleView(params), [params]);
  const start = view.start ?? today;
  const schedule = useSchedule(start, view.days);
  const { setBlocks, retry } = schedule;

  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  // A move is in flight: the grid takes no new drags until its answer has been applied.
  const [moving, setMoving] = useState(false);
  // The rows as they were when a block was dropped: filters must not remove the row it came from
  // or went to while the move is being confirmed.
  const [frozenRooms, setFrozenRooms] = useState<ScheduleRoom[] | null>(null);
  const [note, setNote] = useState('');
  // The range the user is looking at now, for answers that arrive after they moved on.
  const currentRange = useRef({ startDate: start, days: view.days });
  useEffect(() => {
    currentRange.current = { startDate: start, days: view.days };
  }, [start, view.days]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<ScheduleViewState>) =>
      setParams(applyScheduleView(params, { ...view, ...patch })),
    [params, setParams, view],
  );
  const notify = useCallback((message: string) => {
    setToast((t) => ({ id: (t?.id ?? 0) + 1, message }));
    setToastOpen(true);
  }, []);

  const data = schedule.status === 'success' ? schedule.data : null;
  const liveRooms = useMemo(
    () =>
      data
        ? applyScheduleFilters(data, {
            locationIds: view.locationIds ?? undefined,
            roomTypeIds: view.roomTypeIds ?? undefined,
            availability: view.availability,
          }).rooms
        : [],
    [data, view.locationIds, view.roomTypeIds, view.availability],
  );
  const rooms = frozenRooms ?? liveRooms;

  const settle = useCallback(() => {
    setMoving(false);
    setFrozenRooms(null);
  }, []);

  const confirm = (scope: 'all-rooms' | 'this-room') => {
    if (!pending || !data) return;
    const { block, result } = pending;
    setPending(null);
    const moves = scope === 'this-room' ? result.splitMoves : result.moves;
    if (!moves) return;
    const range = { startDate: data.startDate, days: data.days };
    // The range the move was made in is still the one on screen (and loaded).
    const inRange = () =>
      currentRange.current.startDate === range.startDate &&
      currentRange.current.days === range.days;
    // Optimistic: show the move now.
    setMoving(true);
    setBlocks(range, (blocks) => applyMoves(blocks, moves));
    const requestId = newRequestId();
    const request =
      result.dialog === 'room-change'
        ? api.schedule.moveRoom(toMoveRoomRequest(result, block, requestId))
        : api.schedule.moveDates(toMoveDatesRequest(result, block, requestId, scope));
    request.then(
      (answer) => {
        if (inRange()) {
          setBlocks(range, (blocks) => mergeChangedBlocks({ ...range, blocks }, answer.blocks));
        } else {
          // The user moved to another window meanwhile; what it loaded may predate the move.
          retry();
        }
        notify(`Reservation ${block.confirmationNumber} moved.`);
        settle();
      },
      (error: unknown) => {
        const failure = moveFailure(error);
        if (failure.revert && inRange()) setBlocks(range, (blocks) => revertMoves(blocks, moves));
        if (failure.refetch || !inRange()) retry();
        notify(failure.message);
        settle();
      },
    );
  };

  const filterOptions = data
    ? {
        locations: data.locations,
        roomTypes: data.roomTypes,
      }
    : { locations: [], roomTypes: [] };
  const filtered =
    schedule.status === 'success' && !isScheduleEmpty(schedule.data) && rooms.length === 0;
  const toRoom = pending
    ? data?.rooms.find((r) => r.id === pending.result.moves[0].toRoomId)
    : undefined;

  let body;
  if (schedule.status === 'loading') body = <ScheduleSkeleton />;
  else if (schedule.status === 'error') {
    body = (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={schedule.retry}>
              Retry
            </Button>
          }
        >
          The schedule could not be loaded.
        </Alert>
      </Box>
    );
  } else if (isScheduleEmpty(schedule.data)) {
    body = (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="subtitle1">No rooms to show.</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Rooms appear here once they are set up.
        </Typography>
      </Box>
    );
  } else if (filtered) {
    body = (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="subtitle1">No rooms match the filters.</Typography>
        <Button
          sx={{ mt: 1 }}
          onClick={() => update({ locationIds: null, roomTypeIds: null, availability: 'all' })}
        >
          Clear filters
        </Button>
      </Box>
    );
  } else {
    body = (
      <ScheduleGrid
        data={schedule.data}
        rooms={rooms}
        today={today}
        busy={schedule.refreshing}
        locked={schedule.refreshing || moving}
        onDrop={(block, result) => {
          setFrozenRooms(liveRooms);
          setPending({ block, result });
        }}
        onRefuse={notify}
      />
    );
  }

  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        px: 2.5,
        pt: 2,
        pb: 2.5,
        boxSizing: 'border-box',
        [t.breakpoints.up('lg')]: {
          height: [
            `calc(100vh - ${t.spacing(HEADER_HEIGHT)})`,
            `calc(100dvh - ${t.spacing(HEADER_HEIGHT)})`,
          ],
        },
      })}
    >
      <Typography variant="h1" sx={visuallyHidden}>
        Schedule
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minHeight: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, pt: 2.5 }}>
          <ButtonGroup
            variant="outlined"
            aria-label="Schedule view"
            sx={{ '& .MuiButton-root': { borderColor: 'primary.outlinedBorder' } }}
          >
            <Button
              component={RouterLink}
              to={RESERVATIONS_PATH}
              aria-label="List view"
              sx={{ minWidth: (t) => t.spacing(5) }}
            >
              <FormatListBulleted />
            </Button>
            <Button
              variant="contained"
              aria-label="Calendar view"
              aria-current="page"
              sx={{ minWidth: (t) => t.spacing(5) }}
              disableElevation
            >
              <CalendarMonth />
            </Button>
          </ButtonGroup>
        </Box>
        <ScheduleControls
          days={view.days}
          start={start}
          today={today}
          availability={view.availability}
          activeFilters={activeFilterCount(view)}
          filtersOpen={filterAnchor !== null}
          onDays={(days: ScheduleDays) => update({ days })}
          onShift={(direction, step: ScheduleStep) =>
            update({ start: shiftScheduleStart(start, view.days, direction, step) })
          }
          onStart={(date) => update({ start: date })}
          onToday={() => update({ start: null })}
          onAvailability={(availability) => update({ availability })}
          onToggleFilters={(button) => setFilterAnchor((a) => (a ? null : button))}
        />
        <Box
          sx={(t) => ({
            flex: '1 1 auto',
            minHeight: 0,
            // Below 1200px the page scrolls and the grid gets a fixed, usable height.
            [t.breakpoints.down('lg')]: { flex: 'none', height: 'max(30rem, 70dvh)' },
          })}
        >
          {body}
        </Box>
      </Box>
      <ScheduleFilterPanel
        open={filterAnchor !== null}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        locations={filterOptions.locations}
        roomTypes={filterOptions.roomTypes}
        locationIds={view.locationIds}
        roomTypeIds={view.roomTypeIds}
        onLocations={(locationIds) => update({ locationIds })}
        onRoomTypes={(roomTypeIds) => update({ roomTypeIds })}
      />
      {pending ? (
        <MoveConfirmDialog
          block={pending.block}
          result={pending.result}
          toRoomNumber={toRoom?.number ?? ''}
          onCancel={() => {
            setPending(null);
            setFrozenRooms(null);
            setNote('Move cancelled.');
          }}
          onConfirm={() => confirm('all-rooms')}
          onSplit={() => confirm('this-room')}
        />
      ) : null}
      <Box role="status" sx={visuallyHidden}>
        {note}
      </Box>
      <SaveToast
        open={toastOpen}
        onClose={() => setToastOpen(false)}
        message={toast?.message ?? ''}
        saveId={toast?.id}
      />
    </Box>
  );
}
