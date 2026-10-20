import AccountBoxIcon from '@mui/icons-material/AccountBox';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import GridViewIcon from '@mui/icons-material/GridView';
import HourglassFullIcon from '@mui/icons-material/HourglassFull';
import PieChartIcon from '@mui/icons-material/PieChart';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ShieldMoonIcon from '@mui/icons-material/ShieldMoon';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import ViewListIcon from '@mui/icons-material/ViewList';
import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useState, type ElementType } from 'react';
import { Link as RouterLink } from 'react-router';
import { usePermissions } from '../app/permissions';
import type { ReservationRouteId } from '../app/routes';
import {
  BADGE_MIN_SIZE_SPACING,
  BADGE_PADDING_X_SPACING,
  buildShortcuts,
  formatCount,
  shouldShowBadge,
  unassignedChargesLabel,
} from '../app/shortcuts';
import { useApi } from '../api/ApiProvider';

// Typed by route id: adding a reservation route without an icon fails typecheck.
const ICONS: Record<ReservationRouteId, ElementType> = {
  schedule: CalendarTodayIcon,
  reservations: ViewListIcon,
  'open-folios': ReceiptLongIcon,
  'unassigned-charges': WarningIcon,
  waitlist: HourglassFullIcon,
  'night-audit-history': ShieldMoonIcon,
  'add-on-countdown': ShoppingBasketIcon,
  'room-blocks': GridViewIcon,
  'member-directory': AccountBoxIcon,
  reporting: PieChartIcon,
};

/** Row height, theme.spacing units (10.5 x 8px = 84px, Figma 69:3790). */
const ROW_HEIGHT_SPACING = 10.5;

/**
 * Unassigned-charges count from the API client. The list never waits on it: while loading, on
 * error, or at zero the badge is simply absent (rows have a fixed height, so nothing shifts).
 */
function useUnassignedCount(): number | undefined {
  const api = useApi();
  const [count, setCount] = useState<number>();
  useEffect(() => {
    const controller = new AbortController();
    api.dashboard
      .getStats({ signal: controller.signal })
      .then((stats) => {
        if (!controller.signal.aborted) setCount(stats.unassignedChargesCount);
      })
      // A failed request keeps the last good count (or none); the links work regardless.
      .catch(() => undefined);
    return () => controller.abort();
  }, [api]);
  return count;
}

function CountBadge({ count }: { count: number }) {
  return (
    <>
      <Box
        component="span"
        aria-hidden
        sx={(t) => ({
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxSizing: 'border-box',
          height: t.spacing(BADGE_MIN_SIZE_SPACING),
          minWidth: t.spacing(BADGE_MIN_SIZE_SPACING),
          px: BADGE_PADDING_X_SPACING,
          borderRadius: t.spacing(BADGE_MIN_SIZE_SPACING / 2), // half the height: a pill
          bgcolor: 'warning.main',
          color: 'warning.contrastText',
          ...t.typography.caption,
        })}
      >
        {formatCount(count)}
      </Box>
      {/* One announcement: the visible number is hidden from assistive tech. */}
      <span style={visuallyHidden}>, {unassignedChargesLabel(count)}</span>
    </>
  );
}

/** Dashboard slot content for Reservation Management (Figma 69:3790). Render inside a `disablePadding` column. */
export default function ReservationManagement() {
  const { can } = usePermissions();
  const items = buildShortcuts({ can });
  const unassigned = useUnassignedCount();

  return (
    <List component="nav" aria-label="Reservation management" disablePadding>
      {items.map((item) => {
        const Icon = ICONS[item.id];
        return (
          <ListItemButton
            key={item.id}
            component={RouterLink}
            to={item.path}
            sx={(t) => ({
              height: t.spacing(ROW_HEIGHT_SPACING),
              px: 1.875, // 15px
              gap: 1.75, // 14px
              borderBottom: 1,
              borderColor: 'divider',
              color: 'primary.main',
              '&:last-of-type': { borderBottom: 0 },
              // Inset ring: the panel clips anything drawn outside the row.
              '&.Mui-focusVisible': { outlineOffset: -2 },
            })}
          >
            <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}>
              {/* Figma icon size 32px (no icon-size token in the theme). */}
              <Icon aria-hidden sx={{ fontSize: 32 }} />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{ primary: { variant: 'list_link' } }}
              sx={{ flex: '0 1 auto' }}
            />
            {item.id === 'unassigned-charges' && shouldShowBadge(unassigned) && (
              <CountBadge count={unassigned} />
            )}
          </ListItemButton>
        );
      })}
    </List>
  );
}
