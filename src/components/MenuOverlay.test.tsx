import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, useNavigate } from 'react-router';
import App from '../App';
import { pagePermission } from '../app/menu';
import { createMockPermissions, PermissionsProvider, type Permission } from '../app/permissions';
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
    <PermissionsProvider value={createMockPermissions(granted)}>
      <MemoryRouter initialEntries={['/reservations']}>
        <MenuOverlay open onClose={onClose} axisUrl="https://axis.example.com" />
      </MemoryRouter>
    </PermissionsProvider>,
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
    renderOverlay(
      RESERVATION.length ? [pagePermission('schedule'), pagePermission('reporting')] : [],
    );
    expect(screen.queryByRole('heading', { name: 'Admin Setup' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to Site' })).toHaveAttribute(
      'href',
      'https://axis.example.com',
    );
    expect(screen.getByRole('link', { name: 'Reporting' })).toHaveAttribute('href', '/reporting');
    expect(screen.queryByRole('link', { name: 'Reservations' })).not.toBeInTheDocument();
  });

  it('marks the current page', () => {
    renderOverlay();
    expect(screen.getByRole('link', { name: 'Reservations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Waitlist' })).not.toHaveAttribute('aria-current');
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
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
    return userEvent.setup();
  }

  it('opens from the header button and closes on the close icon with focus on the button', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close menu', hidden: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });

  it('a single Escape closes once and returns focus to the menu button', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
    // A second Escape does nothing (no reopen, no throw).
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on backdrop click', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
    await user.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('choosing a link navigates and closes', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('link', { name: 'Rooms' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rooms' })).toBeInTheDocument();
  });

  it('the Dashboard button routes to the dashboard', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('keeps focus inside the dialog while open', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    for (let i = 0; i < 30; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
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
    // The modal hides siblings from the a11y tree; drive the navigation directly.
    await userEvent.click(screen.getByRole('button', { name: 'go', hidden: true }), {
      pointerEventsCheck: 0,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
