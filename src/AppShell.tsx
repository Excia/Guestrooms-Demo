import Link from '@mui/material/Link';
import { useCallback, useState } from 'react';
import { getAxisUrl } from './app/axisUrl';
import AppHeader from './components/AppHeader';
import MenuOverlay from './components/MenuOverlay';

const axisUrl = getAxisUrl();
const MAIN_ID = 'main-content';

const MENU_ID = 'main-menu';

export default function AppShell({ children }: { children?: React.ReactNode }) {
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
        menuOpen={menuOpen}
        onMenuToggle={toggle}
        onMenuClose={close}
        axisUrl={axisUrl}
        menuId={MENU_ID}
      />
      <MenuOverlay open={menuOpen} onClose={close} axisUrl={axisUrl} id={MENU_ID} />
      <main id={MAIN_ID} tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
