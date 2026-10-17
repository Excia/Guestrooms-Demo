import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import AppHeader, { type AppHeaderProps } from './AppHeader';

function setup(props: Partial<AppHeaderProps> = {}) {
  const onMenuToggle = vi.fn();
  const onMenuClose = vi.fn();
  render(
    <MemoryRouter>
      <AppHeader
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

  it('ignores an Escape that was already handled', () => {
    const { onMenuClose } = setup({ menuOpen: true });
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    event.preventDefault();
    document.dispatchEvent(event);
    expect(onMenuClose).not.toHaveBeenCalled();
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
