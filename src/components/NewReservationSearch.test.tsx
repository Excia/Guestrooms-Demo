import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import NewReservationSearch from './NewReservationSearch';

const TODAY = '2026-10-20';

function renderSearch(onSearch = vi.fn()) {
  render(
    <MemoryRouter>
      <NewReservationSearch today={TODAY} onSearch={onSearch} />
    </MemoryRouter>,
  );
  return onSearch;
}

const cta = () => screen.getByRole('button', { name: /^SEARCH/ });

async function fillDates(user: ReturnType<typeof userEvent.setup>, from: string, to: string) {
  await user.type(screen.getByLabelText(/Check In/), from);
  await user.type(screen.getByLabelText(/Check Out/), to);
}

describe('NewReservationSearch', () => {
  it('disables the CTA until the dates are valid', async () => {
    const user = userEvent.setup();
    renderSearch();
    expect(cta()).toBeDisabled();
    await fillDates(user, '2026-10-22', '2026-10-22');
    expect(cta()).toBeDisabled();
    expect(screen.getByText('Check-out must be after check-in.')).toBeInTheDocument();
  });

  it('shows the nights in the CTA, singular for one', async () => {
    const user = userEvent.setup();
    renderSearch();
    await fillDates(user, '2026-10-22', '2026-10-25');
    expect(cta()).toHaveTextContent('SEARCH 3 NIGHT STAY');
    expect(cta()).toBeEnabled();
    await user.clear(screen.getByLabelText(/Check Out/));
    await user.type(screen.getByLabelText(/Check Out/), '2026-10-23');
    expect(cta()).toHaveTextContent('SEARCH 1 NIGHT STAY');
  });

  it('adds and removes rooms; Room 1 has no Remove Room', async () => {
    const user = userEvent.setup();
    renderSearch();
    expect(screen.queryByRole('button', { name: /Remove Room/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Another Room' }));
    expect(screen.getByRole('group', { name: 'Room 2' })).toBeInTheDocument();
    // Focus moves to the new room's first control.
    expect(screen.getByRole('button', { name: 'Decrease Adults, Room 2' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove Room 2' }));
    expect(screen.queryByRole('group', { name: 'Room 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Another Room' })).toHaveFocus();
  });

  it('keeps each room its own guests and stops at the limits', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.click(screen.getByRole('button', { name: 'Add Another Room' }));
    await user.click(screen.getByRole('button', { name: 'Increase Adults, Room 2' }));
    expect(screen.getByRole('group', { name: 'Adults, Room 2' })).toHaveTextContent('03');
    expect(screen.getByRole('group', { name: 'Adults, Room 1' })).toHaveTextContent('02');
    await user.click(screen.getByRole('button', { name: 'Decrease Adults, Room 1' }));
    expect(screen.getByRole('button', { name: 'Decrease Adults, Room 1' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Adults, Room 1' })).toHaveTextContent('01');
  });

  it('submits the criteria', async () => {
    const user = userEvent.setup();
    const onSearch = renderSearch();
    await fillDates(user, '2026-10-22', '2026-10-25');
    await user.click(cta());
    expect(onSearch).toHaveBeenCalledWith({
      checkIn: '2026-10-22',
      checkOut: '2026-10-25',
      location: 'all',
      rooms: [{ adults: 2, children: 2 }],
    });
  });

  it('navigates to the results route with the criteria in the URL by default', async () => {
    const user = userEvent.setup();
    function Where() {
      const l = useLocation();
      return <p data-testid="where">{l.pathname + l.search}</p>;
    }
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <NewReservationSearch today={TODAY} />
                <Where />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    await fillDates(user, '2026-10-22', '2026-10-25');
    await user.click(cta());
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/reservations/new/results?checkIn=2026-10-22&checkOut=2026-10-25&rooms=2.2',
    );
  });
});
