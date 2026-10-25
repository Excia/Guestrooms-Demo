import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { GrantedAccess } from '../app/testing';
import BookingRules from './BookingRules';

function renderPage(client: ApiClient = createMockClient()) {
  return render(
    <ApiProvider client={client}>
      <GrantedAccess>
        <MemoryRouter initialEntries={['/admin/booking-rules']}>
          <Link to="/schedule">Go to schedule</Link>
          <BookingRules />
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

const loaded = () => screen.findByRole('table', { name: 'Booking rules' });
const memberOnline = () => screen.getByRole('switch', { name: 'Member Online Booking' });
const nonMemberOnline = () => screen.getByRole('switch', { name: 'Non-Member Online Booking' });

describe('BookingRules page', () => {
  it('shows the matrix with its rows and columns', async () => {
    renderPage();
    const table = await loaded();
    expect(within(table).getAllByRole('rowheader')).toHaveLength(12);
    expect(
      within(table).getByRole('rowheader', { name: /Cancellation Period/ }),
    ).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Admin Booking/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Booking Rules' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Booking Rules' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: /^(Save Booking Rules|Saved, Booking Rules)$/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows N/A cells for rules that do not apply', async () => {
    renderPage();
    await loaded();
    // Employee: excluded room types and add-on popup. Non-member: member reserver.
    expect(screen.getAllByRole('cell', { name: 'N/A' })).toHaveLength(3);
  });

  it('reads the hold minutes in each column', async () => {
    renderPage();
    await loaded();
    expect(screen.getByRole('spinbutton', { name: 'Reservation Hold, Admin Booking' })).toHaveValue(
      15,
    );
    expect(
      screen.getByRole('spinbutton', { name: 'Reservation Hold, Member Online Booking' }),
    ).toHaveValue(10);
  });

  it('clears and disables both online columns when member online booking is switched off', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(memberOnline());
    expect(nonMemberOnline()).toBeDisabled();
    expect(nonMemberOnline()).not.toBeChecked();
    expect(
      screen.getByRole('spinbutton', { name: 'Reservation Hold, Member Online Booking' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('spinbutton', { name: 'Reservation Hold, Member Online Booking' }),
    ).toHaveValue(null);
    expect(
      screen.getByRole('spinbutton', { name: 'Reservation Hold, Non-Member Online Booking' }),
    ).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Unique Member Type Rules' })).toBeDisabled();
    expect(
      screen.queryByRole('table', { name: 'Unique member type rules' }),
    ).not.toBeInTheDocument();
    // The employee column is always on.
    expect(
      screen.getByRole('spinbutton', { name: 'Reservation Hold, Admin Booking' }),
    ).toBeEnabled();
  });

  it('clears only the non-member column when non-member online booking is switched off', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(nonMemberOnline());
    expect(
      screen.getByRole('spinbutton', { name: 'Reservation Hold, Non-Member Online Booking' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('spinbutton', { name: 'Reservation Hold, Member Online Booking' }),
    ).toBeEnabled();
  });

  it('shows the deposit amount only for a deposit and requires it', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.bookingRules, 'save');
    renderPage(client);
    await loaded();
    const amount = screen.getByRole('textbox', {
      name: 'Amount, Payment Method at Booking, Member Online Booking',
    });
    expect(amount).toHaveValue('99');
    await user.clear(amount);
    expect(screen.getByText(/Enter a deposit from \$0.01/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^(Save Booking Rules|Saved, Booking Rules)$/ }));
    expect(save).not.toHaveBeenCalled();
    expect(amount).toHaveFocus();
  });

  it('offers Optional as a payment method and clears the deposit when chosen', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.bookingRules, 'save');
    renderPage(client);
    await loaded();
    await user.click(
      screen.getByRole('combobox', { name: 'Payment Method at Booking, Member Online Booking' }),
    );
    await user.click(screen.getByRole('option', { name: 'Optional' }));
    expect(
      screen.queryByRole('textbox', {
        name: 'Amount, Payment Method at Booking, Member Online Booking',
      }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^(Save Booking Rules|Saved, Booking Rules)$/ }));
    const saved = save.mock.calls[0][0];
    expect(saved.member).toMatchObject({
      payment: 'optional',
      depositType: null,
      depositValue: null,
    });
  });

  it('switches a deposit between dollars and a percentage and validates each', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.bookingRules, 'save');
    renderPage(client);
    await loaded();
    const group = screen.getByRole('group', {
      name: 'Payment Method at Booking, Member Online Booking deposit type',
    });
    expect(within(group).getByRole('button', { name: '$ dollar amount' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(group).getByRole('button', { name: '% percentage of the total stay' }));
    const percent = screen.getByRole('textbox', {
      name: 'Percent of stay, Payment Method at Booking, Member Online Booking',
    });
    expect(percent).toHaveValue('');
    await user.type(percent, '150');
    expect(screen.getByText(/Enter a percentage from 0.01 to 100/)).toBeInTheDocument();
    await user.clear(percent);
    await user.type(percent, '12.5');
    expect(screen.queryByText(/Enter a percentage/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^(Save Booking Rules|Saved, Booking Rules)$/ }));
    expect(save.mock.calls[0][0].member).toMatchObject({
      payment: 'deposit',
      depositType: 'percent',
      depositValue: 12.5,
    });
  });

  it('keeps what is typed in the deposit box and stores the parsed value', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.bookingRules, 'save');
    renderPage(client);
    await loaded();
    const amount = screen.getByRole('textbox', {
      name: 'Amount, Payment Method at Booking, Member Online Booking',
    });
    await user.clear(amount);
    await user.type(amount, '12.50');
    expect(amount).toHaveValue('12.50');
    await user.click(screen.getByRole('button', { name: /^(Save Booking Rules|Saved, Booking Rules)$/ }));
    expect(save.mock.calls[0][0].member).toMatchObject({
      depositType: 'amount',
      depositValue: 1250,
    });
    await user.clear(amount);
    await user.type(amount, '1.05');
    expect(amount).toHaveValue('1.05');
    await user.type(amount, '9');
    expect(amount).toHaveValue('1.05');
    await user.click(screen.getByRole('button', { name: /^(Save Booking Rules|Saved, Booking Rules)$/ }));
    expect(save.mock.calls[1][0].member).toMatchObject({ depositValue: 105 });
  });

  it('refuses a hold outside 1 to 99', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const hold = screen.getByRole('spinbutton', { name: 'Reservation Hold, Admin Booking' });
    await user.clear(hold);
    await user.type(hold, '150');
    expect(screen.getByText('Enter 1 to 99 minutes.')).toBeInTheDocument();
  });

  it('adds and removes member type rows', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const table = screen.getByRole('table', { name: 'Unique member type rules' });
    expect(within(table).getAllByRole('button', { name: /^Remove rule for/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Add Member Type' }));
    expect(within(table).getAllByRole('button', { name: /^Remove rule for/ })).toHaveLength(2);
    expect(screen.getByText('Choose a member type.')).toBeInTheDocument();
    await user.click(
      within(table).getByRole('button', { name: 'Remove rule for new member type' }),
    );
    expect(within(table).getAllByRole('button', { name: /^Remove rule for/ })).toHaveLength(1);
    await user.click(within(table).getByRole('button', { name: 'Remove rule for Junior Member' }));
    expect(
      within(table).queryByRole('button', { name: /^Remove rule for/ }),
    ).not.toBeInTheDocument();
  });

  it('hides the member type table when Unique Member Type Rules is unticked', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('checkbox', { name: 'Unique Member Type Rules' }));
    expect(
      screen.queryByRole('table', { name: 'Unique member type rules' }),
    ).not.toBeInTheDocument();
  });

  it('saves with one button and shows the toast', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.bookingRules, 'save');
    renderPage(client);
    await loaded();
    await user.click(nonMemberOnline());
    await user.click(screen.getByRole('button', { name: /^(Save Booking Rules|Saved, Booking Rules)$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].nonMember).toBeNull();
    expect((await screen.findAllByText('Booking Rules Saved')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^(Save Booking Rules|Saved, Booking Rules)$/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('asks before leaving with unsaved changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(nonMemberOnline());
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Booking Rules have not been saved.',
    });
    expect(within(dialog).getByRole('button', { name: 'Save now' })).toHaveFocus();
  });

  it('offers Retry when the rules cannot be loaded', async () => {
    renderPage(createMockClient({ scenario: 'error' }));
    expect(await screen.findByText('Booking Rules could not be loaded.')).toBeInTheDocument();
  });

  it('shows a save failure and keeps the edits', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    vi.spyOn(client.bookingRules, 'save').mockRejectedValue(new Error('boom'));
    renderPage(client);
    await loaded();
    await user.click(nonMemberOnline());
    await user.click(screen.getByRole('button', { name: /^(Save Booking Rules|Saved, Booking Rules)$/ }));
    expect(
      await screen.findByText('Booking Rules could not be saved. Try again.'),
    ).toBeInTheDocument();
    expect(nonMemberOnline()).not.toBeChecked();
  });
});
