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
import type { ScheduleBlock, ScheduleClosure, ScheduleData, ScheduleRoom } from '../../api';
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
  blockSpan,
  cellAriaLabel,
  clamp,
  clampShift,
  closureAriaLabel,
  itemAtColumn,
  moveCursor,
  refusalMessage,
  rowIndexAt,
  shiftFromDistance,
  yearLabel,
  type CursorKey,
  type GridCursor,
} from '../../app/scheduleGrid';
import ScheduleItemView from './ScheduleItemView';
import {
  BLOCK_HEIGHT,
  BLOCK_TOP,
  dateAreaWidth,
  dateAreaX,
  LABEL_VAR,
  LABEL_WIDTH,
  MIN_DAY_WIDTH,
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
  /** An allowed drop (pointer or keyboard). The page opens the matching confirm dialog. */
  onDrop: (block: ScheduleBlock, result: Accepted) => void;
  /** A refused drop: the reservation stays where it is. */
  onRefuse: (message: string) => void;
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

const HELP =
  'Use the arrow keys to move between rooms and dates. Press Enter or M on a reservation to pick it up, ' +
  'the arrow keys to choose a new room or date, Enter to drop it and Escape to cancel. ' +
  'Reservations can also be dragged with a mouse.';

interface RowProps {
  room: ScheduleRoom;
  index: number;
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
  onItemPointerDown: (event: ReactPointerEvent<HTMLElement>, item: ScheduleItem) => void;
}

const itemId = (prefix: string, item: ScheduleItem) => `${prefix}-item-${item.id}`;

/** One room's row: the sticky room header and the blocks laid over the (CSS-drawn) date cells. */
const ScheduleRow = memo(function ScheduleRow({
  room,
  index,
  label,
  blocks,
  closures,
  startDate,
  days,
  today,
  activeCol,
  draggingId,
  idPrefix,
  onItemPointerDown,
}: RowProps) {
  const items = useMemo<ScheduleItem[]>(
    () => [...(blocks ?? []), ...(closures ?? [])],
    [blocks, closures],
  );
  const activeItem =
    activeCol === null ? undefined : itemAtColumn(items, startDate, days, activeCol);
  return (
    <Box
      role="row"
      aria-rowindex={index + 2}
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
          sx={(t) => ({ fontSize: t.typography.pxToRem(10), lineHeight: 1.2 })}
        >
          {label.label}
        </Typography>
      </Box>
      {items.map((item) => {
        const layout = blockLayout(item, startDate, days);
        if (!layout) return null;
        return (
          <ScheduleItemView
            key={item.id}
            id={itemId(idPrefix, item)}
            item={item}
            layout={layout}
            days={days}
            today={today}
            dragging={draggingId === item.id}
            label={
              item.kind === 'reservation'
                ? blockAriaLabel(item, room)
                : closureAriaLabel(item, room)
            }
            onPointerDown={(e) => onItemPointerDown(e, item)}
            active={activeItem?.id === item.id}
          />
        );
      })}
      {activeCol !== null && !activeItem ? (
        <Box
          id={`${idPrefix}-cell-active`}
          role="gridcell"
          aria-colindex={activeCol + 2}
          aria-label={cellAriaLabel(room, addDays(startDate, activeCol))}
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
  onDrop,
  onRefuse,
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

  // Virtualization window. The scroll handler only stores the row range when it changes.
  const range = useMemo(
    () => visibleRowRange(scrollTop, viewportHeight, rowPx, rooms.length),
    [scrollTop, viewportHeight, rowPx, rooms.length],
  );
  const cursorRow = Math.min(cursor.row, Math.max(rooms.length - 1, 0));
  const rowIndexes = useMemo(() => {
    const list: number[] = [];
    for (let i = range.start; i < range.end; i++) list.push(i);
    if (rooms.length > 0 && (cursorRow < range.start || cursorRow >= range.end))
      list.push(cursorRow);
    return list;
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

  const latest = useRef({ rooms, rules, days, startDate, dates, onDrop, onRefuse });
  useLayoutEffect(() => {
    latest.current = { rooms, rules, days, startDate, dates, onDrop, onRefuse };
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
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      const row = inside
        ? rowIndexAt(y - rect.top + scroller.scrollTop - rowPx, rowPx, latest.current.rooms.length)
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
      if (event.button !== 0 || event.pointerType === 'touch') return;
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
      function stop() {
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
    },
    [updatePointerDrag, pointerTarget, evaluate, finishDrop],
  );
  useEffect(() => () => pointerRef.current?.stop(), []);

  // A click that ends a drag must not also select the block under the pointer.
  const onClickCapture = (event: React.MouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      event.stopPropagation();
    }
  };

  const selectItemFromEvent = (event: React.MouseEvent<HTMLElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
    const rowEl = (event.target as HTMLElement).closest<HTMLElement>('[role="row"]');
    if (!target || !rowEl) return;
    const index = Number(rowEl.getAttribute('aria-rowindex')) - 2;
    const item = [...data.blocks, ...data.closures].find((i) => i.id === target.dataset.itemId);
    if (!item || index < 0) return;
    const layout = blockLayout(item, startDate, days);
    setCursor({ row: index, col: layout?.column ?? 0 });
    scrollRef.current?.focus({ preventScroll: true });
  };

  // ---- keyboard ----------------------------------------------------------------------------

  const ensureVisible = useCallback(
    (row: number, col: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const top = row * rowPx;
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
    [rowPx, labelPx, days],
  );

  const pickUp = (item: ScheduleItem, row: number) => {
    if (item.kind !== 'reservation') {
      setAnnouncement(refusalMessage('closure'));
      return;
    }
    if (!isDraggable(item)) {
      setAnnouncement(refusalMessage('checked-out'));
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
        pickUp(item, cursorRow);
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
        aria-rowcount={rooms.length + 1}
        aria-colcount={days + 1}
        aria-busy={busy || undefined}
        aria-activedescendant={activeId}
        aria-describedby={`${idPrefix}-help`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onScroll={onScroll}
        onClickCapture={onClickCapture}
        onClick={selectItemFromEvent}
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
                  aria-label={dayHeader(date)}
                  sx={{ fontWeight: i === todayIndex ? 700 : 500, textAlign: 'center' }}
                >
                  {days >= 30 ? (
                    // Narrow 30-day columns: weekday abbreviation over the date.
                    <>
                      <span aria-hidden>{dayHeader(date).slice(0, 3)}</span>
                      <br aria-hidden />
                      <span aria-hidden>{dayHeader(date).split(' ')[1]}</span>
                    </>
                  ) : (
                    dayHeader(date)
                  )}
                </Typography>
              </Box>
            ))}
          </Box>
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
                label={labels[i]}
                blocks={blocksByRoom.get(rooms[i].id)}
                closures={closuresByRoom.get(rooms[i].id)}
                startDate={startDate}
                days={days}
                today={today}
                activeCol={i === cursorRow ? cursor.col : null}
                draggingId={drag?.item.id ?? null}
                idPrefix={idPrefix}
                onItemPointerDown={onItemPointerDown}
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
