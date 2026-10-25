import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import ClubNewReservationSearch from './ClubNewReservationSearch';

const setup = (client = createMockClient()) =>
  render(
    <ApiProvider client={client}>
      <MemoryRouter>
        <ClubNewReservationSearch />
      </MemoryRouter>
    </ApiProvider>,
  );

describe('ClubNewReservationSearch', () => {
  it('offers the locations saved on the Locations page', async () => {
    setup();
    expect(await screen.findByRole('combobox', { name: /Location/ })).toBeInTheDocument();
  });

  it('hides the Location select once the club has one location', async () => {
    const client = createMockClient();
    const [main] = await client.locations.list();
    await client.locations.save([{ id: main.id, name: main.name, area: main.area }]);
    setup(client);
    await screen.findByLabelText(/Check In/);
    expect(screen.queryByRole('combobox', { name: /Location/ })).not.toBeInTheDocument();
  });
});
