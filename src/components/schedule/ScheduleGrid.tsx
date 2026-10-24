import Box from '@mui/material/Box';
import { useTheme, type Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type {
  ScheduleBlock,
  ScheduleClosure,
  ScheduleData,
  ScheduleHold,
  ScheduleRoom,
} from '../../api';
import { addDays, daysBetween, type IsoDate } from '../../lib/dates';
import {
  blockLayout,
  dayHeader,
  groupByRoom,
  roomRowLabel,
  scheduleDates,
  visibleRowRange,
  type RoomRowLabel,
} from '../../app/schedule';
import { canDrop, isDraggable, type DropResult, type ScheduleItem } from '../../app/scheduleDrag';
import {
  blockAriaLabel,
  turnoverGap,
  blockTipText,
  segmentBadge,
  segmentLinks,
  type SegmentLink,
  blockSpan,
  columnAtX,
  emptyCellAction,
  cellAriaLabel,
  clamp,
  clampShift,
  closureAriaLabel,
  formatDialogDate,
  itemAtColumn,
  moveCursor,
  refusalMessage,
  roomRowAt,
  roomRowScrollTop,
  shiftFromDistance,
  yearLabel,
  type CursorKey,
  type GridCursor,
} from '../../app/scheduleGrid';
import type { SetHousekeeping } from './HousekeepingChip';
import { unassignedSection } from '../../app/unassignedRows';
import { isLinkedBlock } from '../../app/scheduleLinked';
import ScheduleItemView from './ScheduleItemView';
import ScheduleHoldView from './ScheduleHoldView';
import { canInteractWithHold, holdAriaLabel, holdTipText } from '../../app/slotHolds';
import UnassignedSection from './UnassignedSection';
import {
  BLOCK_HEIGHT,
  BLOCK_TOP,
  dateAreaWidth,
  dateAreaX,
  LABEL_VAR,
  LABEL_WIDTH,
  MIN_DAY_WIDTH,
  ROOM_CAPTION_PX,
  ROW_HEIGHT,
  ROW_VAR,
  rowTop,
} from './scheduleLayout';

type Accepted = Extract<DropResult, { ok: true }>;

export interface ScheduleGridProps {
  /** The loaded range, unfiltered: the drop rules need every room, reservation and closure. */
  data: ScheduleData;
  /** The rows to show (filters applied), in display order. */
  rooms: readonly ScheduleRoom[];
  today: IsoDate;
  /** A new range is loading: the grid stays, dimmed. */
  busy?: boolean;
  /** No new moves while the grid is refreshing or a move is in flight: its answer could overwrite them. */
  locked?: boolean;
  /** An allowed drop (pointer or keyboard). The page opens the matching confirm dialog. */
  onDrop: (block: ScheduleBlock, result: Accepted) => void;
  /** A refused drop: the reservation stays where it is. */
  onRefuse: (message: string) => void;
  /** A reservation block was clicked (not dragged) or Enter was pressed on it: open its details. */
  onOpen: (block: ScheduleBlock) => void;
  /** A free night in a room row was clicked (or Enter was pressed on it): start a reservation there. */
  onOpenCell: (room: ScheduleRoom, date: IsoDate) => void;
  /** Saves a change made in the housekeeping chip's pop-up; absent when the user may not change housekeeping. */
  onSetHousekeeping?: SetHousekeeping;
  /**
   * Held slots to shade (ticket 152): live ones only, the caller hides a hold at its expiry. They
   * cannot be dragged or opened; a click or Enter says the room is held.
   */
  holds?: readonly ScheduleHold[];
  /** The hold of the open New Reservation panel (the one hold its owner interacts with); drawn with a solid outline. */
  ownHoldId?: string | null;
}

interface DragState {
  item: ScheduleItem;
  /** Index into `rooms`; null when the pointer is outside the grid. */
  row: number | null;
  shift: number;
  /** Pointer offset from where the drag began, for the ghost. */
  dx: number;
  dy: number;
  result: DropResult | null;
  mode: 'pointer' | 'keyboard';
}

const DRAG_THRESHOLD_PX = 4;

/** Keys that move the grid's cursor. */
const NAVIGATION_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

/** Said when Enter, Space or a click lands on a linked-room block, which is read-only. */
const LINKED_ANNOUNCEMENT = 'Linked room. It cannot be opened or moved from here.';

const HELP =
  'Use the arrow keys to move between rooms and dates. Press Enter on a reservation to open its details, or on an empty date to start a new reservation there. ' +
  'Press Space or M to pick it up, the arrow keys to choose a new room or date, Enter or Space to drop it ' +
  'and Escape to cancel. Reservations can also be dragged with a mouse.';

interface RowProps {
  room: ScheduleRoom;
  index: number;
  /** Rows above the first room row besides the date header (the Unassigned section). */
  rowOffset: number;
  label: RoomRowLabel;
  blocks: ScheduleBlock[] | undefined;
  closures: ScheduleClosure[] | undefined;
  startDate: IsoDate;
  days: ScheduleData['days'];
  today: IsoDate;
  /** Keyboard cursor column when this is the active row, else null. */
  activeCol: number | null;
  draggingId: string | null;
  idPrefix: string;
  /** Place of each part of a stay that changed room: "part 2 of 3" and the rooms next to it. */
  links: ReadonlyMap<string, SegmentLink>;
  /** The grid has keyboard focus: the block under the cursor then shows its tooltip. */
  focused: boolean;
  onItemPointerDown: (event: ReactPointerEvent<HTMLElement>, item: ScheduleItem) => void;
  onSetHousekeeping?: SetHousekeeping;
  holds: readonly ScheduleHold[] | undefined;
  ownHoldId: string | null | undefined;
}

const itemId = (prefix: string, item: ScheduleItem) => `${prefix}-item-${item.id}`;

/** One room's row: the sticky room header and the blocks laid over the (CSS-drawn) date cells. */
const ScheduleRow = memo(function ScheduleRow({
  room,
  index,
  rowOffset,
  label,
  blocks,
  closures,
  startDate,
  days,
  today,
  activeCol,
  draggingId,
  idPrefix,
  links,
  focused,
  onItemPointerDown,
  onSetHousekeeping,
  holds,
  ownHoldId,
}: RowProps) {
  const items = useMemo<ScheduleItem[]>(
    () => [...(blocks ?? []), ...(closures ?? [])],
    [blocks, closures],
  );
  const activeItem =
    activeCol === null ? undefined : itemAtColumn(items, startDate, days, activeCol);
  const activeHold =
    activeCol === null || activeItem ? undefined : itemAtColumn(holds, startDate, days, activeCol);
  const holdLabel = (hold: ScheduleHold) =>
    holdAriaLabel(
      hold,
      room.number,
      { from: formatDialogDate(hold.startDate), to: formatDialogDate(hold.endDate) },
      canInteractWithHold(hold, ownHoldId),
    );
  return (
    <Box
      role="row"
      aria-rowindex={index + 2 + rowOffset}
      style={{ top: rowTop(index) }}
      sx={(t) => ({
        position: 'absolute',
        left: 0,
        right: 0,
        height: t.spacing(ROW_HEIGHT),
        boxSizing: 'border-box',
        borderBottom: `1px solid ${t.palette.divider}`,
        backgroundImage: `linear-gradient(to right, ${t.palette.divider} 1px, transparent 1px)`,
        backgroundSize: `calc((100% - var(${LABEL_VAR})) / ${days}) 100%`,
        backgroundPosition: `var(${LABEL_VAR}) 0`,
        backgroundRepeat: 'repeat-x',
      })}
    >
      <Box
        role="rowheader"
        aria-colindex={1}
        sx={(t) => ({
          position: 'sticky',
          left: 0,
          zIndex: 3,
          width: t.spacing(LABEL_WIDTH),
          height: '100%',
          boxSizing: 'border-box',
          px: 0.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          bgcolor: 'background.paper',
          borderRight: `1px solid ${t.palette.divider}`,
        })}
      >
        <Typography variant="subtitle2" component="span" sx={{ lineHeight: 1.2 }}>
          {label.number}
        </Typography>
        <Typography
          variant="caption"
          component="span"
          sx={(t) => ({ fontSize: t.typography.pxToRem(ROOM_CAPTION_PX), lineHeight: 1.2 })}
        >
          {label.label}
        </Typography>
      </Box>
      {items.map((item) => {
        const layout = blockLayout(item, startDate, days);
        if (!layout) return null;
        // A same-day turnover leaves room for the previous stay's housekeeping chip.
        const leadGap =
          item.kind === 'reservation'
            ? turnoverGap(
                items.find(
                  (o): o is ScheduleBlock =>
                    o.kind === 'reservation' && o.endDate === item.startDate,
                ),
                item,
                startDate,
                days,
              )
            : 0;
        const link = item.kind === 'reservation' ? links.get(item.id) : undefined;
        return (
          <ScheduleItemView
            key={item.id}
            id={itemId(idPrefix, item)}
            item={item}
            layout={layout}
            leadGap={leadGap}
            days={days}
            today={today}
            dragging={draggingId === item.id}
            label={
              item.kind === 'reservation'
                ? blockAriaLabel(item, room, link)
                : closureAriaLabel(item, room)
            }
            onPointerDown={(e) => onItemPointerDown(e, item)}
            onSetHousekeeping={onSetHousekeeping}
            active={activeItem?.id === item.id}
            tipFocused={focused && activeItem?.id === item.id}
            linkText={link ? segmentBadge(link) : undefined}
            tip={
              item.kind === 'reservation'
                ? blockTipText(item, room, link)
                : (item as ScheduleClosure).reason
            }
          />
        );
      })}
      {(holds ?? []).map((hold) => {
        const layout = blockLayout(hold, startDate, days);
        if (!layout) return null;
        return (
          <ScheduleHoldView
            key={hold.id}
            id={`${idPrefix}-hold-${hold.id}`}
            hold={hold}
            layout={layout}
            days={days}
            label={holdLabel(hold)}
            own={canInteractWithHold(hold, ownHoldId)}
            tipFocused={focused && activeHold?.id === hold.id}
          />
        );
      })}
      {activeCol !== null && !activeItem ? (
        <Box
          id={`${idPrefix}-cell-active`}
          role="gridcell"
          aria-colindex={activeCol + 2}
          aria-label={
            activeHold ? holdLabel(activeHold) : cellAriaLabel(room, addDays(startDate, activeCol))
          }
          data-active="true"
          style={{ left: dateAreaX(activeCol / days), width: dateAreaWidth(1 / days) }}
          sx={{ position: 'absolute', top: 0, bottom: 0, pointerEvents: 'none' }}
        />
      ) : null}
    </Box>
  );
});

/**
 * The schedule grid (Figma 13908:93472): a sticky weekday header and room header column, only the
 * visible rows rendered (blocks are absolutely positioned over a CSS-drawn background, no per-cell
 * components), pointer dragging and a keyboard way to move a reservation. Rules come from
 * scheduleDrag.ts; this component only gathers the pointer/keyboard target and shows the result.
 */
export default function ScheduleGrid({
  data,
  rooms,
  today,
  busy,
  locked,
  onDrop,
  onRefuse,
  onOpen,
  onOpenCell,
  onSetHousekeeping,
  holds,
  ownHoldId,
}: ScheduleGridProps) {
  const theme = useTheme();
  const idPrefix = useId().replace(/:/g, '');
  const { startDate, days } = data;
  const rowPx = parseFloat(theme.spacing(ROW_HEIGHT));
  const labelPx = parseFloat(theme.spacing(LABEL_WIDTH));
  const dates = useMemo(() => scheduleDates(startDate, days), [startDate, days]);
  const todayIndex = daysBetween(startDate, today);
  const blocksByRoom = useMemo(() => groupByRoom(data.blocks), [data.blocks]);
  const closuresByRoom = useMemo(() => groupByRoom(data.closures), [data.closures]);
  const holdsByRoom = useMemo(() => groupByRoom(holds ?? []), [holds]);
  const links = useMemo(() => segmentLinks(data.blocks, data.rooms), [data.blocks, data.rooms]);
  const labels = useMemo(
    () => rooms.map((r) => roomRowLabel(r, data.locations, data.roomTypes)),
    [rooms, data.locations, data.roomTypes],
  );
  const rules = useMemo(
    () => ({ today, rooms: data.rooms, blocks: data.blocks, closures: data.closures }),
    [today, data.rooms, data.blocks, data.closures],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [scrollTop, setScrollTop] = useState(0);
  const [cursor, setCursor] = useState<GridCursor>({ row: 0, col: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // Collapse state of the Unassigned section is local UI state: not in the URL, not saved.
  const [unassignedCollapsed, setUnassignedCollapsed] = useState(false);
  const section = useMemo(
    () => unassignedSection(data.unassigned, startDate, days, unassignedCollapsed),
    [data.unassigned, startDate, days, unassignedCollapsed],
  );
  const unassignedRows = section.rows.length;
  const unassignedPx = unassignedRows * rowPx;
  const [gridFocused, setGridFocused] = useState(false);
  // Focus is on a tab stop inside the grid (an Unassigned block), not on the grid element itself.
  const [innerFocus, setInnerFocus] = useState(false);
  // The block under the cursor shows its tooltip only while the cursor is driven by the keyboard:
  // set by a navigation key or by keyboard (focus-visible) focus, cleared by any pointer press.
  const [keyboardCursor, setKeyboardCursor] = useState(false);

  // Virtualization window. The scroll handler only stores the row range when it changes.
  const range = useMemo(
    () => visibleRowRange(scrollTop - unassignedPx, viewportHeight, rowPx, rooms.length),
    [scrollTop, unassignedPx, viewportHeight, rowPx, rooms.length],
  );
  const cursorRow = Math.min(cursor.row, Math.max(rooms.length - 1, 0));
  const rowIndexes = useMemo(() => {
    const list: number[] = [];
    for (let i = range.start; i < range.end; i++) list.push(i);
    if (rooms.length > 0 && (cursorRow < range.start || cursorRow >= range.end))
      list.push(cursorRow);
    // Document order follows row order, also for the cursor row outside the window.
    return list.sort((a, b) => a - b);
  }, [range, cursorRow, rooms.length]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientHeight > 0) setViewportHeight(el.clientHeight);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---- drag target (pointer and keyboard share it) -------------------------------------------

  const latest = useRef({
    rooms,
    rules,
    days,
    startDate,
    dates,
    onDrop,
    onRefuse,
    onOpen,
    onOpenCell,
    locked,
    unassignedRows,
  });
  useLayoutEffect(() => {
    latest.current = {
      rooms,
      rules,
      days,
      startDate,
      dates,
      onDrop,
      onRefuse,
      onOpen,
      onOpenCell,
      locked,
      unassignedRows,
    };
  });

  const evaluate = useCallback(
    (item: ScheduleItem, row: number | null, shift: number): DropResult | null => {
      const { rooms: current, rules: state } = latest.current;
      const room = row === null ? undefined : current[row];
      if (!room) return null;
      return canDrop(item, { roomId: room.id, startDate: addDays(item.startDate, shift) }, state);
    },
    [],
  );

  const describeTarget = useCallback(
    (row: number | null, shift: number, item: ScheduleItem, result: DropResult | null): string => {
      const room = row === null ? undefined : latest.current.rooms[row];
      if (!room || !result) return 'Outside the schedule.';
      const where = `Room ${room.number}, ${dayHeader(addDays(item.startDate, shift))}`;
      if (result.ok) return `${where}: drop allowed.`;
      return `${where}: ${result.reason === 'no-change' ? 'original position.' : refusalMessage(result.reason)}`;
    },
    [],
  );

  // Pointer geometry: `scroller` coordinates to a room row and a day shift.
  const pointerTarget = useCallback(
    (item: ScheduleItem, origin: { x: number; scrollLeft: number }, x: number, y: number) => {
      const scroller = scrollRef.current;
      const content = contentRef.current;
      if (!scroller || !content) return { row: null, shift: 0 };
      const rect = scroller.getBoundingClientRect();
      const dayWidth = (content.getBoundingClientRect().width - labelPx) / latest.current.days;
      const startIndex = daysBetween(latest.current.startDate, item.startDate);
      const shift = clampShift(
        startIndex,
        shiftFromDistance(x - origin.x + (scroller.scrollLeft - origin.scrollLeft), dayWidth),
        latest.current.days,
      );
      // Over the room header column (or outside the grid) there is no date: the drop is cancelled.
      const inside =
        x >= rect.left + labelPx && x <= rect.right && y >= rect.top && y <= rect.bottom;
      const row = inside
        ? roomRowAt(
            y - rect.top + scroller.scrollTop,
            rowPx,
            latest.current.unassignedRows,
            latest.current.rooms.length,
          )
        : null;
      return { row, shift };
    },
    [labelPx, rowPx],
  );

  const pointerRef = useRef<{
    item: ScheduleItem;
    x: number;
    y: number;
    scrollLeft: number;
    started: boolean;
    last: { x: number; y: number };
    stop: () => void;
  } | null>(null);
  const suppressClick = useRef(false);
  // Where the last pointer press on the grid began (or that it was cancelled): a click that follows
  // a press that moved is a drag or a scroll, not a click on an empty date.
  const pressRef = useRef<{ x: number; y: number } | 'cancelled' | null>(null);
  const followRef = useRef<{ id: string; roomId: string; startDate: IsoDate } | null>(null);

  const updatePointerDrag = useCallback(
    (x: number, y: number) => {
      const p = pointerRef.current;
      if (!p) return;
      p.last = { x, y };
      if (!p.started) {
        if (Math.hypot(x - p.x, y - p.y) < DRAG_THRESHOLD_PX) return;
        p.started = true;
      }
      const { row, shift } = pointerTarget(p.item, { x: p.x, scrollLeft: p.scrollLeft }, x, y);
      const result = evaluate(p.item, row, shift);
      setDrag((d) => {
        const next: DragState = {
          item: p.item,
          row,
          shift,
          dx: x - p.x,
          dy: y - p.y,
          result,
          mode: 'pointer',
        };
        if (d && d.row === row && d.shift === shift && d.dx === next.dx && d.dy === next.dy)
          return d;
        return next;
      });
      setAnnouncement(describeTarget(row, shift, p.item, result));
    },
    [pointerTarget, evaluate, describeTarget],
  );
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Rows are whole 60px steps: only a change of the first visible row needs a render.
    setScrollTop((previous) =>
      Math.floor(previous / rowPx) === Math.floor(el.scrollTop / rowPx) ? previous : el.scrollTop,
    );
    // The grid moved under a dragging pointer: the target cell changed.
    const p = pointerRef.current;
    if (p?.started) updatePointerDrag(p.last.x, p.last.y);
  }, [rowPx, updatePointerDrag]);

  const finishDrop = useCallback((item: ScheduleItem, result: DropResult | null) => {
    if (!result) {
      setAnnouncement('Move cancelled.');
      return;
    }
    if (result.ok) {
      if (item.kind === 'reservation') latest.current.onDrop(item, result);
      return;
    }
    setAnnouncement('');
    latest.current.onRefuse(refusalMessage(result.reason));
  }, []);

  const onItemPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, item: ScheduleItem) => {
      if (event.button !== 0 || event.pointerType === 'touch' || latest.current.locked) return;
      if (item.kind === 'reservation' && isLinkedBlock(item)) return;
      pointerRef.current?.stop();
      const scroller = scrollRef.current;
      const move = (e: PointerEvent) => updatePointerDrag(e.clientX, e.clientY);
      const cancel = () => {
        stop();
        setDrag(null);
        setAnnouncement('Move cancelled.');
      };
      const up = (e: PointerEvent) => {
        const p = pointerRef.current;
        stop();
        if (!p?.started) return;
        suppressClick.current = true;
        // The click that follows the release comes before any timer; if none does, do not keep eating clicks.
        setTimeout(() => (suppressClick.current = false), 0);
        // Judge the drop at the release position.
        const { row, shift } = pointerTarget(
          p.item,
          { x: p.x, scrollLeft: p.scrollLeft },
          e.clientX,
          e.clientY,
        );
        const result = evaluate(p.item, row, shift);
        setDrag(null);
        finishDrop(p.item, result);
      };
      const key = (e: globalThis.KeyboardEvent) => {
        if (e.key === 'Escape' && pointerRef.current?.started) cancel();
      };
      // Losing the window or the tab must not leave a drag hanging.
      const hidden = () => {
        if (document.visibilityState === 'hidden') cancel();
      };
      function stop() {
        window.removeEventListener('blur', cancel);
        document.removeEventListener('visibilitychange', hidden);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', key);
        pointerRef.current = null;
      }
      pointerRef.current = {
        item,
        x: event.clientX,
        y: event.clientY,
        scrollLeft: scroller?.scrollLeft ?? 0,
        started: false,
        last: { x: event.clientX, y: event.clientY },
        stop,
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('keydown', key);
      window.addEventListener('blur', cancel);
      document.addEventListener('visibilitychange', hidden);
    },
    [updatePointerDrag, pointerTarget, evaluate, finishDrop],
  );
  useEffect(() => () => pointerRef.current?.stop(), []);
  // A refresh or an in-flight move starts: a drag in progress is abandoned.
  useEffect(() => {
    if (locked) pointerRef.current?.stop();
  }, [locked]);
  const [wasLocked, setWasLocked] = useState(false);
  if (Boolean(locked) !== wasLocked) {
    setWasLocked(Boolean(locked));
    if (locked && drag) setDrag(null);
  }

  // A click that ends a drag must not also select the block under the pointer.
  const onClickCapture = (event: React.MouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      event.stopPropagation();
    }
  };

  // A free date cell: start a reservation there. A closure says so; a block's own column does nothing.
  const activateCell = (room: ScheduleRoom, col: number) => {
    const held = itemAtColumn(holdsByRoom.get(room.id), startDate, days, col);
    if (held) {
      setAnnouncement(`Room ${room.number} is held. ${holdTipText(held)}.`);
      return;
    }
    const action = emptyCellAction(
      blocksByRoom.get(room.id),
      closuresByRoom.get(room.id),
      startDate,
      days,
      col,
    );
    if (action.kind === 'closed') {
      setAnnouncement('Room closed.');
    } else if (action.kind === 'free') {
      const date = addDays(startDate, col);
      setAnnouncement(`Starting a new reservation in Room ${room.number} on ${dayHeader(date)}.`);
      latest.current.onOpenCell(room, date);
    }
  };

  const selectItemFromEvent = (event: React.MouseEvent<HTMLElement>) => {
    const press = pressRef.current;
    pressRef.current = null;
    const element = event.target as HTMLElement;
    // The Unassigned section: a block opens its details; nothing else there reacts to a click.
    if (element.closest('[data-unassigned-section]')) {
      const id = element.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
      const unassigned = data.unassigned.find((b) => b.id === id);
      if (unassigned) {
        if (isLinkedBlock(unassigned)) setAnnouncement(LINKED_ANNOUNCEMENT);
        else latest.current.onOpen(unassigned);
      }
      return;
    }
    const rowEl = element.closest<HTMLElement>('[role="row"]');
    if (!rowEl) return;
    const index = Number(rowEl.getAttribute('aria-rowindex')) - 2 - latest.current.unassignedRows;
    if (index < 0) return;
    const target = element.closest<HTMLElement>('[data-item-id]');
    const heldEl = target ? null : element.closest<HTMLElement>('[data-hold-id]');
    if (heldEl) {
      // A held slot reacts to nothing but this note.
      const hold = holds?.find((h) => h.id === heldEl.dataset.holdId);
      const room = latest.current.rooms[index];
      if (hold && room) setAnnouncement(`Room ${room.number} is held. ${holdTipText(hold)}.`);
      return;
    }
    if (!target) {
      // The empty part of a room row. A press that moved (a drag or a scroll) or was cancelled is not a click.
      if (press === 'cancelled') return;
      if (
        press &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) >= DRAG_THRESHOLD_PX
      ) {
        return;
      }
      const content = contentRef.current;
      const room = latest.current.rooms[index];
      if (!content || !room || element.closest('[role="rowheader"]')) return;
      const rect = content.getBoundingClientRect();
      const col = columnAtX(event.clientX, rect.left, rect.width, labelPx, days);
      if (col === null) return;
      setCursor({ row: index, col });
      scrollRef.current?.focus({ preventScroll: true });
      activateCell(room, col);
      return;
    }
    const item = [...data.blocks, ...data.closures].find((i) => i.id === target.dataset.itemId);
    if (!item) return;
    const layout = blockLayout(item, startDate, days);
    setCursor({ row: index, col: layout?.column ?? 0 });
    scrollRef.current?.focus({ preventScroll: true });
    // A plain click (a drag's click was swallowed in the capture phase) opens the details.
    if (item.kind === 'reservation') {
      // A linked-room block opens nothing (legacy behavior).
      if (isLinkedBlock(item)) setAnnouncement(LINKED_ANNOUNCEMENT);
      else latest.current.onOpen(item);
    } else setAnnouncement('Room closed.');
  };

  // ---- keyboard ----------------------------------------------------------------------------

  const ensureVisible = useCallback(
    (row: number, col: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const top = roomRowScrollTop(row, rowPx, unassignedRows);
      const viewport = el.clientHeight - rowPx; // the sticky header covers the top 60px
      if (top < el.scrollTop) el.scrollTop = top;
      else if (viewport > 0 && top + rowPx > el.scrollTop + viewport)
        el.scrollTop = top + rowPx - viewport;
      const content = contentRef.current;
      if (content && el.clientWidth > 0) {
        const dayWidth = (content.getBoundingClientRect().width - labelPx) / days;
        const left = col * dayWidth;
        const visible = el.clientWidth - labelPx;
        if (left < el.scrollLeft) el.scrollLeft = left;
        else if (left + dayWidth > el.scrollLeft + visible)
          el.scrollLeft = left + dayWidth - visible;
      }
    },
    [rowPx, labelPx, days, unassignedRows],
  );

  // Keyboard move: once the block has changed room or date, the cursor follows it.
  useEffect(() => {
    const f = followRef.current;
    if (!f) return;
    const moved = data.blocks.find((b) => b.id === f.id);
    if (!moved || (moved.roomId === f.roomId && moved.startDate === f.startDate)) return;
    followRef.current = null;
    const row = rooms.findIndex((r) => r.id === moved.roomId);
    const layout = blockLayout(moved, startDate, days);
    if (row < 0 || !layout) return;
    setCursor({ row, col: layout.column });
    ensureVisible(row, layout.column);
  }, [data.blocks, rooms, startDate, days, ensureVisible]);

  const pickUp = (item: ScheduleItem, row: number) => {
    if (latest.current.locked) {
      setAnnouncement('The schedule is updating. Try again in a moment.');
      return;
    }
    if (item.kind !== 'reservation') {
      setAnnouncement(refusalMessage('closure'));
      return;
    }
    if (!isDraggable(item)) {
      setAnnouncement(refusalMessage(item.roomChange ? 'room-changed-stay' : 'checked-out'));
      return;
    }
    const result = evaluate(item, row, 0);
    setDrag({ item, row, shift: 0, dx: 0, dy: 0, result, mode: 'keyboard' });
    setAnnouncement(
      `Picked up ${blockAriaLabel(item, rooms[row])}. Use the arrow keys to choose a room or date, Enter to drop, Escape to cancel.`,
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey)
      return;
    const key = event.key;
    if (NAVIGATION_KEYS.has(key)) setKeyboardCursor(true);
    if (drag?.mode === 'keyboard') {
      const arrows: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      if (key in arrows) {
        event.preventDefault();
        const [dr, ds] = arrows[key];
        const row = clamp((drag.row ?? 0) + dr, 0, rooms.length - 1);
        const shift = clampShift(
          daysBetween(startDate, drag.item.startDate),
          drag.shift + ds,
          days,
        );
        const result = evaluate(drag.item, row, shift);
        setDrag({ ...drag, row, shift, result });
        setAnnouncement(describeTarget(row, shift, drag.item, result));
        const startCol = daysBetween(startDate, drag.item.startDate) + shift;
        ensureVisible(row, clamp(startCol, 0, days - 1));
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        const { item, result } = drag;
        if (result?.ok) {
          setDrag(null);
          // After the move is applied the keyboard cursor goes to where the block ended up.
          followRef.current = { id: item.id, roomId: item.roomId, startDate: item.startDate };
          finishDrop(item, result);
        } else if (result) {
          // Refused: the item stays picked up so another target can be chosen.
          latest.current.onRefuse(refusalMessage(result.reason));
        }
      } else if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setDrag(null);
        setAnnouncement('Move cancelled.');
      }
      return;
    }
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ].includes(key)
    ) {
      event.preventDefault();
      followRef.current = null; // the user is steering now
      const pageRows = Math.max(Math.floor(viewportHeight / rowPx) - 1, 1);
      const next = moveCursor(
        { ...cursor, row: cursorRow },
        key as CursorKey,
        rooms.length,
        days,
        pageRows,
      );
      setCursor(next);
      ensureVisible(next.row, next.col);
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'm' || key === 'M') {
      const item = itemAtColumn(
        [
          ...(blocksByRoom.get(rooms[cursorRow]?.id) ?? []),
          ...(closuresByRoom.get(rooms[cursorRow]?.id) ?? []),
        ],
        startDate,
        days,
        cursor.col,
      );
      if (item) {
        event.preventDefault();
        // Enter opens the details; Space and M pick the block up to move it.
        if (item.kind === 'reservation' && isLinkedBlock(item)) {
          setAnnouncement(LINKED_ANNOUNCEMENT);
        } else if (key === 'Enter') {
          if (item.kind === 'reservation') latest.current.onOpen(item);
          else setAnnouncement('Room closed. Closures have no details.');
        } else pickUp(item, cursorRow);
      } else if (key === 'Enter' && rooms[cursorRow]) {
        event.preventDefault();
        activateCell(rooms[cursorRow], cursor.col);
      }
    }
  };

  // ---- drop indicator ---------------------------------------------------------------------

  const band = useMemo(() => {
    if (!drag || drag.row === null) return null;
    const layout = blockLayout(
      {
        startDate: addDays(drag.item.startDate, drag.shift),
        endDate: addDays(drag.item.endDate, drag.shift),
      },
      startDate,
      days,
    );
    if (!layout) return null;
    return { span: blockSpan(layout, days), row: drag.row, allowed: drag.result?.ok === true };
  }, [drag, startDate, days]);

  const ghostLayout = drag?.mode === 'pointer' ? blockLayout(drag.item, startDate, days) : null;
  const ghostRow = drag ? rooms.findIndex((r) => r.id === drag.item.roomId) : -1;
  const dragging = drag?.mode === 'pointer';

  const activeId =
    rooms.length === 0
      ? undefined
      : (() => {
          const room = rooms[cursorRow];
          const item = room
            ? itemAtColumn(
                [...(blocksByRoom.get(room.id) ?? []), ...(closuresByRoom.get(room.id) ?? [])],
                startDate,
                days,
                cursor.col,
              )
            : undefined;
          return item ? itemId(idPrefix, item) : `${idPrefix}-cell-active`;
        })();

  const minDay = MIN_DAY_WIDTH[days];
  const rowsHeight = rooms.length * rowPx;

  return (
    <Box sx={{ position: 'relative', height: '100%', minHeight: 0 }}>
      <Box
        ref={scrollRef}
        role="grid"
        aria-label="Schedule"
        aria-rowcount={rooms.length + 1 + unassignedRows}
        aria-colcount={days + 1}
        aria-busy={busy || undefined}
        aria-activedescendant={innerFocus ? undefined : activeId}
        aria-describedby={`${idPrefix}-help`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          // Focus on a tab stop inside the grid (an Unassigned block) is not the grid's cursor: put the
          // cursor's tooltip and aria-activedescendant away. Focus back on the grid restores them.
          setInnerFocus(e.target !== e.currentTarget);
          if (e.target !== e.currentTarget) {
            setGridFocused(false);
            setKeyboardCursor(false);
            return;
          }
          setGridFocused(true);
          // Keyboard focus (Tab, or focus handed back by a closing panel) is :focus-visible; a mouse
          // press that focuses the grid is not.
          let visible = false;
          try {
            visible = e.currentTarget.matches(':focus-visible');
          } catch {
            // old engines: treat as a pointer focus
          }
          if (visible) setKeyboardCursor(true);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setGridFocused(false);
            setKeyboardCursor(false);
            setInnerFocus(false);
          }
          // Leaving the grid abandons a keyboard pick-up, also into the Unassigned section's tab stops.
          if (
            drag?.mode === 'keyboard' &&
            (e.target === e.currentTarget || !e.currentTarget.contains(e.relatedTarget))
          ) {
            setDrag(null);
            setAnnouncement('Move cancelled.');
          }
        }}
        onScroll={onScroll}
        onClickCapture={onClickCapture}
        onClick={selectItemFromEvent}
        onPointerDown={(e) => {
          pressRef.current = { x: e.clientX, y: e.clientY };
          // Any pointer use (a click, a drag, a refused drag) ends the keyboard cursor's tooltip.
          setKeyboardCursor(false);
        }}
        onPointerCancel={() => {
          pressRef.current = 'cancelled';
        }}
        style={
          {
            [LABEL_VAR]: theme.spacing(LABEL_WIDTH),
            [ROW_VAR]: theme.spacing(ROW_HEIGHT),
          } as React.CSSProperties
        }
        sx={(t: Theme) => ({
          position: 'relative',
          overflow: 'auto',
          height: '100%',
          minHeight: 0,
          bgcolor: 'background.paper',
          userSelect: 'none',
          cursor: dragging ? 'grabbing' : 'auto',
          opacity: busy ? 0.6 : 1,
          transition: 'opacity 150ms',
          // Outside the scroller: the sticky header and room column would cover an inner ring.
          '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
          '&:focus-visible [data-active="true"]': {
            outline: `2px solid ${t.palette.primary.main}`,
            outlineOffset: -2,
            zIndex: 6,
          },
        })}
      >
        <Box
          ref={contentRef}
          sx={(t) => ({
            position: 'relative',
            minWidth: `calc(${t.spacing(LABEL_WIDTH)} + ${days * minDay} * ${t.spacing(1)})`,
          })}
        >
          <Box
            role="row"
            aria-rowindex={1}
            sx={(t) => ({
              position: 'sticky',
              top: 0,
              zIndex: 4,
              display: 'flex',
              height: t.spacing(ROW_HEIGHT),
              boxSizing: 'border-box',
              bgcolor: 'background.paper',
              borderBottom: `1px solid ${t.palette.divider}`,
            })}
          >
            <Box
              role="columnheader"
              aria-colindex={1}
              sx={(t) => ({
                position: 'sticky',
                left: 0,
                zIndex: 5,
                width: t.spacing(LABEL_WIDTH),
                flexShrink: 0,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.paper',
                borderRight: `1px solid ${t.palette.divider}`,
              })}
            >
              <Typography variant="subtitle2" component="span">
                {yearLabel(dates)}
              </Typography>
            </Box>
            {dates.map((date, i) => (
              <Box
                key={date}
                role="columnheader"
                aria-colindex={i + 2}
                aria-label={days === 7 ? undefined : dayHeader(date)}
                aria-current={i === todayIndex ? 'date' : undefined}
                sx={(t) => ({
                  flex: '1 1 0',
                  minWidth: 0,
                  px: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  borderRight: `1px solid ${t.palette.divider}`,
                  bgcolor: i === todayIndex ? t.palette.schedule.today : undefined,
                })}
              >
                <Typography
                  variant="subtitle2"
                  component="span"
                  sx={{ fontWeight: i === todayIndex ? 700 : 500, textAlign: 'center' }}
                >
                  {days === 7 ? (
                    dayHeader(date)
                  ) : (
                    // 14 and 30 days: weekday over date, the same in every column (30 days:
                    // abbreviated weekday). The full name is the column header's aria-label.
                    <>
                      <span aria-hidden>
                        {days === 14 ? dayHeader(date).split(' ')[0] : dayHeader(date).slice(0, 3)}
                      </span>
                      <br aria-hidden />
                      <span aria-hidden>{dayHeader(date).split(' ')[1]}</span>
                    </>
                  )}
                </Typography>
              </Box>
            ))}
          </Box>
          <UnassignedSection
            section={section}
            startDate={startDate}
            days={days}
            today={today}
            idPrefix={idPrefix}
            onToggle={() => setUnassignedCollapsed((c) => !c)}
            onOpen={(block) => latest.current.onOpen(block)}
            onLinked={() => setAnnouncement(LINKED_ANNOUNCEMENT)}
          />
          <Box role="rowgroup" sx={{ position: 'relative', height: rowsHeight }}>
            {todayIndex >= 0 && todayIndex < days ? (
              <Box
                aria-hidden
                style={{ left: dateAreaX(todayIndex / days), width: dateAreaWidth(1 / days) }}
                sx={(t) => ({
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  bgcolor: t.palette.schedule.today,
                  pointerEvents: 'none',
                  zIndex: 1,
                })}
              />
            ) : null}
            {rowIndexes.map((i) => (
              <ScheduleRow
                key={rooms[i].id}
                room={rooms[i]}
                index={i}
                rowOffset={unassignedRows}
                label={labels[i]}
                blocks={blocksByRoom.get(rooms[i].id)}
                closures={closuresByRoom.get(rooms[i].id)}
                startDate={startDate}
                days={days}
                today={today}
                activeCol={i === cursorRow ? cursor.col : null}
                draggingId={drag?.item.id ?? null}
                idPrefix={idPrefix}
                links={links}
                focused={gridFocused && keyboardCursor}
                onItemPointerDown={onItemPointerDown}
                onSetHousekeeping={onSetHousekeeping}
                holds={holdsByRoom.get(rooms[i].id)}
                ownHoldId={ownHoldId}
              />
            ))}
            {band ? (
              <Box
                aria-hidden
                data-testid="drop-indicator"
                data-allowed={band.allowed}
                style={{
                  top: `calc(${rowTop(band.row)} + ${theme.spacing(BLOCK_TOP)})`,
                  left: dateAreaX(band.span.start),
                  width: dateAreaWidth(band.span.end - band.span.start),
                }}
                sx={(t) => ({
                  position: 'absolute',
                  height: t.spacing(BLOCK_HEIGHT),
                  bgcolor: band.allowed
                    ? t.palette.schedule.dropAllowed
                    : t.palette.schedule.dropRefused,
                  outline: `2px dashed ${band.allowed ? t.palette.primary.main : t.palette.error.main}`,
                  outlineOffset: -2,
                  borderRadius: 1,
                  pointerEvents: 'none',
                  zIndex: 8,
                })}
              />
            ) : null}
            {drag && ghostLayout && ghostRow >= 0 ? (
              <Box
                aria-hidden
                data-testid="drag-ghost"
                style={{
                  top: rowTop(ghostRow),
                  transform: `translate(${drag.dx}px, ${drag.dy}px)`,
                }}
                sx={(t) => ({
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: t.spacing(ROW_HEIGHT),
                  pointerEvents: 'none',
                  zIndex: 20,
                  willChange: 'transform',
                })}
              >
                <ScheduleItemView
                  item={drag.item}
                  layout={ghostLayout}
                  days={days}
                  today={today}
                  ghost
                />
              </Box>
            ) : null}
          </Box>
        </Box>
      </Box>
      <Box id={`${idPrefix}-help`} sx={visuallyHidden}>
        {HELP}
      </Box>
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {announcement}
      </Box>
    </Box>
  );
}
