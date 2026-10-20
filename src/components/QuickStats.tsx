import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import type { Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useId, useState } from 'react';
import { isValidIsoDate, todayIso, type IsoDate, type WeekStart } from '../app/dateSelection';
import {
  CONTROL_LABELS,
  DEFAULT_VIEW,
  QUICK_STATS_VIEWS,
  REVENUE_TITLES,
  VIEW_LABELS,
  blockSubtitle,
  defaultPeriods,
  formatShortDate,
  isQuickStatsEmpty,
  monthChoices,
} from '../app/quickStats';
import type { QuickStats as QuickStatsData, QuickStatsView } from '../api';
import DateField from './shared/DateField';
import Select from './shared/Select';
import {
  AllRoomBlocksLink,
  OccupancySummary,
  OccupancyTable,
  RevenueTable,
  type OccupancyRow,
} from './QuickStatsTables';
import { useQuickStats, type QuickStatsState } from './useQuickStats';

export interface QuickStatsProps {
  /**
   * `dashboard`: the single-column stack in the dashboard column (Figma 1302:18431 and siblings).
   * `landing`: the same content in two columns for the Reporting landing page (Figma 78:3516 and
   * siblings). Both fetch the same data.
   */
  placement?: 'dashboard' | 'landing';
  /** Local calendar date treated as "today" (default dates, the "(to date)" month). Injectable for tests. */
  today?: IsoDate;
  weekStartsOn?: WeekStart;
}

/** Date control width in theme spacing: 23.4375 x 8px = 187.5px (Figma). */
const DATE_FIELD_WIDTH = 23.4375;
/** Month select width: 26 x 8px = 208px (Figma). */
const MONTH_FIELD_WIDTH = 26;

const monthPeriodOptions = (today: IsoDate) => monthChoices(today);

/**
 * Date input that keeps what the user types and only reports complete, valid dates, so a half-typed
 * date neither refetches nor snaps back.
 */
function DateControl({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: IsoDate;
  onCommit: (value: IsoDate) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <DateField
      label={label}
      value={draft}
      fullWidth={false}
      onChange={(next) => {
        setDraft(next);
        if (isValidIsoDate(next)) onCommit(next);
      }}
      // A cleared or incomplete date goes back to the last valid one when the field loses focus.
      onBlur={() => {
        if (!isValidIsoDate(draft)) setDraft(value);
      }}
      error={!isValidIsoDate(draft)}
      sx={{ width: (t) => t.spacing(DATE_FIELD_WIDTH), maxWidth: '100%' }}
    />
  );
}

/** The previous answer stays while a new period loads, dimmed. */
const dim = (on: boolean) => (on ? { opacity: 0.5, transition: 'opacity 150ms' } : {});

function QuickStatsSkeleton({ landing }: { landing: boolean }) {
  const table = (
    <Box>
      <Skeleton width="40%" height={28} />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} height={40} />
      ))}
    </Box>
  );
  return (
    <>
      <Skeleton variant="rounded" height={56} />
      <Box
        sx={(t) => ({
          display: 'grid',
          gap: 2.5,
          [t.breakpoints.up('md')]: { gridTemplateColumns: landing ? '1fr 1fr' : '1fr' },
        })}
      >
        {table}
        {table}
      </Box>
    </>
  );
}

function Sections({ stats, landing }: { stats: QuickStatsData; landing: boolean }) {
  const revenue = <RevenueTable title={REVENUE_TITLES[stats.view]} revenue={stats.revenue} />;
  let detail;
  if (stats.view === 'week') {
    const rows: OccupancyRow[] = stats.days.map((d) => ({
      id: d.date,
      label: formatShortDate(d.date),
      counts: d.counts,
    }));
    detail = (
      <OccupancyTable title="Occupancy" firstColumn="Date" rows={rows} total={stats.daysTotal} />
    );
  } else {
    const rows: OccupancyRow[] = stats.roomBlocks.map((b) => ({
      id: b.id,
      label: (
        <>
          {b.name}
          <Typography
            variant="caption"
            color="text.secondary"
            component="span"
            // Figma sets the block subtitle at 10px: 10/14 of the 14px row text.
            sx={{ display: 'block', fontSize: '0.714em', lineHeight: 1.43 }}
          >
            {blockSubtitle(b.nights, b.startDate)}
          </Typography>
        </>
      ),
      counts: b.counts,
    }));
    detail = (
      <OccupancyTable
        title="Room Blocks"
        firstColumn="Room block"
        rows={rows}
        total={stats.roomBlocksTotal}
        action={<AllRoomBlocksLink />}
      />
    );
  }
  return (
    <Box
      sx={(t) => ({
        display: 'grid',
        gap: 2.5,
        gridTemplateColumns: '1fr',
        [t.breakpoints.up('md')]: landing
          ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
          : {},
      })}
    >
      {revenue}
      {detail}
    </Box>
  );
}

function Panel({
  view,
  period,
  onPeriodChange,
  today,
  landing,
  state,
}: {
  view: QuickStatsView;
  period: string;
  onPeriodChange: (value: string) => void;
  today: IsoDate;
  landing: boolean;
  state: QuickStatsState & { retry: () => void };
}) {
  const control =
    view === 'month' ? (
      <Select
        label={CONTROL_LABELS.month}
        value={period}
        options={monthPeriodOptions(today)}
        onChange={onPeriodChange}
        sx={{ width: (t) => t.spacing(MONTH_FIELD_WIDTH), maxWidth: '100%' }}
      />
    ) : (
      <DateControl label={CONTROL_LABELS[view]} value={period} onCommit={onPeriodChange} />
    );
  const stats = state.status === 'success' ? state.data : null;
  const empty = stats ? isQuickStatsEmpty(stats) : false;
  const refreshing = state.status === 'success' && state.refreshing;

  return (
    <Box
      aria-busy={state.status === 'loading' || refreshing}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
    >
      <Box
        sx={(t) => ({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 1,
          [t.breakpoints.up('md')]: landing
            ? { flexDirection: 'row', alignItems: 'center', gap: 2.5 }
            : {},
        })}
      >
        {control}
        {stats && !empty ? (
          <OccupancySummary
            counts={stats.occupancy}
            sx={{ alignSelf: 'stretch', flex: landing ? 1 : undefined, ...dim(refreshing) }}
          />
        ) : null}
      </Box>
      {state.status === 'loading' ? <QuickStatsSkeleton landing={landing} /> : null}
      {state.status === 'error' ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={state.retry}>
              Retry
            </Button>
          }
        >
          Quick stats could not be loaded.
        </Alert>
      ) : null}
      {stats && empty ? (
        <Typography color="text.secondary">No stats for this period.</Typography>
      ) : null}
      {stats && !empty ? (
        <Box sx={dim(refreshing)}>
          <Sections stats={stats} landing={landing} />
        </Box>
      ) : null}
    </Box>
  );
}

/**
 * Quick Stats (Figma component set 78:3760): Day, Week and Month tabs, each with its own period
 * control (Date, Start Date, Month), an occupancy summary, revenue by rate category and either room
 * blocks (Day, Month) or occupancy by day (Week). The Week View is the default tab. Each tab keeps
 * its own period while you switch.
 */
export default function QuickStats({
  placement = 'dashboard',
  today: todayProp,
  weekStartsOn = 0,
}: QuickStatsProps) {
  // Frozen at mount: a dashboard left open past midnight keeps yesterday's defaults until reloaded.
  const [today] = useState(() => todayProp ?? todayIso());
  const id = useId();
  const [view, setView] = useState<QuickStatsView>(DEFAULT_VIEW);
  const [periods, setPeriods] = useState(() => defaultPeriods(today, weekStartsOn));
  const landing = placement === 'landing';
  const state = useQuickStats(view, periods[view]);
  const announcement =
    state.status === 'loading' || (state.status === 'success' && state.refreshing)
      ? 'Loading quick stats'
      : state.status === 'success' && isQuickStatsEmpty(state.data)
        ? 'No stats for this period.'
        : '';
  const tabId = (v: QuickStatsView) => `${id}-tab-${v}`;
  const panelId = (v: QuickStatsView) => `${id}-panel-${v}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Tabs
        value={view}
        onChange={(_, next: QuickStatsView) => setView(next)}
        aria-label="Quick Stats view"
        variant="scrollable"
        scrollButtons={false}
        // Figma tabs are 42px high (9px + 24px line + 9px); MUI's default minimum is 48px.
        sx={{
          minHeight: 0,
          '& .MuiTab-root': {
            minHeight: 0,
            py: 1.125,
            lineHeight: (t: Theme) => t.typography.button.lineHeight,
          },
        }}
      >
        {QUICK_STATS_VIEWS.map((v) => (
          <Tab key={v} value={v} label={VIEW_LABELS[v]} id={tabId(v)} aria-controls={panelId(v)} />
        ))}
      </Tabs>
      {/* Always mounted, so changes in its text are announced. */}
      <Box role="status" sx={visuallyHidden}>
        {announcement}
      </Box>
      {QUICK_STATS_VIEWS.map((v) => (
        <Box key={v} role="tabpanel" id={panelId(v)} aria-labelledby={tabId(v)} hidden={v !== view}>
          {v === view ? (
            <Panel
              view={v}
              period={periods[v]}
              onPeriodChange={(value) => setPeriods((p) => ({ ...p, [v]: value }))}
              today={today}
              landing={landing}
              state={state}
            />
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
