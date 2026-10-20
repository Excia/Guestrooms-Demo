import ChevronRight from '@mui/icons-material/ChevronRight';
import DoorFront from '@mui/icons-material/DoorFront';
import MeetingRoom from '@mui/icons-material/MeetingRoom';
import Percent from '@mui/icons-material/Percent';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { useId, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import type { OccupancyCounts, QuickStatsRevenue } from '../api';
import {
  formatCount,
  formatMoney,
  formatMoneyWhole,
  formatPercent,
  weightedAverageRateOrNull,
} from '../app/quickStats';
import { ROOM_BLOCKS_PATH } from '../app/routes';

const cellBase: SxProps<Theme> = { border: 0, px: 0, py: 1.25 };
const numeric: SxProps<Theme> = {
  ...cellBase,
  // Numbers hug their content (width 1%); the label column takes the remaining width.
  width: '1%',
  pl: 1,
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: (t: Theme) => t.typography.fontWeightBold,
  color: 'text.secondary',
};
// Rows under the icon+value cells: the same 10px right inset, so the numbers line up with the TOTAL.
// width 1% makes these columns hug their content, so the label column takes the slack.
const rowValue: SxProps<Theme> = { ...numeric, pl: 0, pr: 1.25, width: '1%' };
const labelCell: SxProps<Theme> = {
  ...cellBase,
  color: 'text.primary',
  overflowWrap: 'anywhere',
};
const columnHeader: SxProps<Theme> = {
  ...cellBase,
  pt: 0,
  pb: 1.25,
  pl: 1,
  width: '1%',
  textAlign: 'right',
  color: 'text.secondary',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

/** Green section heading (Figma: 18px bold, primary). */
export function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Typography
      id={id}
      variant="subtitle1"
      component="h3"
      color="primary"
      sx={{ fontWeight: (t) => t.typography.fontWeightBold }}
    >
      {children}
    </Typography>
  );
}

function Hidden({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={visuallyHidden}>
      {children}
    </Box>
  );
}

// The icons carry the meaning for sighted users; the hidden text names them for everyone else.
const OCCUPANCY_ICON = {
  booked: { Icon: DoorFront, name: 'Booked rooms' },
  available: { Icon: MeetingRoom, name: 'Available rooms' },
  percent: { Icon: Percent, name: 'Occupancy percent' },
} as const;

function IconValue({ kind, children }: { kind: keyof typeof OCCUPANCY_ICON; children: ReactNode }) {
  const { Icon, name } = OCCUPANCY_ICON[kind];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.625,
        px: 0.75,
        py: 1.25,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon aria-hidden="true" sx={{ color: 'action.active' }} />
      <Typography
        component="span"
        variant="body2"
        sx={{
          fontWeight: (t) => t.typography.fontWeightBold,
          color: 'text.secondary',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Hidden>{name}: </Hidden>
        {children}
      </Typography>
    </Box>
  );
}

/** The tinted bar under the period control: booked rooms, available rooms, occupancy percent. */
export function OccupancySummary({ counts, sx }: { counts: OccupancyCounts; sx?: SxProps<Theme> }) {
  const labelId = useId();
  return (
    <Box
      role="group"
      aria-labelledby={labelId}
      sx={[
        (t) => ({
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: 0.5,
          px: 1.5,
          py: 1,
          borderRadius: 2.5,
          backgroundColor: t.palette.primary.tint,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Typography id={labelId} variant="body2">
        OCCUPANCY
      </Typography>
      <IconValue kind="booked">{formatCount(counts.booked)}</IconValue>
      <IconValue kind="available">{formatCount(counts.available)}</IconValue>
      <IconValue kind="percent">{formatPercent(counts.percent)}</IconValue>
    </Box>
  );
}

/** Revenue by rate category: a TOTAL row, then one row per category in the data. */
export function RevenueTable({ title, revenue }: { title: string; revenue: QuickStatsRevenue }) {
  const titleId = useId();
  return (
    <Box component="div">
      <SectionTitle id={titleId}>{title}</SectionTitle>
      <Table size="small" aria-labelledby={titleId} sx={{ mt: 1.5 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...labelCell, p: 0 }}>
              <Hidden>Rate category</Hidden>
            </TableCell>
            <TableCell sx={columnHeader}>Revenue</TableCell>
            <TableCell sx={columnHeader}>Avg. Rate</TableCell>
            <TableCell sx={columnHeader}>Nights</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell component="th" scope="row" sx={{ ...labelCell, fontWeight: 400 }}>
              TOTAL
            </TableCell>
            <TableCell sx={numeric}>{formatMoneyWhole(revenue.totalRevenue)}</TableCell>
            <TableCell sx={numeric}>{formatMoney(revenue.averageRate)}</TableCell>
            <TableCell sx={numeric}>{formatCount(revenue.totalNights)}</TableCell>
          </TableRow>
          {revenue.rows.map((row) => {
            const average = weightedAverageRateOrNull(row.revenue, row.nights);
            return (
              <TableRow key={row.id}>
                <TableCell component="th" scope="row" sx={{ ...labelCell, fontWeight: 400 }}>
                  {row.name}
                </TableCell>
                <TableCell sx={numeric}>{formatMoney(row.revenue)}</TableCell>
                <TableCell sx={numeric}>
                  {formatMoney(average)}
                  {average === null ? null : (
                    <Typography
                      component="span"
                      variant="inherit"
                      sx={{ fontWeight: 400, whiteSpace: 'pre' }}
                    >
                      {' (avg)'}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={numeric}>{formatCount(row.nights)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

export interface OccupancyRow {
  id: string;
  /** First column: a date, or a block name with its subtitle. */
  label: ReactNode;
  counts: OccupancyCounts;
}

/** Booked, available and percent per row, under a TOTAL row (percent is the average). */
export function OccupancyTable({
  title,
  firstColumn,
  rows,
  total,
  action,
}: {
  title: string;
  /** Accessible name of the first column ("Date", "Room block"). */
  firstColumn: string;
  rows: readonly OccupancyRow[];
  total: OccupancyCounts;
  /** Shown opposite the title ("All Room Blocks"). */
  action?: ReactNode;
}) {
  const titleId = useId();
  return (
    <Box component="div">
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <SectionTitle id={titleId}>{title}</SectionTitle>
        {action}
      </Box>
      <Table size="small" aria-labelledby={titleId} sx={{ mt: 1.5 }}>
        <TableHead>
          <TableRow sx={visuallyHidden}>
            <TableCell>{firstColumn}</TableCell>
            <TableCell>Booked rooms</TableCell>
            <TableCell>Available rooms</TableCell>
            <TableCell>Occupancy percent</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell
              component="th"
              scope="row"
              sx={{ ...labelCell, width: 'auto', fontWeight: 400 }}
            >
              TOTAL
            </TableCell>
            <TableCell sx={{ ...numeric, py: 0, pl: 0, pr: 0, width: '1%' }}>
              <IconValue kind="booked">{formatCount(total.booked)}</IconValue>
            </TableCell>
            <TableCell sx={{ ...numeric, py: 0, pl: 0, pr: 0, width: '1%' }}>
              <IconValue kind="available">{formatCount(total.available)}</IconValue>
            </TableCell>
            <TableCell sx={{ ...numeric, py: 0, pl: 0, pr: 0, width: '1%' }}>
              <IconValue kind="percent">
                {formatPercent(total.percent)}{' '}
                <Typography component="span" variant="inherit" sx={{ fontWeight: 400 }}>
                  (avg)
                </Typography>
              </IconValue>
            </TableCell>
          </TableRow>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell
                component="th"
                scope="row"
                sx={{ ...labelCell, width: 'auto', fontWeight: 400 }}
              >
                {row.label}
              </TableCell>
              <TableCell sx={rowValue}>{formatCount(row.counts.booked)}</TableCell>
              <TableCell sx={rowValue}>{formatCount(row.counts.available)}</TableCell>
              <TableCell sx={rowValue}>{formatPercent(row.counts.percent)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/** Figma "ALL ROOM BLOCKS >": a text button that links to the Room Blocks page. */
export function AllRoomBlocksLink() {
  return (
    <Button component={RouterLink} to={ROOM_BLOCKS_PATH} size="small" endIcon={<ChevronRight />}>
      All Room Blocks
    </Button>
  );
}
