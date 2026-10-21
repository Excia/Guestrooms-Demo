import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { ADMIN_NAV } from '../../app/adminNav';
import { useAccess } from '../../app/useAccess';

export interface AdminShellProps {
  /** Label of the current left-navigation item. */
  active: string;
  /**
   * Pages whose left column is a list of their own items (Room Types, Rooms: Figma 11905:19464)
   * pass it here; it replaces the Admin Setup links inside the same navigation landmark.
   */
  sidebar?: ReactNode;
  /** Accessible name of the navigation landmark when `sidebar` is given. */
  sidebarLabel?: string;
  /** Page title (Figma "Section Header"). */
  title: string;
  /** The page's primary save button. */
  actions?: ReactNode;
  children: ReactNode;
}

// Admin Setup shell (Figma 11964:11725): left navigation, then a white panel with the page title,
// the primary save button and the content. Desktop-first: below 1200px (lg) the navigation stacks
// above the panel as a wrapping row (decision D-010).
export default function AdminShell({
  active,
  sidebar,
  sidebarLabel,
  title,
  actions,
  children,
}: AdminShellProps) {
  const { canAccessPage } = useAccess();
  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        [t.breakpoints.up('lg')]: { flexDirection: 'row', alignItems: 'stretch' },
        mx: { xs: 2, lg: 3 },
        my: 3,
        bgcolor: 'background.paper',
        minHeight: t.spacing(60),
      })}
    >
      <Box
        component="nav"
        aria-label={sidebar ? sidebarLabel : 'Admin Setup'}
        sx={(t) => ({
          flexShrink: 0,
          borderBottom: `1px solid ${t.palette.divider}`,
          p: 2,
          [t.breakpoints.up('lg')]: {
            width: t.spacing(30),
            borderBottom: 'none',
            borderRight: `1px solid ${t.palette.divider}`,
            pt: 1.25,
          },
        })}
      >
        {sidebar ?? (
          <Box
            component="ul"
            sx={(t) => ({
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              [t.breakpoints.up('lg')]: { flexDirection: 'column', flexWrap: 'nowrap', gap: 0 },
            })}
          >
            {ADMIN_NAV.map((item) => {
              const isActive = item.label === active;
              const available = item.path !== undefined && (!item.id || canAccessPage(item.id));
              return (
                <Box component="li" key={item.label} sx={{ display: 'flex' }}>
                  <Button
                    fullWidth
                    size="large"
                    variant={isActive ? 'contained' : 'text'}
                    color={isActive ? 'primary' : 'inherit'}
                    disabled={!available}
                    {...(available ? { component: RouterLink, to: item.path as string } : {})}
                    aria-current={isActive ? 'page' : undefined}
                    sx={(t) => ({
                      justifyContent: 'flex-start',
                      minHeight: t.spacing(7.375),
                      color: isActive ? undefined : 'text.secondary',
                      [t.breakpoints.up('lg')]: { minHeight: t.spacing(7.375) },
                    })}
                  >
                    {item.label}
                  </Button>
                  {isActive ? (
                    <Box
                      aria-hidden
                      sx={(t) => ({
                        display: { xs: 'none', lg: 'block' },
                        width: t.spacing(0.875),
                        bgcolor: 'primary.main',
                        borderRadius: `${t.spacing(0.25)} 0 0 ${t.spacing(0.25)}`,
                      })}
                    />
                  ) : null}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      <Box
        component="section"
        aria-labelledby="admin-page-title"
        sx={{ flex: 1, minWidth: 0, p: 2.5 }}
      >
        <Box
          sx={(t) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
            pb: 2,
            mb: 3.75,
            borderBottom: `1px solid ${t.palette.divider}`,
          })}
        >
          <Typography
            id="admin-page-title"
            variant="subtitle1"
            component="h1"
            sx={{ fontWeight: 'bold' }}
          >
            {title}
          </Typography>
          {actions}
        </Box>
        {children}
      </Box>
    </Box>
  );
}
