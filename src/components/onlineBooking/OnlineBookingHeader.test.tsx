import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { BookingTenant } from '../../app/onlineBookingNav';
import OnlineBookingHeader, { type OnlineBookingHeaderProps } from './OnlineBookingHeader';

const tenant: BookingTenant = {
  clubName: 'Pine Club',
  axisUrl: 'https://axis.example.com',
  memberAccountUrl: 'https://axis.example.com/me',
  nonMemberAccountUrl: 'https://core.example.com/account',
  memberPaymentsUrl: 'https://paycloud.example.com/methods',
  nonMemberPaymentsUrl: 'https://core.example.com/payments',
};

function setup(props: Partial<OnlineBookingHeaderProps> = {}, url = '/book') {
  const onSignIn = vi.fn();
  const onSignOut = vi.fn();
  render(
    <MemoryRouter initialEntries={[url]}>
      <OnlineBookingHeader
        tenant={tenant}
        audience={null}
        trail={[{ label: 'Make a Reservation', to: '/book' }]}
        currentPage="Payment"
        homePath="/book"
        myReservationsPath="/book/reservations"
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onSignIn, onSignOut };
}

describe('OnlineBookingHeader', () => {
  it('title links home and breadcrumbs mark the current page', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Pine Club Guest Rooms' })).toHaveAttribute(
      'href',
      '/book',
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Make a Reservation' })).toHaveAttribute(
      'href',
      '/book',
    );
    expect(within(nav).getByText('Payment')).toHaveAttribute('aria-current', 'page');
  });

  it('menu lists Make a Reservation and My Reservations', async () => {
    setup({ audience: 'member' });
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('menuitem', { name: 'Make a Reservation' })).toHaveAttribute(
      'href',
      '/book',
    );
    expect(screen.getByRole('menuitem', { name: 'My Reservations' })).toHaveAttribute(
      'href',
      '/book/reservations',
    );
  });

  it('signed out: My Reservations asks for sign-in first, then returns to it', async () => {
    const { onSignIn } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'My Reservations' }));
    expect(onSignIn).toHaveBeenCalledWith('/book/reservations');
  });

  it('signed out: shows Sign In and no Account control', async () => {
    const { onSignIn } = setup();
    expect(screen.queryByRole('button', { name: 'Account' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(onSignIn).toHaveBeenCalledWith();
  });

  it('signed in non-member: Account Menu points to Core and signs out', async () => {
    const { onSignOut } = setup({ audience: 'nonMember' });
    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menuitem', { name: 'Account' })).toHaveAttribute(
      'href',
      tenant.nonMemberAccountUrl,
    );
    expect(screen.getByRole('menuitem', { name: 'Payment Methods' })).toHaveAttribute(
      'href',
      tenant.nonMemberPaymentsUrl,
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('signed in member: Account Menu points to Axis and Paycloud', async () => {
    setup({ audience: 'member' });
    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menuitem', { name: 'Account' })).toHaveAttribute(
      'href',
      tenant.memberAccountUrl,
    );
    expect(screen.getByRole('menuitem', { name: 'Payment Methods' })).toHaveAttribute(
      'href',
      tenant.memberPaymentsUrl,
    );
  });

  it('Return to Site links to the club site and its tooltip names the club', async () => {
    setup();
    const link = screen.getByRole('link', { name: 'Return to Site' });
    expect(link).toHaveAttribute('href', tenant.axisUrl);
    await userEvent.hover(link);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Return to Pine Club main site.');
  });

  it('renders nothing when embedded in the mobile app', () => {
    setup({}, '/book?embedded=1');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });
});
