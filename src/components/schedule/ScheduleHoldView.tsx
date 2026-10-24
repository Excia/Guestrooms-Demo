import Lock from '@mui/icons-material/Lock';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { memo, useState } from 'react';
import type { ScheduleHold } from '../../api';
import type { BlockLayout } from '../../app/schedule';
import { blockSpan } from '../../app/scheduleGrid';
import { holdTipText } from '../../app/slotHolds';
import {
  BLOCK_HEIGHT,
  BLOCK_ICON_SPACING,
  BLOCK_TOP,
  dateAreaWidth,
  dateAreaX,
} from './scheduleLayout';

export interface ScheduleHoldViewProps {
  hold: ScheduleHold;
  layout: BlockLayout;
  days: number;
  /** Accessible name; the shading alone says nothing. */
  label: string;
  id?: string;
  /** The keyboard cursor is on this hold: its tooltip shows like on hover. */
  tipFocused?: boolean;
  /** The New Reservation panel that placed this hold is open. */
  own?: boolean;
  timeZone?: string;
}

/**
 * A held slot (ticket 152): tint, diagonal stripes, a dashed outline and a lock icon, so it reads
 * without colour. It is never draggable or openable: pointer presses on it do nothing here, and the
 * grid answers a click or Enter with "Room held until ...". PLACEHOLDER look, no Figma frame (F-152-1).
 */
export default memo(function ScheduleHoldView({
  hold,
  layout,
  days,
  label,
  id,
  tipFocused,
  own,
  timeZone,
}: ScheduleHoldViewProps) {
  const span = blockSpan(layout, days);
  const [hover, setHover] = useState(false);
  const tip = holdTipText(hold, timeZone);
  const body = (
    <Box
      data-body
      sx={(t) => ({
        position: 'absolute',
        inset: 0,
        boxSizing: 'border-box',
        px: 0.75,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        overflow: 'hidden',
        color: t.palette.text.primary,
        backgroundColor: t.palette.schedule.hold,
        backgroundImage: `repeating-linear-gradient(135deg, ${t.palette.schedule.holdStripe} 0 ${t.spacing(0.5)}, transparent ${t.spacing(0.5)} ${t.spacing(1.5)})`,
        border: `${own ? '2px solid' : '1px dashed'} ${t.palette.schedule.holdBorder}`,
        borderRadius: t.spacing(0.5),
      })}
    >
      <Lock aria-hidden sx={{ fontSize: (t) => t.spacing(BLOCK_ICON_SPACING), flexShrink: 0 }} />
      <Typography variant="caption" component="span" noWrap sx={{ minWidth: 0 }}>
        {tip}
      </Typography>
    </Box>
  );
  return (
    <Box
      id={id}
      role="gridcell"
      aria-label={label}
      aria-colindex={layout.column + 2}
      aria-disabled
      data-hold-id={hold.id}
      data-kind="hold"
      data-own={own || undefined}
      style={{
        left: dateAreaX(span.start),
        width: dateAreaWidth(span.end - span.start, '0px'),
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      sx={(t) => ({
        position: 'absolute',
        top: t.spacing(BLOCK_TOP),
        height: t.spacing(BLOCK_HEIGHT),
        marginLeft: t.spacing(0.125),
        boxSizing: 'border-box',
        cursor: 'not-allowed',
        // Above the blocks of the row, below the room header.
        zIndex: 2,
      })}
    >
      <Tooltip
        // An element, not a string: MUI then adds no second aria-label to the block.
        title={<span>{tip}</span>}
        open={hover || Boolean(tipFocused)}
        disableInteractive
        slotProps={{ popper: { 'aria-hidden': true } }}
      >
        {body}
      </Tooltip>
    </Box>
  );
});
