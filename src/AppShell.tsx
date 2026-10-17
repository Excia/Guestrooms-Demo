import { useCallback, useState } from 'react';
import { useLocation } from 'react-router';
import { getAxisUrl } from './app/axisUrl';
import { getBreadcrumbs } from './app/breadcrumbs';
import { routes } from './app/routes';
import AppHeader from './components/AppHeader';

// The menu overlay is ticket 0.7; until then the shell only owns the open/closed state.
export default function AppShell({ children }: { children?: React.ReactNode }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = useCallback(() => setMenuOpen((open) => !open), []);
  return (
    <>
      <AppHeader
        breadcrumbs={getBreadcrumbs(pathname, routes)}
        menuOpen={menuOpen}
        onMenuToggle={toggle}
        axisUrl={getAxisUrl()}
      />
      <main>{children}</main>
    </>
  );
}
