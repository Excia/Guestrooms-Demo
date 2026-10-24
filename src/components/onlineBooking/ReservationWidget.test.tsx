import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookingLimits, SearchCriteria } from '../../app/bookingSearch';
import AdjustSearch from './AdjustSearch';
import ReservationWidget from './ReservationWidget';

const today = '2026-10-21';
const limits: BookingLimits = { maxGuests: 3, maxRooms: 2, advanceDays: 365, maxNights: 30 };
const locations = [
  { id: 'a', name: 'Location A' },
  { id: 'b', name: 'Location B' },
];

describe('ReservationWidget', () => {
  it('starts with today, tomorrow, all locations and one room with 1 adult and 0 children', () => {
    render(<ReservationWidget today={today} locations={locations} limits={limits} />);
    expect(screen.getByLabelText(/Check In/)).toHaveValue('2026-10-21');
    expect(screen.getByLabelText(/Check Out/)).toHaveValue('2026-10-22');
    expect(screen.getByRole('combobox', { name: /Location/ })).toHaveTextContent('All Locations');
    expect(screen.getByText('1 adults, Room 1')).toBeInTheDocument();
    expect(screen.getByText('0 children, Room 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search 1 Night Stay' })).toBeEnabled();
  });

  it('hides Location for a single-location club', () => {
    render(<ReservationWidget today={today} locations={[locations[0]]} limits={limits} />);
    expect(screen.queryByRole('combobox', { name: /Location/ })).not.toBeInTheDocument();
  });

  it('updates the night count in the button as the dates change', async () => {
    render(<ReservationWidget today={today} locations={locations} limits={limits} />);
    const out = screen.getByLabelText(/Check Out/);
    await userEvent.clear(out);
    await userEvent.type(out, '2026-10-24');
    expect(screen.getByRole('button', { name: 'Search 3 Night Stay' })).toBeInTheDocument();
  });

  it('caps guests per room at the highest max occupancy', async () => {
    render(<ReservationWidget today={today} locations={locations} limits={limits} />);
    const room = screen.getByRole('group', { name: 'Room 1' });
    const plus = within(room).getByRole('button', { name: 'Increase Adults, Room 1' });
    await userEvent.click(plus);
    await userEvent.click(plus);
    await userEvent.click(plus);
    expect(within(room).getByText('3 adults, Room 1')).toBeInTheDocument();
    expect(plus).toHaveAttribute('aria-disabled', 'true');
    expect(within(room).getByRole('button', { name: 'Increase Children, Room 1' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it("uses the club's name for children", () => {
    render(<ReservationWidget today={today} limits={limits} childrenLabel="Kids" />);
    expect(screen.getByRole('button', { name: 'Increase Kids, Room 1' })).toBeInTheDocument();
  });

  it('adds rooms up to the Booking Rules maximum and Remove deletes the latest', async () => {
    render(<ReservationWidget today={today} locations={locations} limits={limits} />);
    expect(screen.queryByRole('button', { name: /Remove Room/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add Another Room' }));
    expect(screen.getByRole('group', { name: 'Room 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Another Room' })).toBeDisabled();
    expect(screen.getByText('Maximum of 2 rooms')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Room 2' }));
    expect(screen.queryByRole('group', { name: 'Room 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Another Room' })).toBeEnabled();
  });

  it('shows the global message when there is one', () => {
    const { rerender } = render(<ReservationWidget today={today} limits={limits} />);
    expect(screen.queryByText('Call for groups')).not.toBeInTheDocument();
    rerender(<ReservationWidget today={today} limits={limits} globalMessage="Call for groups" />);
    expect(screen.getByText('Call for groups')).toBeInTheDocument();
  });

  it('Search passes the criteria on; invalid dates do not search', async () => {
    const onSearch = vi.fn();
    render(
      <ReservationWidget today={today} locations={locations} limits={limits} onSearch={onSearch} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add Another Room' }));
    await userEvent.click(screen.getByRole('button', { name: 'Search 1 Night Stay' }));
    expect(onSearch).toHaveBeenCalledWith({
      checkIn: '2026-10-21',
      checkOut: '2026-10-22',
      location: 'all',
      rooms: [
        { adults: 1, children: 0 },
        { adults: 1, children: 0 },
      ],
    });
    onSearch.mockClear();
    const out = screen.getByLabelText(/Check Out/);
    await userEvent.clear(out);
    await userEvent.type(out, '2026-10-21');
    await userEvent.click(screen.getByRole('button', { name: 'Search Stay' }));
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByText('Check-out must be after check-in.')).toBeInTheDocument();
  });

  it('opens the results in a new tab with the criteria in the URL', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<ReservationWidget today={today} locations={locations} limits={limits} />);
    await userEvent.click(screen.getByRole('button', { name: 'Search 1 Night Stay' }));
    expect(open).toHaveBeenCalledWith(
      '/book/results?checkIn=2026-10-21&checkOut=2026-10-22&rooms=1.0',
      '_blank',
      'noopener',
    );
    open.mockRestore();
  });
});

describe('AdjustSearch', () => {
  const criteria: SearchCriteria = {
    checkIn: '2026-10-25',
    checkOut: '2026-10-27',
    location: 'a',
    rooms: [{ adults: 2, children: 0 }],
  };

  it('summarizes the current search and expands', async () => {
    render(
      <AdjustSearch criteria={criteria} today={today} locations={locations} limits={limits} />,
    );
    const toggle = screen.getByRole('button', { name: /Adjust Search/ });
    expect(toggle).toHaveTextContent('2 Nights 10/25 - 10/27 | 1 Room | Location A');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(/Check In/)).toHaveValue('2026-10-25');
  });

  it('shows the notice after a change and clears it once updated', async () => {
    const onSearch = vi.fn();
    render(
      <AdjustSearch
        criteria={criteria}
        today={today}
        locations={locations}
        limits={limits}
        onSearch={onSearch}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Adjust Search/ }));
    expect(screen.queryByText(/You have changed search options/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add Another Room' }));
    expect(
      screen.getByText(/You have changed search options, please click UPDATE SEARCH/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Update Search' }));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch.mock.calls[0][0].rooms).toHaveLength(2);
    expect(screen.queryByText(/You have changed search options/)).not.toBeInTheDocument();
    // The summary now describes the updated search.
    expect(screen.getByRole('button', { name: /Adjust Search/ })).toHaveTextContent('2 Rooms');
  });

  it('removing the change clears the notice too', async () => {
    render(
      <AdjustSearch criteria={criteria} today={today} locations={locations} limits={limits} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Adjust Search/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Another Room' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Room 2' }));
    expect(screen.queryByText(/You have changed search options/)).not.toBeInTheDocument();
  });
});
