import Link from '@mui/material/Link';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router';
import { getAxisUrl } from './app/axisUrl';
import { getBreadcrumbs } from './app/breadcrumbs';
import { routes } from './app/routes';
import AppHeader from './components/AppHeader';

const MAIN_ID = 'main-content';

// The menu overlay is ticket 0.7; until then the shell only owns the open/closed state.
export default function AppShell({ children }: { children?: React.ReactNode }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = useCallback(() => setMenuOpen((open) => !open), []);
  const close = useCallback(() => setMenuOpen(false), []);
  return (
    <>
      <Link
        href={`#${MAIN_ID}`}
        sx={{
          position: 'absolute',
          left: 8,
          top: -100,
          zIndex: 'tooltip',
          bgcolor: 'background.paper',
          p: 1,
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Link>
      <AppHeader
        breadcrumbs={getBreadcrumbs(pathname, routes)}
        menuOpen={menuOpen}
        onMenuToggle={toggle}
        onMenuClose={close}
        axisUrl={getAxisUrl()}
      />
      <main id={MAIN_ID} tabIndex={-1} aria-label="Guest Rooms content">
        {children}
      </main>
    </>
  );
}
