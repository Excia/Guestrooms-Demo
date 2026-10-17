import AccountBoxIcon from '@mui/icons-material/AccountBox';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BedroomChildIcon from '@mui/icons-material/BedroomChild';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import GridViewIcon from '@mui/icons-material/GridView';
import HourglassFullIcon from '@mui/icons-material/HourglassFull';
import MailIcon from '@mui/icons-material/Mail';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PieChartIcon from '@mui/icons-material/PieChart';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ShieldMoonIcon from '@mui/icons-material/ShieldMoon';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import ViewListIcon from '@mui/icons-material/ViewList';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import { alpha, type Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, type ElementType } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import { HEADER_HEIGHT } from '../app/layout';
import { buildMenu, type MenuItem } from '../app/menu';
import { usePermissions } from '../app/permissions';
import type { MenuRouteId } from '../app/routes';

export interface MenuOverlayProps {
  open: boolean;
  /** Scrim click, route change or a link choice. Escape is handled by the header. */
  onClose: () => void;
  /** Target of Return to Site (see getAxisUrl). */
  axisUrl: string;
  /** Id for the panel; pair with the header button's aria-controls. */
  id?: string;
}

// Typed by route id: adding a menu route without an icon fails typecheck.
const ICONS: Record<Exclude<MenuRouteId, 'dashboard'>, ElementType> = {
  schedule: CalendarTodayIcon,
  reservations: ViewListIcon,
  'open-folios': ReceiptLongIcon,
  waitlist: HourglassFullIcon,
  'night-audit-history': ShieldMoonIcon,
  'add-on-countdown': ShoppingBasketIcon,
  'room-blocks': GridViewIcon,
  'member-directory': AccountBoxIcon,
  reporting: PieChartIcon,
  'primary-setup': AutoFixHighIcon,
  'rate-categories': MonetizationOnIcon,
  'room-types': BedroomChildIcon,
  rooms: MeetingRoomIcon,
  'add-on-items': ShoppingBasketIcon,
  notifications: MailIcon,
};

// Figma 1302:18023 values in theme.spacing units (8px): rows 70px, top buttons 68px, column
// gap 68px, panel 800px (two columns) or 480px (one column).
const ROW_HEIGHT = 8.75;
const BUTTON_HEIGHT = 8.5;
const COLUMN_GAP = 8.5;
const PANEL_WIDTH = { two: 100, one: 60 };
// Scrim left visible below the panel so a click can always dismiss it, even on narrow screens.
const SCRIM_STRIP = 4;

const TABBABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isShown(el: HTMLElement) {
  return !el.closest('[hidden]') && getComputedStyle(el).display !== 'none';
}

interface ColumnProps {
  id: string;
  heading: string;
  items: MenuItem[];
  currentPath: string;
  onNavigate: () => void;
}

function MenuColumn({ id, heading, items, currentPath, onNavigate }: ColumnProps) {
  return (
    <div>
      <Typography
        id={id}
        variant="h6"
        component="h2"
        sx={{
          height: (t) => t.spacing(ROW_HEIGHT),
          px: 2,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {heading}
      </Typography>
      <List component="nav" aria-label={`${heading} pages`} disablePadding>
        {items.map((item) => {
          const Icon = ICONS[item.id as keyof typeof ICONS];
          const selected = currentPath === item.path;
          return (
            <ListItemButton
              key={item.id}
              component={RouterLink}
              to={item.path}
              onClick={onNavigate}
              selected={selected}
              aria-current={selected ? 'page' : undefined}
              sx={{
                height: (t) => t.spacing(ROW_HEIGHT),
                px: 2,
                gap: 1.75,
                borderBottom: 1,
                borderColor: 'divider',
                color: 'primary.main',
                '&:last-of-type': { borderBottom: 0 },
                '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'primary.tint' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}>
                <Icon aria-hidden sx={{ fontSize: (t: Theme) => t.spacing(4) }} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { variant: 'menu_item' } }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </div>
  );
}

/**
 * Non-modal overlay rendered inside the app shell, below the header. It deliberately does not use
 * MUI Modal: Modal portals to <body> and aria-hides the app root, which would hide the header's
 * close button from keyboard and screen-reader users. The shell marks <main> inert instead, focus
 * moves into the panel on open, Tab loops across header controls and panel, and the header
 * returns focus to the menu button on close.
 */
export default function MenuOverlay({
  open,
  onClose,
  axisUrl,
  id = 'main-menu',
}: MenuOverlayProps) {
  const { pathname } = useLocation();
  const menu = buildMenu(usePermissions());
  const twoColumns = menu.columns === 2;
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when the route changes while open (back/forward, links elsewhere).
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      if (open) onClose();
    }
  }, [pathname, open, onClose]);

  // Move focus into the panel on open and loop Tab across the header controls and the panel.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      // The app has a single banner landmark: the header.
      const scope = [
        ...(document.querySelector('header')?.querySelectorAll<HTMLElement>(TABBABLE) ?? []),
        ...panelRef.current.querySelectorAll<HTMLElement>(TABBABLE),
      ].filter(isShown);
      const first = scope[0];
      const last = scope[scope.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      const inScope = scope.includes(active as HTMLElement);
      if (e.shiftKey && (active === first || active === panelRef.current || !inScope)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inScope)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const hasTopRow = menu.dashboard !== null || menu.showReturnToSite;

  return (
    <Box
      data-testid="menu-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      sx={{
        position: 'fixed',
        top: (t) => t.spacing(HEADER_HEIGHT),
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 'drawer',
        // Same 50% black as MUI's Backdrop; set as a color, not opacity, so it never hides the panel.
        bgcolor: (t) => alpha(t.palette.common.black, 0.5),
      }}
    >
      <Paper
        ref={panelRef}
        id={id}
        role="dialog"
        aria-label="Menu"
        tabIndex={-1}
        elevation={1}
        square
        sx={{
          width: (t) => t.spacing(twoColumns ? PANEL_WIDTH.two : PANEL_WIDTH.one),
          maxWidth: '100%',
          maxHeight: (t) => `calc(100% - ${t.spacing(SCRIM_STRIP)})`,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          border: 1,
          borderColor: 'divider',
          outline: 0,
        }}
      >
        {hasTopRow ? (
          <Box
            sx={{
              display: 'grid',
              gap: 2.5,
              columnGap: { md: twoColumns ? COLUMN_GAP : 2.5 },
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            }}
          >
            {menu.dashboard ? (
              <Button
                component={RouterLink}
                to={menu.dashboard.path}
                onClick={onClose}
                aria-current={pathname === menu.dashboard.path ? 'page' : undefined}
                variant="contained"
                size="large"
                startIcon={<SpaceDashboardIcon />}
                sx={{
                  height: (t) => t.spacing(BUTTON_HEIGHT),
                  justifyContent: 'flex-start',
                  px: 2.75,
                }}
              >
                {menu.dashboard.label}
              </Button>
            ) : null}
            {menu.showReturnToSite ? (
              <Button
                href={axisUrl}
                size="large"
                startIcon={<ExitToAppIcon />}
                sx={{
                  height: (t) => t.spacing(BUTTON_HEIGHT),
                  justifyContent: 'flex-end',
                }}
              >
                Return to Site
              </Button>
            ) : null}
          </Box>
        ) : null}
        <Box
          sx={{
            display: 'grid',
            columnGap: COLUMN_GAP,
            gridTemplateColumns: { xs: '1fr', md: twoColumns ? '1fr 1fr' : '1fr' },
            alignItems: 'start',
          }}
        >
          {menu.reservation.length > 0 ? (
            <MenuColumn
              id={`${id}-reservation`}
              heading="Reservation Management"
              items={menu.reservation}
              currentPath={pathname}
              onNavigate={onClose}
            />
          ) : null}
          {menu.admin.length > 0 ? (
            <MenuColumn
              id={`${id}-admin`}
              heading="Admin Setup"
              items={menu.admin}
              currentPath={pathname}
              onNavigate={onClose}
            />
          ) : null}
        </Box>
      </Paper>
    </Box>
  );
}
