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
    expect(screen.getAllByText('Check-out must be after check-in.').length).toBeGreaterThan(0);
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
    expect(screen.getByRole('group', { name: 'Adults, Room 2' })).toHaveTextContent(
      '3 adults, Room 2',
    );
    expect(screen.getByRole('group', { name: 'Adults, Room 1' })).toHaveTextContent(
      '2 adults, Room 1',
    );
    await user.click(screen.getByRole('button', { name: 'Decrease Adults, Room 1' }));
    expect(screen.getByRole('button', { name: 'Decrease Adults, Room 1' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('group', { name: 'Adults, Room 1' })).toHaveTextContent(
      '1 adults, Room 1',
    );
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

  it('keeps focus on a stepper button that reaches its limit', async () => {
    const user = userEvent.setup();
    renderSearch();
    const dec = screen.getByRole('button', { name: 'Decrease Adults, Room 1' });
    dec.focus();
    await user.keyboard('{Enter}'); // 2 -> 1 (min)
    expect(dec).toHaveFocus();
    expect(dec).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Enter}'); // ignored at the minimum
    expect(dec).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Adults, Room 1' })).toHaveTextContent(
      '1 adults, Room 1',
    );
    const inc = screen.getByRole('button', { name: 'Increase Adults, Room 1' });
    inc.focus();
    for (let i = 0; i < 10; i++) await user.keyboard('{Enter}');
    expect(inc).toHaveFocus();
    expect(inc).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('group', { name: 'Adults, Room 1' })).toHaveTextContent(
      '8 adults, Room 1',
    );
  });

  it('moves focus to the previous room Remove button, or Add when that is Room 1', async () => {
    const user = userEvent.setup();
    renderSearch();
    const add = screen.getByRole('button', { name: 'Add Another Room' });
    await user.click(add);
    await user.click(add);
    await user.click(screen.getByRole('button', { name: 'Remove Room 3' }));
    expect(screen.getByRole('button', { name: 'Remove Room 2' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove Room 2' }));
    expect(add).toHaveFocus();
  });

  it('removing a middle room focuses the Remove button of the room before it', async () => {
    const user = userEvent.setup();
    renderSearch();
    const add = screen.getByRole('button', { name: 'Add Another Room' });
    await user.click(add);
    await user.click(add);
    await user.click(add);
    await user.click(screen.getByRole('button', { name: 'Increase Adults, Room 4' }));
    await user.click(screen.getByRole('button', { name: 'Remove Room 3' }));
    expect(screen.getByRole('button', { name: 'Remove Room 2' })).toHaveFocus();
    // The old Room 4 keeps its own guests as the new Room 3.
    expect(screen.getByRole('group', { name: 'Adults, Room 3' })).toHaveTextContent(
      '3 adults, Room 3',
    );
  });

  it('explains why the CTA is disabled and reveals errors from values or blur', async () => {
    const user = userEvent.setup();
    renderSearch();
    expect(cta()).toHaveAccessibleDescription('Enter check-in and check-out dates.');
    await user.type(screen.getByLabelText(/Check In/), '2026-10-22');
    expect(cta()).toHaveAccessibleDescription('Enter a check-out date.');
    await user.click(screen.getByLabelText(/Check Out/));
    await user.tab();
    expect(screen.getAllByText('Enter a check-out date.').length).toBeGreaterThan(0);
  });

  it('Enter in a date field with invalid dates announces the problem and focuses the field', async () => {
    const user = userEvent.setup();
    const onSearch = renderSearch();
    await user.type(screen.getByLabelText(/Check In/), '2026-10-22');
    await user.keyboard('{Enter}');
    expect(onSearch).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole('status').some((e) => e.textContent === 'Enter a check-out date.'),
    ).toBe(true);
    expect(screen.getByLabelText(/Check Out/)).toHaveFocus();
  });

  it('rejects stays over the maximum and does not show a night count for invalid dates', async () => {
    const user = userEvent.setup();
    renderSearch();
    await fillDates(user, '2026-10-22', '2099-01-01');
    expect(screen.getAllByText(/longer than 365 nights/).length).toBeGreaterThan(0);
    expect(cta()).toHaveTextContent('SEARCH STAY');
    expect(cta()).toBeDisabled();
  });

  it('does not show nights while check-in is in the past', async () => {
    const user = userEvent.setup();
    renderSearch();
    await fillDates(user, '2026-10-10', '2026-10-13');
    expect(cta()).toHaveTextContent('SEARCH STAY');
  });

  it('shows a note and disables Add at the maximum number of rooms', async () => {
    const user = userEvent.setup();
    renderSearch();
    const add = screen.getByRole('button', { name: 'Add Another Room' });
    for (let i = 0; i < 4; i++) await user.click(add);
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription('Maximum of 5 rooms');
  });

  it('keeps focus and the value when a stepper button at its limit is clicked', async () => {
    const user = userEvent.setup();
    renderSearch();
    const dec = screen.getByRole('button', { name: 'Decrease Adults, Room 1' });
    await user.click(dec); // 2 -> 1
    await user.click(dec); // at the minimum
    expect(document.activeElement).toBe(dec);
    expect(screen.getByRole('group', { name: 'Adults, Room 1' })).toHaveTextContent(
      '1 adults, Room 1',
    );
    expect(getComputedStyle(dec).pointerEvents).toBe('auto');
  });
});
