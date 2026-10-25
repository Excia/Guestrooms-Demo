import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import type { ChangeLogPageId } from '../../api/changeLogTypes';
import { ADMIN_NAV } from '../../app/adminNav';
import { HEADER_HEIGHT } from '../../app/layout';
import { useAccess } from '../../app/useAccess';
import ChangeLogButton from './changeLog/ChangeLogButton';

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
  /** Adds the Change Log button, which opens the overlay for this page (ticket 7.10). */
  changeLog?: ChangeLogPageId;
  children: ReactNode;
}

// Admin Setup shell (Figma 11964:11725): left navigation, then a white panel with the page title,
// the primary save button and the content. Desktop-first: below 1200px (lg) the navigation stacks
// above the panel as a wrapping row and the page scrolls normally (decisions D-010, D-AP-4).
// From lg up the shell fills the viewport below the app bar and the document never scrolls: the
// navigation column and the page header stay put, and only the content body scrolls (D-AP-4).
export default function AdminShell({
  active,
  sidebar,
  sidebarLabel,
  title,
  actions,
  changeLog,
  children,
}: AdminShellProps) {
  const { canAccessPage } = useAccess();
  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        mx: { xs: 2, lg: 3 },
        my: 3,
        bgcolor: 'background.paper',
        minHeight: t.spacing(60),
        // One lg block only: a second object key with the same breakpoint overwrites the first
        // (that dropped the row layout and collapsed the content column to zero height).
        [t.breakpoints.up('lg')]: {
          flexDirection: 'row',
          alignItems: 'stretch',
          // Viewport minus the sticky app bar and the shell's own vertical margins (my: 3, twice).
          height: `calc(100dvh - ${t.spacing(HEADER_HEIGHT)} - ${t.spacing(6)})`,
          minHeight: 0,
          overflow: 'hidden',
        },
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
            // The active bar sits against the panel edge (legacy SideBarControl), so no right padding.
            pr: 0,
            // A long list (or a short window) scrolls inside the column, never the page.
            overflowY: 'auto',
            overscrollBehavior: 'contain',
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
                <Box component="li" key={item.label} sx={{ display: 'flex', position: 'relative' }}>
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
                      // 15px gap between the tab and the bar (legacy: the tab's margin-right).
                      [t.breakpoints.up('lg')]: {
                        minHeight: t.spacing(7.375),
                        mr: t.spacing(1.875),
                      },
                    })}
                  >
                    {item.label}
                  </Button>
                  {isActive ? (
                    <Box
                      aria-hidden
                      data-testid="admin-nav-active-bar"
                      sx={(t) => ({
                        display: { xs: 'none', lg: 'block' },
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        height: '100%',
                        width: t.spacing(0.625),
                        bgcolor: 'primary.main',
                        borderRadius: `${t.spacing(0.5)} 0 0 ${t.spacing(0.5)}`,
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
        sx={(t) => ({
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          [t.breakpoints.up('lg')]: { minHeight: 0 },
        })}
      >
        <Box data-testid="admin-header" sx={{ flexShrink: 0, px: 2.5, pt: 2.5 }}>
          <Box
            sx={(t) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
              pb: 2,
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
            {changeLog || actions ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {changeLog ? <ChangeLogButton page={changeLog} /> : null}
                {actions}
              </Box>
            ) : null}
          </Box>
        </Box>
        {/* The only scrolling area from lg up. Focusable so keyboard users can scroll it even when
            the content has nothing focusable (loading, error). The header sits outside it, so it can
            never cover a focused field; scroll-padding keeps that field off the container's edge. */}
        <Box
          role="region"
          aria-label="Page content"
          tabIndex={0}
          data-testid="admin-scroll"
          sx={(t) => ({
            flex: 1,
            minWidth: 0,
            px: 2.5,
            pt: 3.75,
            pb: 2.5,
            // The positioning context for absolutely placed children (visually hidden live regions,
            // popper anchors): without it they escape the overflow clip and stretch the document.
            position: 'relative',
            // Inset ring: the overflow clip would cut an outer one.
            '&:focus-visible': {
              outline: `2px solid ${t.palette.primary.main}`,
              outlineOffset: -2,
            },
            [t.breakpoints.up('lg')]: {
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'auto',
              overscrollBehavior: 'contain',
              scrollPaddingBlock: t.spacing(2),
            },
          })}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
