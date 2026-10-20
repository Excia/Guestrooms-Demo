import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import NewReservationResults from './NewReservationResults';

describe('NewReservationResults (stub)', () => {
  it('echoes the criteria parsed from the URL', () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/reservations/new/results?checkIn=2026-10-22&checkOut=2026-10-25&rooms=2.0,1.3',
        ]}
      >
        <NewReservationResults />
      </MemoryRouter>,
    );
    expect(screen.getByText('2026-10-22')).toBeInTheDocument();
    expect(screen.getByText('Room 2')).toBeInTheDocument();
    expect(screen.getByText('1 adults, 3 children')).toBeInTheDocument();
  });

  it('tolerates a bad URL', () => {
    render(
      <MemoryRouter initialEntries={['/reservations/new/results?checkIn=zzz']}>
        <NewReservationResults />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Not set')).toHaveLength(2);
  });
});
