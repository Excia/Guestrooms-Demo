import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import AppHeader, { type AppHeaderProps } from './AppHeader';

const crumbs = [
  { title: 'Schedule', path: '/schedule' },
  { title: 'Admin Setup', path: '/admin' },
  { title: 'Rooms', path: '/admin/rooms' },
];

function setup(props: Partial<AppHeaderProps> = {}) {
  const onMenuToggle = vi.fn();
  const onMenuClose = vi.fn();
  render(
    <MemoryRouter>
      <AppHeader
        breadcrumbs={crumbs}
        menuOpen={false}
        onMenuToggle={onMenuToggle}
        onMenuClose={onMenuClose}
        axisUrl="https://axis.example.com"
        {...props}
      />
    </MemoryRouter>,
  );
  return { onMenuToggle, onMenuClose };
}

describe('AppHeader', () => {
  it('is a header landmark', () => {
    setup();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('home logo links to the Schedule route', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Guest Rooms' })).toHaveAttribute('href', '/schedule');
  });

  it('renders breadcrumbs with the current page marked', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toHaveTextContent('Schedule/Admin Setup/Rooms');
    expect(screen.getByText('Rooms')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Admin Setup' })).toHaveAttribute('href', '/admin');
  });

  it('omits breadcrumbs for a single-level trail', () => {
    setup({ breadcrumbs: [crumbs[0]] });
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('menu button toggles and exposes aria-expanded', async () => {
    const { onMenuToggle } = setup();
    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(onMenuToggle).toHaveBeenCalledTimes(1);
  });

  it('open state shows the close button and Escape closes it', () => {
    const { onMenuToggle, onMenuClose } = setup({ menuOpen: true });
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onMenuClose).toHaveBeenCalledTimes(1);
    expect(onMenuToggle).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
  });

  it('does not react to Escape while closed', () => {
    const { onMenuClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onMenuClose).not.toHaveBeenCalled();
  });

  it('Return to Site links to the Axis URL with exact casing', () => {
    setup();
    const links = screen.getAllByRole('link', { name: 'Return to Site' });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((l) => expect(l).toHaveAttribute('href', 'https://axis.example.com'));
    expect(screen.getByText('Return to Site')).toBeInTheDocument();
  });
});
