import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CloseIcon from '@mui/icons-material/Close';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router';
import type { Crumb } from '../app/breadcrumbs';
import { SCHEDULE_PATH } from '../app/routes';

export interface AppHeaderProps {
  breadcrumbs: Crumb[];
  menuOpen: boolean;
  /** Toggle button click. */
  onMenuToggle: () => void;
  /** Escape while open; separate from the toggle so the overlay (0.7) can own closing. */
  onMenuClose: () => void;
  /** Target of Return to Site (see getAxisUrl). */
  axisUrl: string;
  /** Id of the menu element this button controls (ticket 0.7). */
  menuId?: string;
}

// Header height in theme.spacing units (7 x 8px = 56px, Figma 12047:5668); the Toolbar's py: 1 sits inside it.
const HEADER_HEIGHT = 7;

const RETURN_LABEL = 'Return to Site';

export default function AppHeader({
  breadcrumbs,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  axisUrl,
  menuId,
}: AppHeaderProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // A nested popover/select/dialog that already handled Escape keeps the menu open.
      if (e.key === 'Escape' && !e.defaultPrevented) {
        onMenuClose();
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, onMenuClose]);

  const parents = breadcrumbs.slice(0, -1);
  const current = breadcrumbs.at(-1);

  return (
    <AppBar
      component="header"
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: 'background.default' }}
    >
      <Toolbar
        disableGutters
        sx={{
          px: 2,
          py: 1,
          gap: 2,
          // Doubled selector beats Toolbar's responsive min-height (48/56/64) so the header stays 56px.
          '&&': {
            height: (t) => t.spacing(HEADER_HEIGHT),
            minHeight: (t) => t.spacing(HEADER_HEIGHT),
          },
        }}
      >
        <IconButton
          ref={menuButtonRef}
          onClick={onMenuToggle}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          sx={{
            width: (t) => t.spacing(5),
            height: (t) => t.spacing(5),
            p: 0.5,
            bgcolor: menuOpen ? 'grey.600' : 'primary.main',
            color: menuOpen ? 'common.white' : 'primary.contrastText',
            '&:hover': { bgcolor: menuOpen ? 'grey.700' : 'primary.dark' },
          }}
        >
          {menuOpen ? <CloseIcon fontSize="large" /> : <MenuIcon fontSize="large" />}
        </IconButton>
        <Link
          component={RouterLink}
          to={SCHEDULE_PATH}
          underline="none"
          color="text.primary"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <Box
            sx={{
              width: (t) => t.spacing(4),
              height: (t) => t.spacing(4),
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <CalendarTodayIcon aria-hidden />
          </Box>
          <Typography variant="h4_fixed" component="span">
            Guest Rooms
          </Typography>
        </Link>
        {current && breadcrumbs.length > 1 && (
          <Breadcrumbs aria-label="Breadcrumb" sx={{ display: { xs: 'none', sm: 'block' }, ml: 2 }}>
            {parents.map((c) => (
              <Link
                key={c.path}
                component={RouterLink}
                to={c.path}
                underline="hover"
                color="inherit"
              >
                {c.title}
              </Link>
            ))}
            <Typography color="text.primary" aria-current="page">
              {current.title}
            </Typography>
          </Breadcrumbs>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button
          href={axisUrl}
          size="large"
          startIcon={<ExitToAppIcon />}
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          {RETURN_LABEL}
        </Button>
        <IconButton
          href={axisUrl}
          color="inherit"
          aria-label={RETURN_LABEL}
          sx={{
            display: { xs: 'inline-flex', sm: 'none' },
            color: 'action.active',
            p: 0.5,
          }}
        >
          <ExitToAppIcon fontSize="large" />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
