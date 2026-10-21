import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CloseIcon from '@mui/icons-material/Close';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import MenuIcon from '@mui/icons-material/Menu';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonIcon from '@mui/icons-material/Person';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useId, useState, type MouseEvent } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import { HEADER_HEIGHT } from '../../app/layout';
import {
  accountMenuLinks,
  buildBreadcrumbs,
  isEmbeddedInApp,
  returnToSiteTooltip,
  type BookingAudience,
  type BookingTenant,
  type Crumb,
} from '../../app/onlineBookingNav';

export interface OnlineBookingHeaderProps {
  tenant: BookingTenant;
  /** Who is signed in; null when signed out. */
  audience: BookingAudience | null;
  /** Pages before the current one; only entries with a `to` are shown, as links. */
  trail?: Crumb[];
  currentPage: string;
  /** Landing/results page with the default search parameters (title link and Make a Reservation). */
  homePath: string;
  myReservationsPath: string;
  /** Opens the sign-in prompt (ticket 5.10); `returnTo` is where to land once signed in. */
  onSignIn: (returnTo?: string) => void;
  /** Ends the session; the caller returns to the unauthenticated results view. */
  onSignOut: () => void;
}

const RETURN_LABEL = 'Return to Site';
const NAV_MENU_ID = 'ob-nav-menu';

export default function OnlineBookingHeader({
  tenant,
  audience,
  trail = [],
  currentPage,
  homePath,
  myReservationsPath,
  onSignIn,
  onSignOut,
}: OnlineBookingHeaderProps) {
  const { search } = useLocation();
  const accountMenuId = useId();
  const [navAnchor, setNavAnchor] = useState<HTMLElement | null>(null);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);

  // The mobile app has its own navigation, so this one is not drawn at all.
  if (isEmbeddedInApp(search)) return null;

  const crumbs = buildBreadcrumbs(trail, currentPage);
  const signedIn = audience !== null;
  const closeNav = () => setNavAnchor(null);

  const onMyReservations = (e: MouseEvent<HTMLElement>) => {
    closeNav();
    if (!signedIn) {
      // Sign in first, then land on My Reservations.
      e.preventDefault();
      onSignIn(myReservationsPath);
    }
  };

  const navItemSx = {
    height: 70,
    px: 2,
    gap: 1.75,
    color: 'primary.main',
    typography: 'menu_item',
  };

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
          '&&': {
            height: (t) => t.spacing(HEADER_HEIGHT),
            minHeight: (t) => t.spacing(HEADER_HEIGHT),
          },
        }}
      >
        <IconButton
          onClick={(e) => setNavAnchor(navAnchor ? null : e.currentTarget)}
          aria-label={navAnchor ? 'Close menu' : 'Open menu'}
          aria-haspopup="menu"
          aria-expanded={navAnchor ? true : undefined}
          aria-controls={navAnchor ? NAV_MENU_ID : undefined}
          sx={{
            width: (t) => t.spacing(5),
            height: (t) => t.spacing(5),
            p: 0.5,
            bgcolor: navAnchor ? 'grey.600' : 'primary.main',
            color: navAnchor ? 'common.white' : 'primary.contrastText',
            '&:hover': { bgcolor: navAnchor ? 'grey.700' : 'primary.dark' },
          }}
        >
          {navAnchor ? <CloseIcon fontSize="large" /> : <MenuIcon fontSize="large" />}
        </IconButton>
        <Menu
          id={NAV_MENU_ID}
          anchorEl={navAnchor}
          open={Boolean(navAnchor)}
          onClose={closeNav}
          slotProps={{
            paper: { sx: { width: 337, mt: 1 } },
            list: { 'aria-label': 'Online booking' },
          }}
        >
          <MenuItem component={RouterLink} to={homePath} onClick={closeNav} sx={navItemSx}>
            <ListItemIcon sx={{ color: 'inherit', minWidth: 0 }}>
              <CalendarTodayIcon fontSize="large" />
            </ListItemIcon>
            Make a Reservation
          </MenuItem>
          <MenuItem
            component={RouterLink}
            to={myReservationsPath}
            onClick={onMyReservations}
            sx={navItemSx}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 0 }}>
              <EventAvailableIcon fontSize="large" />
            </ListItemIcon>
            My Reservations
          </MenuItem>
        </Menu>

        <Box component="nav" aria-label="Breadcrumb" sx={{ minWidth: 0, flexGrow: 1 }}>
          <Box
            component="ol"
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, m: 0, p: 0, listStyle: 'none' }}
          >
            <Box component="li" sx={{ display: 'flex', minWidth: 0 }}>
              <Link
                component={RouterLink}
                to={homePath}
                underline="none"
                color="text.primary"
                aria-label={`${tenant.clubName} Guest Rooms`}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <Avatar
                  src={tenant.faviconUrl}
                  alt=""
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'transparent',
                    color: 'text.primary',
                    fontSize: '1rem',
                  }}
                >
                  {tenant.clubName.charAt(0)}
                </Avatar>
                <Typography
                  variant="h4_fixed"
                  component="span"
                  sx={{ display: { xs: 'none', md: 'inline' }, whiteSpace: 'nowrap' }}
                >
                  {tenant.clubName} Guest Rooms
                </Typography>
              </Link>
            </Box>
            {crumbs.map((crumb, i) => {
              const current = i === crumbs.length - 1;
              return (
                <Box
                  component="li"
                  key={`${crumb.label}-${i}`}
                  // Below md only the current page shows (truncated mobile header).
                  sx={{
                    display: { xs: current ? 'flex' : 'none', md: 'flex' },
                    alignItems: 'center',
                    alignSelf: 'stretch',
                    gap: 1.5,
                    minWidth: 0,
                  }}
                >
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{ display: { xs: 'none', md: 'block' } }}
                  />
                  {crumb.to ? (
                    <Link
                      component={RouterLink}
                      to={crumb.to}
                      underline="hover"
                      color="primary.main"
                      noWrap
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <Typography
                      component="span"
                      aria-current="page"
                      noWrap
                      sx={{ typography: { xs: 'body2', md: 'body1' } }}
                    >
                      {crumb.label}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        {signedIn ? (
          <>
            <Button
              color="info"
              size="large"
              aria-label="Account"
              aria-haspopup="menu"
              aria-expanded={accountAnchor ? true : undefined}
              aria-controls={accountAnchor ? accountMenuId : undefined}
              onClick={(e) => setAccountAnchor(e.currentTarget)}
              startIcon={<AccountCircleIcon />}
              sx={accountButtonSx}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Account
              </Box>
            </Button>
            <Menu
              id={accountMenuId}
              anchorEl={accountAnchor}
              open={Boolean(accountAnchor)}
              onClose={() => setAccountAnchor(null)}
              slotProps={{ list: { 'aria-label': 'Account' } }}
            >
              {accountMenuLinks(audience, tenant).map((link) => (
                <MenuItem
                  key={link.id}
                  component="a"
                  href={link.href}
                  onClick={() => setAccountAnchor(null)}
                  sx={{ color: 'info.dark' }}
                >
                  <ListItemIcon sx={{ color: 'inherit' }}>
                    {link.id === 'account' ? <PersonIcon /> : <CreditCardIcon />}
                  </ListItemIcon>
                  {link.label}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem
                onClick={() => {
                  setAccountAnchor(null);
                  onSignOut();
                }}
                sx={{
                  justifyContent: 'center',
                  mx: 1.5,
                  mt: 1,
                  mb: 0.5,
                  borderRadius: 1,
                  bgcolor: 'info.dark',
                  color: 'info.contrastText',
                  textTransform: 'uppercase',
                  typography: 'button',
                  '&:hover, &.Mui-focusVisible': { bgcolor: 'info.main' },
                }}
              >
                Sign Out
              </MenuItem>
            </Menu>
          </>
        ) : (
          <Button
            color="info"
            size="large"
            aria-label="Sign In"
            onClick={() => onSignIn()}
            startIcon={<AccountCircleOutlinedIcon />}
            sx={accountButtonSx}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Sign In
            </Box>
          </Button>
        )}

        <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
        {/* describeChild keeps the accessible name "Return to Site"; the tooltip is the description. */}
        <Tooltip title={returnToSiteTooltip(tenant.clubName)} describeChild>
          <IconButton
            href={tenant.axisUrl}
            aria-label={RETURN_LABEL}
            sx={{ color: 'primary.main', p: 0.5 }}
          >
            <OpenInNewIcon fontSize="large" />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}

// Below sm only the icon shows (the label is in aria-label).
const accountButtonSx = {
  flexShrink: 0,
  minWidth: 0,
  '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 }, ml: { xs: 0, sm: -0.5 } },
  px: { xs: 0.5, sm: 1.375 },
} as const;
