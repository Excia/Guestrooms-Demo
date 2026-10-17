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
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router';
import type { Crumb } from '../app/breadcrumbs';
import { SCHEDULE_PATH } from '../app/routes';

export interface AppHeaderProps {
  breadcrumbs: Crumb[];
  menuOpen: boolean;
  onMenuToggle: () => void;
  /** Target of Return to Site (see getAxisUrl). */
  axisUrl: string;
  /** Id of the menu element this button controls (ticket 0.7). */
  menuId?: string;
}

const RETURN_LABEL = 'Return to Site';

export default function AppHeader({
  breadcrumbs,
  menuOpen,
  onMenuToggle,
  axisUrl,
  menuId,
}: AppHeaderProps) {
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMenuToggle();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, onMenuToggle]);

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
      <Toolbar disableGutters sx={{ minHeight: 56, px: 2, py: 1, gap: 2 }}>
        <IconButton
          onClick={onMenuToggle}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          sx={{
            width: 40,
            height: 40,
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
          <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center' }}>
            <CalendarTodayIcon aria-hidden />
          </Box>
          <Typography variant="h4_fixed" component="span">
            Guest Rooms
          </Typography>
        </Link>
        {current && breadcrumbs.length > 1 && (
          <Breadcrumbs aria-label="Breadcrumb" sx={{ display: { xs: 'none', sm: 'block' }, ml: 2 }}>
            {parents.map((c) => (
              <Link key={c.path} component={RouterLink} to={c.path} underline="hover" color="inherit">
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
          sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: 'action.active' }}
        >
          <ExitToAppIcon fontSize="large" />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
