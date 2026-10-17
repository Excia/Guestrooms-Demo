import Link from '@mui/material/Link';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router';
import { getAxisUrl } from './app/axisUrl';
import { getBreadcrumbs } from './app/breadcrumbs';
import { routes } from './app/routes';
import AppHeader from './components/AppHeader';

const axisUrl = getAxisUrl();
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
          left: (t) => t.spacing(1),
          top: (t) => `calc(-1 * ${t.spacing(12)})`,
          zIndex: 'tooltip',
          bgcolor: 'background.paper',
          p: 1,
          '&:focus': { top: (t) => t.spacing(1) },
        }}
      >
        Skip to content
      </Link>
      <AppHeader
        breadcrumbs={getBreadcrumbs(pathname, routes)}
        menuOpen={menuOpen}
        onMenuToggle={toggle}
        onMenuClose={close}
        axisUrl={axisUrl}
      />
      <main id={MAIN_ID} tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
