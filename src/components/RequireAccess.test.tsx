import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, useLocation } from 'react-router';
import App from '../App';
import { ApiProvider, MOCK_USERS, type MockUserId } from '../api';
import { createMockClient, type MockOptions } from '../api/mock';
import { AccessProvider } from '../app/AccessProvider';
import { theme } from '../theme';

function Where() {
  const { pathname, state } = useLocation();
  return <output data-testid="where">{pathname + (state ? ' +state' : '')}</output>;
}

function renderAt(path: string, options: MockOptions = {}) {
  render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={createMockClient(options)}>
        <AccessProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
            <Where />
          </MemoryRouter>
        </AccessProvider>
      </ApiProvider>
    </ThemeProvider>,
  );
  return userEvent.setup();
}

const grantOf = (id: MockUserId) => MOCK_USERS.find((u) => u.id === id)!.grant;
const where = () => screen.getByTestId('where');

describe('route guard', () => {
  it('lets an administrator open an Admin Setup page', async () => {
    renderAt('/admin/rooms', { grant: grantOf('admin') });
    expect(await screen.findByRole('heading', { name: 'Rooms' })).toBeInTheDocument();
    expect(where()).toHaveTextContent('/admin/rooms');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits while the grant loads, without redirecting or showing the page', () => {
    renderAt('/admin/rooms', { scenario: 'loading' });
    expect(screen.getByRole('status', { name: 'Checking access' })).toBeInTheDocument();
    expect(where()).toHaveTextContent('/admin/rooms');
    expect(screen.queryByRole('heading', { name: 'Rooms' })).not.toBeInTheDocument();
  });

  it.each([
    '/admin',
    '/admin/primary-setup',
    '/admin/rate-categories',
    '/admin/room-types',
    '/admin/rooms',
    '/admin/add-on-items',
    '/admin/notifications',
  ])('redirects a non-admin from %s to the dashboard with a dismissible message', async (path) => {
    const user = renderAt(path, { grant: grantOf('non-admin') });
    const dialog = await screen.findByRole('dialog', { name: 'No access' });
    expect(dialog).toHaveTextContent('You do not have access to that page.');
    // The router state is cleared right away: no loop, and a reload does not replay the message.
    await waitFor(() => expect(where()).toHaveTextContent(/^\/dashboard$/));
    expect(screen.getByRole('heading', { name: 'Dashboard', hidden: true })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(where()).toHaveTextContent(/^\/dashboard$/));
  });

  it('opens only the granted pages for partial access', async () => {
    renderAt('/admin/rooms', { grant: grantOf('partial') });
    expect(await screen.findByRole('heading', { name: 'Rooms' })).toBeInTheDocument();
  });

  it('redirects partial access away from a page it lacks', async () => {
    renderAt('/admin/notifications', { grant: grantOf('partial') });
    expect(await screen.findByRole('dialog', { name: 'No access' })).toBeInTheDocument();
    await waitFor(() => expect(where()).toHaveTextContent(/^\/dashboard$/));
  });

  it('fails closed when the grant cannot be loaded', async () => {
    renderAt('/admin/rooms', { scenario: 'error' });
    expect(
      await screen.findByRole('dialog', { name: 'Access could not be checked' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(where()).toHaveTextContent(/^\/dashboard$/));
  });

  it('does not guard the dashboard, so a denied dashboard cannot loop', async () => {
    renderAt('/dashboard', { scenario: 'error' });
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('guards non-admin pages by their own permission', async () => {
    renderAt('/reporting', { scenario: 'empty' }); // the empty scenario grants nothing
    expect(await screen.findByRole('dialog', { name: 'No access' })).toBeInTheDocument();
  });
});

describe('menu by user', () => {
  async function openMenu(id: MockUserId) {
    const user = renderAt('/dashboard', { grant: grantOf(id) });
    await screen.findByRole('heading', { name: 'Dashboard' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open menu' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    return screen.findByRole('dialog', { name: 'Menu' });
  }

  it('administrator: Admin Setup column with all six links', async () => {
    const menu = await openMenu('admin');
    expect(menu.querySelectorAll('a[href^="/admin/"]')).toHaveLength(6);
  });

  it('non-admin: no Admin Setup links', async () => {
    const menu = await openMenu('non-admin');
    expect(menu.querySelectorAll('a[href^="/admin"]')).toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'Admin Setup' })).not.toBeInTheDocument();
  });

  it('partial: only Room Types and Rooms', async () => {
    const menu = await openMenu('partial');
    const hrefs = [...menu.querySelectorAll('a[href^="/admin/"]')].map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(['/admin/room-types', '/admin/rooms']);
  });
});
