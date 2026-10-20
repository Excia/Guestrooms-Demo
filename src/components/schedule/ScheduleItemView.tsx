import Badge from '@mui/icons-material/Badge';
import HistoryEdu from '@mui/icons-material/HistoryEdu';
import PersonSearch from '@mui/icons-material/PersonSearch';
import Box from '@mui/material/Box';
import { useTheme, type Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { memo, type PointerEventHandler } from 'react';
import type { ScheduleBlock, ScheduleClosure } from '../../api';
import type { IsoDate } from '../../lib/dates';
import { blockMarkers, blockSpan } from '../../app/scheduleGrid';
import type { BlockLayout } from '../../app/schedule';
import type { ScheduleItem } from '../../app/scheduleDrag';
import {
  BLOCK_HEIGHT,
  BLOCK_ICON_SPACING,
  BLOCK_TOP,
  dateAreaWidth,
  MARKER_GAP,
  MARKER_WIDTH,
  dateAreaX,
} from './scheduleLayout';

export interface ScheduleItemViewProps {
  item: ScheduleItem;
  layout: BlockLayout;
  days: number;
  today: IsoDate;
  /** Accessible name and id; absent for the drag ghost, which is hidden from assistive technology. */
  label?: string;
  id?: string;
  /** The floating copy that follows the pointer while dragging. */
  ghost?: boolean;
  /** This item is being dragged: the original stays in place, dimmed. */
  dragging?: boolean;
  /** The keyboard cursor is on this block. */
  active?: boolean;
  onPointerDown?: PointerEventHandler<HTMLElement>;
}

function fill(item: ScheduleItem, today: IsoDate, t: Theme): string {
  const c = t.palette.schedule;
  if (item.kind === 'closure') return c.closure;
  switch (item.status) {
    case 'checked-in':
      return item.endDate === today ? c.dueOut : c.checkedIn;
    case 'checked-out':
      return c.checkedOut;
    default:
      return c.nyci;
  }
}

const NAME_COLOR = (t: Theme, item: ScheduleBlock) =>
  item.guestType === 'owner'
    ? t.palette.schedule.ownerText
    : item.guestType === 'member'
      ? t.palette.schedule.memberText
      : t.palette.text.primary;

function TypeIcon({ type }: { type: ScheduleBlock['guestType'] }) {
  const sx = { fontSize: (t: Theme) => t.spacing(BLOCK_ICON_SPACING), flexShrink: 0 };
  if (type === 'owner') return <HistoryEdu aria-hidden sx={sx} />;
  if (type === 'member') return <Badge aria-hidden sx={sx} />;
  if (type === 'guest') return <PersonSearch aria-hidden sx={sx} />;
  return null;
}

/**
 * One reservation or closure block, absolutely positioned across the date columns of its row
 * (Figma "Reservation Schedule Block"). Colors come from `palette.schedule`.
 */
export default memo(function ScheduleItemView({
  item,
  layout,
  days,
  today,
  label,
  id,
  ghost = false,
  dragging = false,
  active,
  onPointerDown,
}: ScheduleItemViewProps) {
  const theme = useTheme();
  const span = blockSpan(layout, days);
  const marker = (side: 'left' | 'right') => (
    <Box
      aria-hidden
      data-marker={side}
      sx={(t) => ({
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: t.spacing(0.375),
        bgcolor: 'warning.main',
        borderRadius:
          side === 'left'
            ? `${t.spacing(0.625)} 0 0 ${t.spacing(0.625)}`
            : `0 ${t.spacing(0.625)} ${t.spacing(0.625)} 0`,
      })}
    />
  );
  const isClosure = item.kind === 'closure';
  const closure = item as ScheduleClosure;
  const block = item as ScheduleBlock;
  const settled = !isClosure && (block.status === 'checked-in' || block.status === 'checked-out');
  const markers = isClosure
    ? { left: false, right: false, leftClipped: false }
    : blockMarkers(block, layout);
  // A block clipped at the left edge of the grid whose arrival was an early check in: its painted body
  // gives up the sliver and a gap on that edge, and the sliver sits in the freed strip against the grid.
  const inset = (t: Theme) => t.spacing(MARKER_WIDTH + MARKER_GAP);
  const clippedSliver = (
    <Box
      aria-hidden
      data-marker="left-clipped"
      sx={(t) => ({
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: t.spacing(MARKER_WIDTH),
        bgcolor: 'warning.main',
      })}
    />
  );
  return (
    <Box
      id={id}
      role={ghost ? undefined : 'gridcell'}
      aria-hidden={ghost || undefined}
      aria-label={label}
      aria-colindex={ghost ? undefined : layout.column + 2}
      data-item-id={item.id}
      data-kind={item.kind}
      data-active={active || undefined}
      // Geometry is inline (not sx): it differs for every block and would mint a CSS class each.
      style={{
        left: dateAreaX(span.start),
        width: dateAreaWidth(span.end - span.start, theme.spacing(0.25)),
      }}
      onPointerDown={onPointerDown}
      sx={(t) => ({
        position: 'absolute',
        top: t.spacing(BLOCK_TOP),
        height: t.spacing(BLOCK_HEIGHT),
        marginLeft: t.spacing(0.125),
        boxSizing: 'border-box',
        cursor: ghost ? 'grabbing' : 'grab',
        touchAction: 'auto',
        opacity: dragging ? 0.4 : ghost ? 0.9 : 1,
        zIndex: ghost ? 20 : 2,
        pointerEvents: ghost ? 'none' : 'auto',
        '&:hover > [data-body]': ghost ? {} : { filter: 'brightness(0.97)' },
      })}
    >
      <Box
        data-body
        sx={(t) => {
          const near = t.spacing(0.625);
          const far = t.spacing(0.375);
          // Checked-in and checked-out blocks round the left corners more; others the right (Figma).
          const [left, right] = settled || isClosure ? [near, far] : [far, near];
          const cl = layout.continuesBefore ? 0 : left;
          const cr = layout.continuesAfter ? 0 : right;
          return {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: markers.leftClipped ? inset(t) : 0,
            right: 0,
            boxSizing: 'border-box',
            px: 0.75,
            py: 0.25,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 0.25,
            overflow: 'hidden',
            bgcolor: fill(item, today, t),
            border: isClosure || settled ? 'none' : `0.5px solid ${t.palette.schedule.nyciBorder}`,
            borderRadius: `${cl} ${cr} ${cr} ${cl}`,
            boxShadow: t.shadows[1],
          };
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          {isClosure ? null : <TypeIcon type={block.guestType} />}
          <Typography
            variant="subtitle2"
            component="span"
            noWrap
            sx={(t) => ({
              fontWeight: 500,
              color: isClosure ? t.palette.grey[900] : NAME_COLOR(t, block),
              minWidth: 0,
            })}
          >
            {isClosure ? closure.reason : block.guestName}
          </Typography>
        </Box>
        {isClosure ? null : (
          <Typography
            variant="caption"
            component="span"
            noWrap
            sx={(t) => ({ color: settled ? t.palette.grey[800] : t.palette.text.secondary })}
          >
            {block.confirmationNumber}
          </Typography>
        )}
        {isClosure && closure.endMarker ? (
          <>
            {layout.continuesBefore ? null : marker('left')}
            {layout.continuesAfter ? null : marker('right')}
          </>
        ) : null}
        {/* Early Check In / Late Check Out edge markers at a real arrival / departure edge. */}
        {markers.left ? marker('left') : null}
        {markers.right ? marker('right') : null}
      </Box>
      {markers.leftClipped ? clippedSliver : null}
    </Box>
  );
});
