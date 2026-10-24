import CalendarMonth from '@mui/icons-material/CalendarMonth';
import FormatListBulleted from '@mui/icons-material/FormatListBulleted';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../api';
import type {
  ReservationDetail,
  ScheduleBlock,
  ScheduleClosure,
  ScheduleDays,
  ScheduleRoom,
} from '../api';
import { HEADER_HEIGHT, RESERVATION_PANEL_SIDE, toastSideFor, type PanelSide } from '../app/layout';
import { RESERVATIONS_PATH } from '../app/routes';
import {
  applyScheduleFilters,
  filterUnassigned,
  isScheduleEmpty,
  knownIds,
  shiftScheduleStart,
  showLocationFilter,
  type ScheduleStep,
} from '../app/schedule';
import { applyRoomPlan, changeRoomFailure, mergeRoomPlan, revertRoomPlan } from '../app/changeRoom';
import { stayOf } from '../lib/stayPlan';
import { applyPanel, closePanel, parsePanel } from '../app/panelUrl';
import type { EarlyLateValues } from '../app/earlyLate';
import {
  applyHousekeeping,
  applyMoves,
  housekeepingFailure,
  mergeChangedBlocks,
  moveFailure,
  revertMoves,
  type HousekeepingPatch,
} from '../app/scheduleGrid';
import { RESERVATION_EDIT_PERMISSION, usePermissions } from '../app/permissions';
import { toMoveDatesRequest, toMoveRoomRequest, type DropResult } from '../app/scheduleDrag';
import {
  activeFilterCount,
  applyScheduleView,
  parseScheduleView,
  type ScheduleViewState,
} from '../app/scheduleUrl';
import { type IsoDate } from '../lib/dates';
import { useClubDay } from '../app/useClubToday';
import type { ActiveEvent } from '../app/scheduleBlockState';
import { newRequestId } from '../lib/requestId';
import type { RoomChangeSubmission } from '../components/reservation/ChangeRoomDialog';
import ReservationPanel from '../components/reservation/ReservationPanel';
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
  /** Side the reservation panel flies out from; the one setting in layout.ts by default. Injectable for tests. */
  panelSide?: PanelSide;
}

interface Pending {
  block: ScheduleBlock;
  result: Accepted;
}

type ToastSeverity = 'success' | 'warning' | 'error';

interface Toast {
  id: number;
  message: string;
  severity: ToastSeverity;
}

/**
 * Schedule (Figma 15967:188321): rooms down the side, dates across the top, reservations placed on
 * the grid. The view (start date, length, filters) lives in the URL. Desktop-first: the controls
 * wrap below 1200px and the grid scrolls inside its own container.
 */
export default function Schedule({
  today: todayProp,
  panelSide = RESERVATION_PANEL_SIDE,
}: ScheduleProps) {
  const api = useApi();
  // "Today" is the club's date (its System Settings time zone), not the browser's.
  const { today, settled: clubSettled } = useClubDay(todayProp);
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => parseScheduleView(params), [params]);
  const start = view.start ?? today;
  // Without a `start` in the URL the range begins on the club's today, which is only known once the
  // settings have settled: fetching the browser-date range first would be thrown away, and a move
  // started on it could be lost. A `start` in the URL, or a `today` given to the page, needs no wait.
  const schedule = useSchedule(
    start,
    view.days,
    view.start !== null || todayProp !== undefined || clubSettled,
  );
  const { setBlocks, retry } = schedule;
  const navigate = useNavigate();
  const location = useLocation();
  const panel = useMemo(() => parsePanel(params), [params]);
  // The event whose panel is open: its blocks are highlighted on the grid.
  const panelReservationId = panel?.kind === 'details' ? panel.reservationId : undefined;
  const panelRoomId = panel?.kind === 'details' ? panel.reservationRoomId : undefined;
  const activeEvent = useMemo<ActiveEvent | null>(
    () =>
      panelReservationId
        ? {
            reservationId: panelReservationId,
            ...(panelRoomId ? { reservationRoomId: panelRoomId } : {}),
          }
        : null,
    [panelReservationId, panelRoomId],
  );
  const locationState = useRef<unknown>(location.state);
  useEffect(() => {
    locationState.current = location.state;
  }, [location.state]);
  const [justCreated, setJustCreated] = useState<string | undefined>(undefined);

  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  // A move is in flight: the grid takes no new drags until its answer has been applied.
  const [moving, setMoving] = useState(false);
  // The rows as they were when a block was dropped: filters must not remove the row it came from
  // or went to while the move is being confirmed.
  const [frozenRooms, setFrozenRooms] = useState<ScheduleRoom[] | null>(null);
  // Screen-reader note ("Move cancelled."): a fresh element per announcement so repeats are read,
  // cleared after a moment so stale text is not left to browse.
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const announce = useCallback((text: string) => {
    clearTimeout(noteTimer.current);
    setNote((n) => ({ id: (n?.id ?? 0) + 1, text }));
    noteTimer.current = setTimeout(() => setNote(null), 2000);
  }, []);
  useEffect(() => () => clearTimeout(noteTimer.current), []);
  // Set synchronously: React state alone lets same-tick repeat clicks submit again.
  const submitted = useRef(false);
  // The range the user is looking at now, for answers that arrive after they moved on.
  const currentRange = useRef({ startDate: start, days: view.days });
  useEffect(() => {
    currentRange.current = { startDate: start, days: view.days };
  }, [start, view.days]);
  // A room change during a stay is in flight (ticket 2.3); `detailRefresh` reloads the open details.
  const [roomChanging, setRoomChanging] = useState(false);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const changeSubmitted = useRef(false);
  // The dialog reopens on its first step when what the user saw has drifted (see changeRoomFailure).
  const [reopen, setReopen] = useState<{
    stayId: string;
    edits: Record<IsoDate, string>;
    nonce: number;
  } | null>(null);
  // The server owns "today" (the club's): when it differs from this browser's, the panel follows it.
  const [serverToday, setServerToday] = useState<IsoDate | undefined>(undefined);
  // It lasts while the panel it was learned for is open.
  if (!panel && serverToday !== undefined) setServerToday(undefined);
  // The blocks on screen, readable from callbacks that outlive a render.
  const loadedBlocks = useRef<ScheduleBlock[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  // Two quick clicks must both count: each update builds on the latest URL state, not on the
  // render the handler was created in.
  const latestParams = useRef(params);
  useEffect(() => {
    latestParams.current = params;
  }, [params]);
  const update = useCallback(
    (
      patch:
        Partial<ScheduleViewState> | ((current: ScheduleViewState) => Partial<ScheduleViewState>),
    ) => {
      const current = parseScheduleView(latestParams.current);
      const next = applyScheduleView(latestParams.current, {
        ...current,
        ...(typeof patch === 'function' ? patch(current) : patch),
      });
      latestParams.current = next;
      setParams(next);
    },
    [setParams],
  );
  const notify = useCallback((message: string, severity: ToastSeverity = 'success') => {
    setToast((t) => ({ id: (t?.id ?? 0) + 1, message, severity }));
    setToastOpen(true);
  }, []);

  // ---- reservation panel (state in the URL: reload, Back and Forward work) ----
  // Opening adds a history entry that remembers the URL it came from. Closing goes Back when that
  // entry is still the one on screen, so the history has no panel left over; otherwise (a reload,
  // a shared link) it replaces the URL with the same view without the panel. Either way the view,
  // date range and filters are exactly what they were.
  // What had focus when the panel opened (the grid, or the New Reservation button): focus goes back
  // there once the panel has closed, however it was closed (the modal's own restore needs the page focused).
  const panelTrigger = useRef<HTMLElement | null>(null);
  const restoreFocus = useCallback(() => {
    const trigger = panelTrigger.current;
    panelTrigger.current = null;
    setJustCreated(undefined);
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }, []);
  const openPanel = useCallback(
    (next: Parameters<typeof applyPanel>[1], trigger?: HTMLElement) => {
      const active = document.activeElement;
      panelTrigger.current =
        trigger ?? (active instanceof HTMLElement && active !== document.body ? active : null);
      const base = closePanel(latestParams.current);
      const search = applyPanel(latestParams.current, next);
      latestParams.current = search;
      setParams(search, { state: { panelFrom: base.toString() } });
    },
    [setParams],
  );
  const closeCurrentPanel = useCallback(() => {
    const base = closePanel(latestParams.current);
    const from = (location.state as { panelFrom?: string } | null)?.panelFrom;
    latestParams.current = base;
    if (from !== undefined && from === base.toString() && location.key !== 'default') {
      void navigate(-1);
    } else {
      setParams(base, { replace: true });
    }
  }, [location.state, location.key, navigate, setParams]);
  const openDetails = useCallback(
    (block: ScheduleBlock) =>
      openPanel({
        kind: 'details',
        reservationId: block.reservationId,
        // A part of a stay that changed room belongs to the reservation room of the whole stay.
        reservationRoomId: stayOf(block),
      }),
    [openPanel],
  );
  // ---- closures (ticket 149) ----
  const onClosureSaved = useCallback(
    (_closure: ScheduleClosure, created: boolean) => {
      retry();
      notify(created ? 'Closure created.' : 'Closure saved.');
      closeCurrentPanel();
    },
    [retry, notify, closeCurrentPanel],
  );
  const onClosureRemoved = useCallback(
    (_closure: ScheduleClosure, roomNumber: string) => {
      retry();
      notify(`Room ${roomNumber} Closure removed.`);
      closeCurrentPanel();
    },
    [retry, notify, closeCurrentPanel],
  );
  // Duplicate: the New Room Closure tab, filled with the closure. Replaces the details entry, so
  // closing still goes Back once.
  const duplicateClosure = useCallback(
    (closure: ScheduleClosure) => {
      const next = applyPanel(latestParams.current, {
        kind: 'new',
        tab: 'closure',
        roomId: closure.roomId,
        arrival: closure.startDate,
        end: closure.endDate,
        description: closure.reason,
      });
      latestParams.current = next;
      setParams(next, { replace: true, state: locationState.current });
    },
    [setParams],
  );
  const changeNewTab = useCallback(
    (tab: 'reservation' | 'closure') => {
      const current = parsePanel(latestParams.current);
      if (current?.kind !== 'new') return;
      const next = applyPanel(
        latestParams.current,
        tab === 'closure'
          ? { kind: 'new', tab: 'closure', roomId: current.roomId, arrival: current.arrival }
          : { kind: 'new', roomId: current.roomId, arrival: current.arrival },
      );
      latestParams.current = next;
      setParams(next, { replace: true, state: locationState.current });
    },
    [setParams],
  );
  const openClosure = useCallback(
    (closure: ScheduleClosure) => openPanel({ kind: 'closure', closureId: closure.id }),
    [openPanel],
  );
  const onCreated = useCallback(
    (detail: ReservationDetail) => {
      retry();
      notify(
        detail.rooms.every((r) => r.roomId !== null)
          ? `Reservation ${detail.confirmationNumber} created.`
          : `Reservation ${detail.confirmationNumber} created without a room. It will not appear on the schedule until a room is assigned.`,
      );
      const next = applyPanel(latestParams.current, {
        kind: 'details',
        reservationId: detail.id,
        reservationRoomId: detail.rooms[0]?.id,
      });
      latestParams.current = next;
      setJustCreated(detail.id);
      // Keep the history state (where the panel was opened from), so closing still goes Back once.
      setParams(next, { replace: true, state: locationState.current });
    },
    [retry, notify, setParams],
  );
  const onEarlyLateSaved = useCallback(
    (reservationId: string, values: EarlyLateValues) => {
      const range = currentRange.current;
      // A stay that changed room is several blocks and the markers sit on only some of them: the
      // server knows which, so load the schedule again instead of guessing.
      if (loadedBlocks.current.some((b) => b.reservationId === reservationId && b.roomChange)) {
        retry();
        return;
      }
      setBlocks(range, (blocks) =>
        blocks.map((b) =>
          b.reservationId === reservationId
            ? {
                ...b,
                earlyCheckIn: values.earlyCheckIn || undefined,
                lateCheckOut: values.lateCheckOut || undefined,
              }
            : b,
        ),
      );
    },
    [setBlocks, retry],
  );

  // Housekeeping status and notes from the schedule's "H" chip: shown at once, put back (with a
  // message) if the save fails. Needs the same permission as editing a reservation.
  const canEditHousekeeping = usePermissions().can(RESERVATION_EDIT_PERMISSION);
  const setHousekeeping = useCallback(
    async (block: ScheduleBlock, patch: HousekeepingPatch): Promise<boolean> => {
      const range = { ...currentRange.current };
      const before = { status: block.housekeeping, notes: block.housekeepingNotes ?? '' };
      setBlocks(range, (blocks) => applyHousekeeping(blocks, block.id, patch));
      try {
        const answer = await api.schedule.setHousekeeping({
          reservationRoomId: block.id,
          status: patch.status,
          notes: patch.notes,
          version: block.version,
          requestId: newRequestId(),
        });
        const same =
          currentRange.current.startDate === range.startDate &&
          currentRange.current.days === range.days;
        const merged =
          same &&
          setBlocks(range, (blocks) => mergeChangedBlocks({ ...range, blocks }, answer.blocks));
        if (!merged) retry();
        return true;
      } catch (error) {
        const failure = housekeepingFailure(error);
        // Only the two housekeeping fields go back, so a move made meanwhile is left alone.
        setBlocks(range, (blocks) => applyHousekeeping(blocks, block.id, before));
        if (failure.refetch) retry();
        notify(failure.message);
        return false;
      }
    },
    [api, setBlocks, retry, notify],
  );

  const data = schedule.status === 'success' ? schedule.data : null;
  useEffect(() => {
    loadedBlocks.current = data?.blocks ?? [];
  }, [data]);
  // Only what the panel offers counts: no location list for a one-location club, and no feature
  // ids that are not in the data (a stale link must not hide every room or show as applied).
  const effectiveView = useMemo<ScheduleViewState>(
    () => ({
      ...view,
      locationIds: data && showLocationFilter(data.locations) ? view.locationIds : null,
      featureIds: knownIds(view.featureIds, data?.features ?? []),
    }),
    [view, data],
  );
  const liveRooms = useMemo(
    () =>
      data
        ? applyScheduleFilters(data, {
            // A club with one location has no Locations group, so a stale ?locations= is ignored.
            locationIds: effectiveView.locationIds ?? undefined,
            roomTypeIds: view.roomTypeIds ?? undefined,
            availability: view.availability,
            housekeeping: view.housekeeping,
            featureIds: effectiveView.featureIds,
          }).rooms
        : [],
    [data, view.roomTypeIds, view.availability, view.housekeeping, effectiveView],
  );
  // The Housekeeping filter also hides the unassigned reservations that do not match.
  const filteredUnassigned = useMemo(
    () =>
      schedule.status === 'success' && view.housekeeping.length > 0
        ? filterUnassigned(schedule.data.unassigned, view.housekeeping)
        : null,
    [schedule, view.housekeeping],
  );
  const rooms = frozenRooms ?? liveRooms;

  const settle = useCallback(() => {
    submitted.current = false;
    setMoving(false);
    setFrozenRooms(null);
  }, []);

  const confirm = (scope: 'all-rooms' | 'this-room') => {
    if (submitted.current || !pending || !data) return;
    const { block, result } = pending;
    setPending(null);
    const moves = scope === 'this-room' ? result.splitMoves : result.moves;
    if (!moves) {
      setFrozenRooms(null);
      return;
    }
    submitted.current = true;
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
        // If the data on screen is not this range (the user left and came back, and its fetch is
        // still running), that fetch may predate the move: load it again.
        const merged =
          inRange() &&
          setBlocks(range, (blocks) => mergeChangedBlocks({ ...range, blocks }, answer.blocks));
        if (!merged) retry();
        notify(`Reservation ${block.confirmationNumber} moved.`);
        settle();
      },
      (error: unknown) => {
        const failure = moveFailure(error);
        const reverted =
          failure.revert && inRange() && setBlocks(range, (blocks) => revertMoves(blocks, moves));
        if (failure.refetch || (failure.revert && !reverted)) retry();
        // An unknown outcome is a warning (look again); a clear failure is an error.
        notify(failure.message, failure.revert ? 'error' : 'warning');
        settle();
      },
    );
  };

  /**
   * A confirmed room change during the stay. Shown at once on the grid (the block moves and the
   * nights already stayed stay behind in the old room), then confirmed or rolled back like a drag:
   * a clear 4xx reverts, an unknown outcome (no response, 408, 5xx, unusable answer) reloads and
   * says so neutrally. After success the schedule and the open details reload.
   */
  const submitRoomChange = (submission: RoomChangeSubmission) => {
    if (changeSubmitted.current) return;
    changeSubmitted.current = true;
    setRoomChanging(true);
    const { request, block, plan, stayed, toast } = submission;
    const stayId = block.id;
    const range = { ...currentRange.current };
    const inRange = () =>
      currentRange.current.startDate === range.startDate &&
      currentRange.current.days === range.days;
    // What is on screen for this stay now: what a rollback puts back.
    const snapshot = loadedBlocks.current.filter((b) => stayOf(b) === stayId);
    setBlocks(range, (blocks) => applyRoomPlan(blocks, { stayId, plan, stayed }));
    const finish = () => {
      changeSubmitted.current = false;
      setRoomChanging(false);
      setDetailRefresh((n) => n + 1);
    };
    api.reservations.changeRoomDuringStay(request).then(
      (answer) => {
        if (inRange()) {
          setBlocks(range, (blocks) => mergeRoomPlan({ ...range, blocks }, stayId, answer.blocks));
        }
        retry();
        notify(toast);
        finish();
      },
      (error: unknown) => {
        const failure = changeRoomFailure(error);
        if (failure.revert && inRange()) {
          setBlocks(range, (blocks) => revertRoomPlan(blocks, snapshot, stayId));
        }
        if (failure.refetch || (failure.revert && !inRange())) retry();
        notify(failure.message, failure.reopen || !failure.revert ? 'warning' : 'error');
        if (failure.reopen) {
          if (failure.serverToday) setServerToday(failure.serverToday);
          setReopen((r) => ({
            stayId,
            edits: Object.fromEntries(plan.map((n) => [n.date, n.roomId])),
            nonce: (r?.nonce ?? 0) + 1,
          }));
        }
        finish();
      },
    );
  };

  const filterOptions = data
    ? {
        locations: data.locations,
        roomTypes: data.roomTypes,
        features: data.features ?? [],
      }
    : { locations: [], roomTypes: [], features: [] };
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
          onClick={() =>
            update({
              locationIds: null,
              roomTypeIds: null,
              availability: 'all',
              housekeeping: [],
              featureIds: [],
            })
          }
        >
          Clear filters
        </Button>
      </Box>
    );
  } else {
    body = (
      <ScheduleGrid
        data={
          filteredUnassigned ? { ...schedule.data, unassigned: filteredUnassigned } : schedule.data
        }
        rooms={rooms}
        today={today}
        activeEvent={activeEvent}
        busy={schedule.refreshing}
        locked={schedule.refreshing || moving}
        onDrop={(block, result) => {
          setFrozenRooms(liveRooms);
          setPending({ block, result });
        }}
        onRefuse={(message) => notify(message, 'warning')}
        onOpen={openDetails}
        onOpenClosure={openClosure}
        onSetHousekeeping={canEditHousekeeping ? setHousekeeping : undefined}
        onOpenCell={(room, date) => openPanel({ kind: 'new', roomId: room.id, arrival: date })}
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
          activeFilters={activeFilterCount(effectiveView)}
          filtersOpen={filterAnchor !== null}
          onDays={(days: ScheduleDays) => update({ days })}
          onShift={(direction, step: ScheduleStep) =>
            update((v) => ({
              start: shiftScheduleStart(v.start ?? today, v.days, direction, step),
            }))
          }
          onStart={(date) => update({ start: date })}
          onToday={() => update({ start: null })}
          onAvailability={(availability) => update({ availability })}
          onToggleFilters={(button) => setFilterAnchor((a) => (a ? null : button))}
          onNewReservation={(button) => openPanel({ kind: 'new' }, button)}
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
        features={filterOptions.features}
        housekeeping={view.housekeeping}
        featureIds={effectiveView.featureIds}
        onHousekeeping={(housekeeping) => update({ housekeeping })}
        onFeatures={(featureIds) => update({ featureIds })}
      />
      {pending ? (
        <MoveConfirmDialog
          block={pending.block}
          result={pending.result}
          toRoomNumber={toRoom?.number ?? ''}
          today={today}
          onCancel={() => {
            setPending(null);
            setFrozenRooms(null);
            announce('Move cancelled.');
          }}
          onConfirm={() => confirm('all-rooms')}
          onSplit={() => confirm('this-room')}
        />
      ) : null}
      <ReservationPanel
        panel={panel}
        today={serverToday ?? today}
        data={data}
        dataFailed={schedule.status === 'error'}
        onRetryData={retry}
        onClose={closeCurrentPanel}
        onCreated={onCreated}
        onUnknownOutcome={retry}
        onEarlyLateSaved={onEarlyLateSaved}
        onChangeRoom={submitRoomChange}
        reopenChange={reopen}
        roomChangeBusy={roomChanging}
        detailRefresh={detailRefresh}
        onReservationChanged={retry}
        onClosureSaved={onClosureSaved}
        onClosureRemoved={onClosureRemoved}
        onDuplicateClosure={duplicateClosure}
        onNewTabChange={changeNewTab}
        onOpenReservation={(reservationId) => openPanel({ kind: 'details', reservationId })}
        onExited={restoreFocus}
        focusTitleFor={justCreated}
        side={panelSide}
      />
      <Box role="status" sx={visuallyHidden}>
        {note ? <span key={note.id}>{note.text}</span> : null}
      </Box>
      <SaveToast
        open={toastOpen}
        onClose={() => setToastOpen(false)}
        message={toast?.message ?? ''}
        saveId={toast?.id}
        severity={toast?.severity}
        side={toastSideFor(panelSide)}
      />
    </Box>
  );
}
