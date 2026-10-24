import AddCircle from '@mui/icons-material/AddCircle';
import RemoveCircle from '@mui/icons-material/RemoveCircle';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import type { ScheduleBlock } from '../../api';
import type { IsoDate } from '../../lib/dates';
import { blockLayout } from '../../app/schedule';
import { blockAriaLabel } from '../../app/scheduleGrid';
import {
  unassignedLabel,
  unassignedToggleName,
  type UnassignedSection as Section,
} from '../../app/unassignedRows';
import ScheduleItemView from './ScheduleItemView';
import { LABEL_VAR, LABEL_WIDTH, ROW_HEIGHT, ROW_VAR, rowTop } from './scheduleLayout';

export interface UnassignedSectionProps {
  section: Section;
  startDate: IsoDate;
  days: 7 | 14 | 30;
  today: IsoDate;
  idPrefix: string;
  onToggle: () => void;
  /** A block was activated by keyboard; clicks are handled by the grid. */
  onOpen: (block: ScheduleBlock) => void;
}

/**
 * Reservations booked without a room, above the room rows (Figma "Schedule - 1 Unassigned" and
 * "2+ Unassigned"). Blocks here cannot be dragged or dropped on: a room is assigned in the
 * reservation panel. The rows are tinted across the whole width, the label column included.
 */
export default function UnassignedSection({
  section,
  startDate,
  days,
  today,
  idPrefix,
  onToggle,
  onOpen,
}: UnassignedSectionProps) {
  if (section.state === 'none') return null;
  const label = unassignedLabel(section);
  const expanded = section.state !== 'collapsed';
  const Icon = expanded ? RemoveCircle : AddCircle;
  return (
    <Box
      role="rowgroup"
      data-unassigned-section={section.state}
      sx={(t) => ({
        position: 'relative',
        height: `calc(${section.rows.length} * ${t.spacing(ROW_HEIGHT)})`,
      })}
    >
      {section.rows.map((blocks, index) => (
        <Box
          // The first row keeps one key through expand/collapse so the toggle is not remounted (focus).
          key={index === 0 ? 'head' : blocks[0].id}
          role="row"
          aria-rowindex={index + 2}
          style={{ top: rowTop(index) }}
          sx={(t) => ({
            position: 'absolute',
            left: 0,
            right: 0,
            height: `var(${ROW_VAR})`,
            boxSizing: 'border-box',
            bgcolor: t.palette.schedule.unassignedRow,
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
            aria-label={index === 0 ? undefined : 'Unassigned'}
            sx={(t) => ({
              position: 'sticky',
              left: 0,
              zIndex: 3,
              width: t.spacing(LABEL_WIDTH),
              height: '100%',
              boxSizing: 'border-box',
              px: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              textAlign: 'center',
              bgcolor: t.palette.schedule.unassignedRow,
              borderRight: `1px solid ${t.palette.divider}`,
            })}
          >
            {index === 0 ? (
              <>
                {section.toggleable ? (
                  <IconButton
                    size="small"
                    color="error"
                    aria-expanded={expanded}
                    aria-label={unassignedToggleName()}
                    onClick={onToggle}
                    sx={{ p: 0.25 }}
                  >
                    <Icon fontSize="small" aria-hidden />
                  </IconButton>
                ) : null}
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Typography variant="subtitle2" component="span" sx={{ lineHeight: 1.2 }}>
                    {label.title}
                  </Typography>
                  {label.count ? (
                    <Typography variant="subtitle2" component="span" sx={{ lineHeight: 1.2 }}>
                      {label.count}
                    </Typography>
                  ) : null}
                </Box>
              </>
            ) : null}
          </Box>
          {blocks.map((block) => {
            const layout = blockLayout(block, startDate, days);
            if (!layout) return null;
            return (
              <ScheduleItemView
                key={block.id}
                id={`${idPrefix}-item-${block.id}`}
                item={block}
                layout={layout}
                days={days}
                today={today}
                label={blockAriaLabel(block, undefined)}
                tip={`${block.guestName}, ${block.confirmationNumber}`}
                onActivate={() => onOpen(block)}
              />
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
