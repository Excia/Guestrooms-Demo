import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { useState } from 'react';
import { MemoryRouter, useNavigate } from 'react-router';
import { renderWithApi } from '../api/testing';
import App from '../App';
import {
  createMockPermissions,
  pagePermission,
  PermissionsProvider,
  type Permission,
} from '../app/permissions';
import { theme } from '../theme';
import AppHeader from './AppHeader';
import MenuOverlay from './MenuOverlay';

const RESERVATION = [
  'Schedule | Home',
  'Reservations',
  'Open Folios',
  'Waitlist',
  'Night Audit History',
  'Add-On Countdown',
  'Room Blocks',
  'Member Directory',
  'Reporting',
];
const ADMIN = [
  'Primary Setup',
  'Rate Categories',
  'Room Types',
  'Rooms',
  'Add-On Items',
  'Notifications',
];

function renderOverlay(granted?: Permission[], onClose = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <PermissionsProvider value={createMockPermissions(granted)}>
        <MemoryRouter initialEntries={['/reservations']}>
          <MenuOverlay open onClose={onClose} axisUrl="https://axis.example.com" />
        </MemoryRouter>
      </PermissionsProvider>
    </ThemeProvider>,
  );
  return { onClose };
}

describe('MenuOverlay layouts', () => {
  it('admin: two columns, Dashboard button, no Return to Site', () => {
    renderOverlay();
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(dialog).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('heading', { name: 'Reservation Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Admin Setup' })).toBeInTheDocument();
    for (const label of [...RESERVATION, ...ADMIN]) {
      expect(within(dialog).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Return to Site' })).not.toBeInTheDocument();
  });

  it('partial admin: Admin Setup column with only the allowed pages', () => {
    renderOverlay([pagePermission('schedule'), pagePermission('rooms')]);
    expect(screen.getByRole('heading', { name: 'Admin Setup' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rooms' })).toHaveAttribute('href', '/admin/rooms');
    expect(screen.queryByRole('link', { name: 'Rate Categories' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Return to Site' })).not.toBeInTheDocument();
  });

  it('non-admin: one column, Return to Site, no Admin Setup', () => {
    renderOverlay([
      pagePermission('dashboard'),
      pagePermission('schedule'),
      pagePermission('reporting'),
    ]);
    expect(screen.queryByRole('heading', { name: 'Admin Setup' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to Site' })).toHaveAttribute(
      'href',
      'https://axis.example.com',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reporting' })).toHaveAttribute('href', '/reporting');
    expect(screen.queryByRole('link', { name: 'Reservations' })).not.toBeInTheDocument();
  });

  it('hides the Dashboard button without page.dashboard', () => {
    renderOverlay([pagePermission('schedule')]);
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Schedule | Home' })).toBeInTheDocument();
  });

  it('all denied: only Return to Site, no empty column headings', () => {
    renderOverlay([]);
    expect(screen.getByRole('link', { name: 'Return to Site' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('marks the current page and labels each nav distinctly', () => {
    renderOverlay();
    expect(screen.getByRole('link', { name: 'Reservations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Waitlist' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('navigation', { name: 'Reservation Management pages' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Admin Setup pages' })).toBeVisible();
  });

  it('renders nothing when closed', () => {
    render(
      <MemoryRouter>
        <MenuOverlay open={false} onClose={vi.fn()} axisUrl="x" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('MenuOverlay closing (in the app shell)', () => {
  function setup(path = '/reservations') {
    // The Dashboard page fetches Quick Stats, so the app needs an API.
    renderWithApi(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>,
    );
    return userEvent.setup();
  }

  it('keeps the header operable while open and closes on the X, focus on the button', async () => {
    const user = setup();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).not.toHaveAttribute('aria-controls');
    await user.click(toggle);
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    // No `hidden: true`: the header stays in the accessibility tree.
    const close = screen.getByRole('button', { name: 'Close menu' });
    expect(close).toHaveAttribute('aria-expanded', 'true');
    expect(close).toHaveAttribute('aria-controls', 'main-menu');
    expect(document.getElementById('main-menu')).toBeInTheDocument();
    await user.click(close);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });

  it('moves focus into the panel on open and Tab loops to the X', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(dialog).toHaveFocus();
    const close = screen.getByRole('button', { name: 'Close menu' });
    let reached = false;
    for (let i = 0; i < 40; i++) {
      await user.tab();
      if (document.activeElement === close) {
        reached = true;
        break;
      }
      const a = document.activeElement as HTMLElement;
      expect(dialog.contains(a) || screen.getByRole('banner').contains(a)).toBe(true);
    }
    expect(reached).toBe(true);
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Tab right after opening enters the panel at its first link', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.tab();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus();
  });

  it('Tab after clicking blank panel space continues into the panel', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('heading', { name: 'Admin Setup' }));
    await user.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Close menu' }));
  });

  it('wraps Tab from the last panel link to the first header control, and back', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const links = within(screen.getByRole('dialog')).getAllByRole('link');
    links[links.length - 1].focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(links[links.length - 1]).toHaveFocus();
  });

  it('pulls focus into the scope when it starts outside', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    (document.activeElement as HTMLElement).blur();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
    (document.activeElement as HTMLElement).blur();
    await user.tab({ shift: true });
    const links = within(screen.getByRole('dialog')).getAllByRole('link');
    expect(links[links.length - 1]).toHaveFocus();
  });

  it('makes main and the skip link inert only while open', async () => {
    const user = setup();
    const main = screen.getByRole('main');
    expect(main).not.toHaveAttribute('inert');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(main).toHaveAttribute('inert');
    expect(screen.getByText('Skip to content')).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(main).not.toHaveAttribute('inert');
    expect(screen.getByText('Skip to content')).not.toHaveAttribute('inert');
  });

  it('a modified click on a link does not close the menu', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: 'Waitlist' }));
    await user.keyboard('{/Control}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on a scrim click but not on a click inside the panel', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('heading', { name: 'Admin Setup' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('menu-scrim'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });

  it('Escape closes and returns focus to the menu button', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });

  it('choosing a link navigates, closes and returns focus to the button', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('link', { name: 'Rooms' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rooms' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });

  it('the logo closes the menu on /schedule, but not on a modified click', async () => {
    const user = setup('/schedule');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: 'Guest Rooms' }));
    await user.keyboard('{/Control}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Guest Rooms' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });

  it('the Dashboard button routes to the dashboard', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('marks the Dashboard button as current on the dashboard route', async () => {
    const user = setup('/dashboard');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('Escape with header and overlay together', () => {
  it('one Escape calls onClose exactly once and focuses the menu button', async () => {
    const onClose = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <AppHeader
            menuOpen={open}
            onMenuToggle={() => setOpen((o) => !o)}
            onMenuClose={() => {
              onClose();
              setOpen(false);
            }}
            axisUrl="x"
            menuId="main-menu"
          />
          <MenuOverlay
            open={open}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            axisUrl="x"
          />
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <Harness />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });
});

describe('MenuOverlay route change', () => {
  it('closes when the location changes while open', async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate('/waitlist')}>go</button>
          <MenuOverlay open={open} onClose={() => setOpen(false)} axisUrl="x" />
        </>
      );
    }
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
