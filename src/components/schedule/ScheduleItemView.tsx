import Badge from '@mui/icons-material/Badge';
import HistoryEdu from '@mui/icons-material/HistoryEdu';
import LinkIcon from '@mui/icons-material/Link';
import PersonSearch from '@mui/icons-material/PersonSearch';
import Box from '@mui/material/Box';
import { useTheme, type Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { memo, useMemo, useRef, useState, type PointerEventHandler } from 'react';
import type { HousekeepingStatus, ScheduleBlock, ScheduleClosure } from '../../api';
import { daysBetween, type IsoDate } from '../../lib/dates';
import { anyTruncated } from '../../app/overflow';
import { housekeepingStatusOf } from '../../app/housekeepingBlocks';
import { blockFillToken, housekeepingFillToken } from '../../app/scheduleColors';
import { blockContent, blockTooltipLines } from '../../app/scheduleBlockContent';
import { blockMarkers, blockSpan, housekeepingChip } from '../../app/scheduleGrid';
import { linkedBlockText, linkedTooltipLines } from '../../app/scheduleLinked';
import HousekeepingChip, { type SetHousekeeping } from './HousekeepingChip';
import { closureBlockText, closureFullText } from '../../app/closures';
import type { BlockLayout } from '../../app/schedule';
import type { ScheduleItem } from '../../app/scheduleDrag';
import {
  BLOCK_HEIGHT,
  BLOCK_ICON_SPACING,
  BLOCK_TOP,
  dateAreaWidth,
  dateAreaX,
} from './scheduleLayout';

/** Linked-room blocks are drawn dimmed (legacy: 75%). */
const LINKED_OPACITY = 0.75;

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
  /** Room change during the stay: "2/3 ← 201 → 207" next to the confirmation number (and the tooltip). */
  linkText?: string;
  /**
   * The full text of the block ("Victor Almeida, GR-50271, part 2 of 5, Room 301 → 207"), shown in a
   * tooltip on hover or keyboard focus when the block's text is cut off. Created only when first
   * needed; the accessible name stays `label` (the tooltip is not announced a second time). For a
   * reservation it is the summary line; the facts below it are built from the block when the tooltip
   * is first created (a plain string keeps this memoized component's props comparable by value).
   */
  tip?: string;
  /** The grid has focus and the keyboard cursor is on this block: show the tooltip like hover does. */
  tipFocused?: boolean;
  onPointerDown?: PointerEventHandler<HTMLElement>;
  /**
   * A block that cannot be dragged (Unassigned section): it is a tab stop and Enter or Space call
   * this, as a click does. The grid's cursor model only covers room rows.
   */
  onActivate?: () => void;
  /** Saves a housekeeping change from the "H" chip; absent when the user may not change it. */
  onSetHousekeeping?: SetHousekeeping;
  /** Px kept clear at the left edge (a same-day turnover's housekeeping chip), 0 for none. */
  leadGap?: number;
}

function fill(item: ScheduleItem, today: IsoDate, t: Theme): string {
  return t.palette.schedule[blockFillToken(item, today)];
}

function housekeepingFill(status: HousekeepingStatus, t: Theme): string {
  const token = housekeepingFillToken(status);
  return token ? t.palette.schedule[token] : 'transparent';
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
 * Content of a linked-room block (legacy behavior): the link icon with a bold first line, and a
 * second line; what the lines say depends on the view and the stay length (`linkedBlockText`).
 * Text is cut with an ellipsis; the tooltip has the full text.
 */
function LinkedContent({ text }: { text: { title: string; subtitle: string } }) {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 0.5, minWidth: 0 }}>
        <LinkIcon
          aria-hidden
          data-testid="linked-icon"
          sx={{ fontSize: (t) => t.spacing(BLOCK_ICON_SPACING), flexShrink: 0 }}
        />
        {text.title ? (
          <Typography
            variant="subtitle2"
            component="span"
            noWrap
            sx={{ fontWeight: 700, minWidth: 0 }}
          >
            {text.title}
          </Typography>
        ) : null}
      </Box>
      {text.subtitle ? (
        <Typography
          variant="caption"
          component="span"
          noWrap
          sx={(t) => ({ color: t.palette.text.primary })}
        >
          {text.subtitle}
        </Typography>
      ) : null}
    </>
  );
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
  linkText,
  tip,
  tipFocused,
  onPointerDown,
  onActivate,
  onSetHousekeeping,
  leadGap = 0,
}: ScheduleItemViewProps) {
  const theme = useTheme();
  // The tooltip is created on the first hover or keyboard focus, not for every block of the grid.
  const [armed, setArmed] = useState(false);
  const [hover, setHover] = useState(false);
  const [cutOff, setCutOff] = useState(false);
  // A tab stop (Unassigned section) has DOM focus; room-row blocks use the grid's cursor (tipFocused).
  const [focusIn, setFocusIn] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const linked = item.kind === 'reservation' ? item.linkedTo : undefined;
  const linkedText = linked
    ? linkedBlockText(linked, days, daysBetween(item.startDate, item.endDate))
    : null;
  const span = blockSpan(layout, days);
  // A short closure shows the first 20 characters of its description; the tooltip has all of it.
  const closureText =
    item.kind === 'closure' ? closureBlockText(item.reason, item.startDate, item.endDate) : '';
  const closureCut = item.kind === 'closure' && closureText !== closureFullText(item.reason);
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
  // Keyboard focus (the grid's cursor) shows the full text like hover does; hover only when cut off.
  // A linked block's tooltip ("Linked to ...") opens on every hover and focus, not only when cut off.
  const tipArmed = armed || Boolean(tipFocused) || focusIn;
  // A reservation block's tooltip lists more than the block shows (every occupant, the reserver), so
  // it opens on every hover; a closure's only repeats its text, so only when that is cut off.
  const tipOpen =
    Boolean(tipFocused) ||
    focusIn ||
    (hover && (cutOff || Boolean(linked) || item.kind === 'reservation'));
  const tipLines = useMemo(
    () =>
      !tipArmed || linked || tip === undefined
        ? null
        : item.kind === 'reservation'
          ? blockTooltipLines(item, tip)
          : [tip],
    [tipArmed, linked, tip, item],
  );
  const hasTip = Boolean(linked) || tip !== undefined;
  const tipContent = linked ? (
    <span>
      {linkedTooltipLines(linked).map((line, i) => (
        <Box key={i} component="span" sx={{ display: 'block' }}>
          {line}
        </Box>
      ))}
    </span>
  ) : tipLines?.length ? (
    <span>
      {tipLines.map((line, i) => (
        <Box key={i} component="span" sx={{ display: 'block' }}>
          {line}
        </Box>
      ))}
    </span>
  ) : null;
  const isClosure = item.kind === 'closure';
  const closure = item as ScheduleClosure;
  const block = item as ScheduleBlock;
  const settled =
    !isClosure && !linked && (block.status === 'checked-in' || block.status === 'checked-out');
  const hkStatus = isClosure || ghost ? undefined : housekeepingStatusOf(block);
  const hk = housekeepingChip(hkStatus, layout, days, Boolean(block.housekeepingNotes));
  const markers = isClosure ? { left: false, right: false } : blockMarkers(block, layout);
  const content = isClosure || linked ? null : blockContent(block, days);
  const bodyBox = (
    <Box
      data-body
      ref={bodyRef}
      sx={(t) => {
        const near = t.spacing(0.625);
        const far = t.spacing(0.375);
        // Checked-in and checked-out blocks round the left corners more; others the right (Figma).
        const [left, right] = settled || isClosure ? [near, far] : [far, near];
        // A block clipped at the left edge is flat there to show it goes on, unless it carries the
        // early check in sliver: then the sliver is its left edge, a rounded card like any other.
        const cl = layout.continuesBefore && !markers.left ? 0 : left;
        const cr = layout.continuesAfter ? 0 : right;
        return {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
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
          border:
            isClosure || settled || linked
              ? 'none'
              : `0.5px solid ${t.palette.schedule.nyciBorder}`,
          borderRadius: `${cl} ${cr} ${cr} ${cl}`,
          boxShadow: t.shadows[1],
        };
      }}
    >
      {linked ? (
        <LinkedContent text={linkedText!} />
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            {isClosure || !content?.showIcon ? null : <TypeIcon type={block.guestType} />}
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
              {isClosure ? closureText : content?.title}
            </Typography>
          </Box>
          {isClosure ? null : (
            <Typography
              variant="caption"
              component="span"
              noWrap
              sx={(t) => ({ color: settled ? t.palette.grey[800] : t.palette.text.secondary })}
            >
              {content?.detail || block.confirmationNumber}
              {linkText ? ` · ${linkText}` : ''}
            </Typography>
          )}
        </>
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
      aria-disabled={linked ? true : undefined}
      data-linked={linked ? 'true' : undefined}
      data-unassigned={onActivate ? 'true' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      // A linked block stays a tab stop (its tooltip opens on focus); its owner only announces why
      // nothing opens.
      onKeyDown={
        onActivate
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
      // Geometry is inline (not sx): it differs for every block and would mint a CSS class each.
      style={{
        left: leadGap ? `calc(${dateAreaX(span.start)} + ${leadGap}px)` : dateAreaX(span.start),
        width: dateAreaWidth(span.end - span.start, `calc(${theme.spacing(0.25)} + ${leadGap}px)`),
      }}
      onFocus={onActivate ? () => setFocusIn(true) : undefined}
      onBlur={onActivate ? () => setFocusIn(false) : undefined}
      onPointerDown={
        onPointerDown && !linked
          ? (e) => {
              // Pressing (and then dragging) the block puts its tooltip away.
              setHover(false);
              onPointerDown(e);
            }
          : undefined
      }
      onPointerEnter={
        ghost || !hasTip
          ? undefined
          : () => {
              setCutOff(
                closureCut || anyTruncated(bodyRef.current?.querySelectorAll('span') ?? []),
              );
              setArmed(true);
              setHover(true);
            }
      }
      onPointerLeave={ghost || !hasTip ? undefined : () => setHover(false)}
      sx={(t) => ({
        position: 'absolute',
        top: t.spacing(BLOCK_TOP),
        height: t.spacing(BLOCK_HEIGHT),
        marginLeft: t.spacing(0.125),
        boxSizing: 'border-box',
        cursor: linked
          ? 'not-allowed'
          : ghost
            ? 'grabbing'
            : onActivate || isClosure
              ? 'pointer'
              : 'grab',
        touchAction: 'auto',
        opacity: dragging ? 0.4 : ghost ? 0.9 : linked ? LINKED_OPACITY : 1,
        zIndex: ghost ? 20 : 2,
        pointerEvents: ghost ? 'none' : 'auto',
        '&:hover > [data-body]': ghost ? {} : { filter: 'brightness(0.97)' },
        '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
      })}
    >
      {tipArmed && tipContent ? (
        // The title is an element, not a string: MUI then adds neither a native `title` (the browser's
        // own tooltip) nor an aria-label to the body, and the popper is hidden from assistive
        // technology (the cell's aria-label already says it all).
        <Tooltip
          title={tipContent}
          open={tipOpen}
          disableInteractive
          slotProps={{ popper: { 'aria-hidden': true } }}
        >
          {bodyBox}
        </Tooltip>
      ) : (
        bodyBox
      )}
      {hk && hkStatus ? (
        <HousekeepingChip
          block={block}
          status={hkStatus}
          chip={hk}
          fill={housekeepingFill(hkStatus, theme)}
          onSave={onSetHousekeeping}
        />
      ) : null}
    </Box>
  );
});
