import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import NewReservationResults from './NewReservationResults';

describe('NewReservationResults (stub)', () => {
  it('echoes the criteria parsed from the URL', async () => {
    render(
      <ApiProvider client={createMockClient()}>
        <MemoryRouter
          initialEntries={[
            '/reservations/new/results?checkIn=2026-10-22&checkOut=2026-10-25&location=lakeside&rooms=2.0,1.3',
          ]}
        >
          <NewReservationResults />
        </MemoryRouter>
      </ApiProvider>,
    );
    expect(screen.getByText('2026-10-22')).toBeInTheDocument();
    expect(await screen.findByText('Lakeside Cottages')).toBeInTheDocument();
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
