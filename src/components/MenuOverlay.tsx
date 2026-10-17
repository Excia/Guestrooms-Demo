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
import Modal from '@mui/material/Modal';
import Paper from '@mui/material/Paper';
import type { Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, type ElementType } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import { buildMenu, type MenuItem } from '../app/menu';
import { usePermissions } from '../app/permissions';
import { DASHBOARD_PATH } from '../app/routes';

export interface MenuOverlayProps {
  open: boolean;
  /** Backdrop click, Escape, route change or a link choice. */
  onClose: () => void;
  /** Target of Return to Site (see getAxisUrl). */
  axisUrl: string;
  /** Id for the dialog; pair with the header button's aria-controls. */
  id?: string;
  /** Header height in theme.spacing units; the overlay starts below it. */
  headerHeight?: number;
}

const ICONS: Record<string, ElementType> = {
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

// Figma 1302:18023: rows are 70px (8.75 x 8px); the top buttons are 68px.
const ROW_HEIGHT = 8.75;
const BUTTON_HEIGHT = 8.5;

interface ColumnProps {
  id: string;
  heading: string;
  items: MenuItem[];
  currentPath: string;
  onNavigate: () => void;
}

function MenuColumn({ id, heading, items, currentPath, onNavigate }: ColumnProps) {
  return (
    <Box component="section" aria-labelledby={id}>
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
      <List component="nav" aria-labelledby={id} disablePadding>
        {items.map((item) => {
          const Icon = ICONS[item.id];
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
                {Icon ? <Icon aria-hidden sx={{ fontSize: (t: Theme) => t.spacing(4) }} /> : null}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    sx: { fontSize: (t: Theme) => t.typography.pxToRem(22), fontWeight: 500 },
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}

export default function MenuOverlay({
  open,
  onClose,
  axisUrl,
  id = 'main-menu',
  headerHeight = 7,
}: MenuOverlayProps) {
  const { pathname } = useLocation();
  const menu = buildMenu(usePermissions());
  const twoColumns = menu.columns === 2;

  // Close when the route changes while open (back/forward, links elsewhere).
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      if (open) onClose();
    }
  }, [pathname, open, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      // Escape inside the dialog: Modal handles it and stops propagation, so the header's document
      // listener does not also fire. Escape with focus elsewhere is the header's job. Either way
      // the menu closes once and focus is restored to the menu button.
      sx={{ top: (t) => t.spacing(headerHeight) }}
      slotProps={{ backdrop: { sx: { bgcolor: 'common.black', opacity: 0.32 } } }}
    >
      <Paper
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        elevation={1}
        square
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: (t) => (twoColumns ? t.spacing(100) : t.spacing(60)),
          maxWidth: '100%',
          maxHeight: '100%',
          overflowY: 'auto',
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          border: 1,
          borderColor: 'divider',
          outline: 0,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            columnGap: { md: twoColumns ? 8.5 : 2.5 },
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          }}
        >
          <Button
            component={RouterLink}
            to={DASHBOARD_PATH}
            onClick={onClose}
            variant="contained"
            size="large"
            startIcon={<SpaceDashboardIcon />}
            sx={{ height: (t) => t.spacing(BUTTON_HEIGHT), justifyContent: 'flex-start', px: 2.75 }}
          >
            Dashboard
          </Button>
          {menu.showReturnToSite ? (
            <Button
              href={axisUrl}
              size="large"
              startIcon={<ExitToAppIcon />}
              sx={{ height: (t) => t.spacing(BUTTON_HEIGHT), justifyContent: 'flex-end' }}
            >
              Return to Site
            </Button>
          ) : null}
        </Box>
        <Box
          sx={{
            display: 'grid',
            columnGap: 8.5,
            gridTemplateColumns: { xs: '1fr', md: twoColumns ? '1fr 1fr' : '1fr' },
            alignItems: 'start',
          }}
        >
          <MenuColumn
            id={`${id}-reservation`}
            heading="Reservation Management"
            items={menu.reservation}
            currentPath={pathname}
            onNavigate={onClose}
          />
          {twoColumns ? (
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
    </Modal>
  );
}
