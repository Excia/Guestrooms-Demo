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
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, type ElementType } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import { getTabbables, isPlainLeftClick, nextFocusTarget } from '../app/focusLoop';
import { HEADER_HEIGHT, HEADER_ID, menuFontPx, menuPx } from '../app/layout';
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

// Figma 1302:18023 values (px), scaled by MENU_SCALE: rows 70, top buttons 68, column gap 68,
// panel 800 (two columns) or 480 (one column), padding 32, row padding 15, icon 32, icon gap 14.
const px = (figmaPx: number) => `${menuPx(figmaPx)}px`;
const ROW_HEIGHT = px(70);
const BUTTON_HEIGHT = px(68);
const COLUMN_GAP = px(68);
const PANEL_PADDING = px(32);
const SECTION_GAP = px(20);
const ROW_PADDING_X = px(15);
const ICON_GAP = px(14);
const PANEL_WIDTH = { two: px(800), one: px(480) };
// Scrim left visible below the panel so a click can always dismiss it, even on narrow screens.
const SCRIM_STRIP = 4;

interface ColumnProps {
  heading: string;
  items: MenuItem[];
  currentPath: string;
  onNavigate: () => void;
}

function MenuColumn({ heading, items, currentPath, onNavigate }: ColumnProps) {
  return (
    <div>
      <Typography
        variant="menu_heading"
        component="h2"
        sx={{
          height: ROW_HEIGHT,
          px: ROW_PADDING_X,
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
              onClick={(e) => {
                if (isPlainLeftClick(e)) onNavigate();
              }}
              selected={selected}
              aria-current={selected ? 'page' : undefined}
              sx={{
                height: ROW_HEIGHT,
                px: ROW_PADDING_X,
                gap: ICON_GAP,
                borderBottom: 1,
                borderColor: 'divider',
                color: 'primary.main',
                '&:last-of-type': { borderBottom: 0 },
                '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'primary.tint' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}>
                <Icon aria-hidden sx={{ fontSize: px(32) }} />
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
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const scope = getTabbables([document.getElementById(HEADER_ID), panel]);
      const target = nextFocusTarget(scope, panel, document.activeElement, e.shiftKey);
      if (target) {
        e.preventDefault();
        target.focus();
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
          width: twoColumns ? PANEL_WIDTH.two : PANEL_WIDTH.one,
          // Never wider than 60% of the window on mid-size screens; full width when stacked.
          maxWidth: { xs: '100%', md: '60vw' },
          maxHeight: (t) => `calc(100% - ${t.spacing(SCRIM_STRIP)})`,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          p: PANEL_PADDING,
          display: 'flex',
          flexDirection: 'column',
          gap: SECTION_GAP,
          border: 1,
          borderColor: 'divider',
          outline: 0,
        }}
      >
        {hasTopRow ? (
          <Box
            sx={{
              display: 'grid',
              gap: SECTION_GAP,
              columnGap: { md: twoColumns ? COLUMN_GAP : 2.5 },
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            }}
          >
            {menu.dashboard ? (
              <Button
                component={RouterLink}
                to={menu.dashboard.path}
                onClick={(e) => {
                  if (isPlainLeftClick(e)) onClose();
                }}
                aria-current={pathname === menu.dashboard.path ? 'page' : undefined}
                variant="contained"
                size="large"
                startIcon={<SpaceDashboardIcon />}
                sx={{
                  height: BUTTON_HEIGHT,
                  justifyContent: 'flex-start',
                  px: px(22),
                  fontSize: `${menuFontPx(15)}px`,
                  '& .MuiButton-startIcon > *:nth-of-type(1)': { fontSize: px(22) },
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
                  height: BUTTON_HEIGHT,
                  fontSize: `${menuFontPx(15)}px`,
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
              heading="Reservation Management"
              items={menu.reservation}
              currentPath={pathname}
              onNavigate={onClose}
            />
          ) : null}
          {menu.admin.length > 0 ? (
            <MenuColumn
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
