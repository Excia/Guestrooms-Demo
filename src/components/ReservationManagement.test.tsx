import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { createMockClient } from '../api/mock';
import { renderWithApi } from '../api/testing';
import type { ApiClient } from '../api/types';
import ReservationManagement from './ReservationManagement';

function renderList(client: ApiClient) {
  return renderWithApi(
    <MemoryRouter>
      <ReservationManagement />
    </MemoryRouter>,
    { client },
  );
}

const withCount = (count: number): ApiClient => {
  const client = createMockClient();
  const stats = client.dashboard.getStats;
  client.dashboard.getStats = async (o) => ({ ...(await stats(o)), unassignedChargesCount: count });
  return client;
};

describe('ReservationManagement', () => {
  it('renders ten links with real hrefs', () => {
    renderList(createMockClient({ scenario: 'loading' }));
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(10);
    expect(links[0]).toHaveAttribute('href', '/schedule');
    expect(links[3]).toHaveAttribute('href', '/unassigned-charges');
    expect(links[9]).toHaveAttribute('href', '/reporting');
  });

  it('shows the count with one accessible label', async () => {
    renderList(withCount(10));
    const link = await screen.findByRole('link', { name: /10 unassigned charges/ });
    expect(link).toHaveAttribute('href', '/unassigned-charges');
  });

  it('uses the singular for one', async () => {
    renderList(withCount(1));
    expect(await screen.findByRole('link', { name: /1 unassigned charge$/ })).toBeInTheDocument();
  });

  it('hides the badge at zero', async () => {
    renderList(withCount(0));
    await screen.findAllByRole('link');
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole('link', { name: 'Unassigned Charges' })).toBeInTheDocument();
  });

  it.each(['loading', 'error'] as const)('keeps the links working in %s', async (scenario) => {
    renderList(createMockClient({ scenario }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getAllByRole('link')).toHaveLength(10);
    expect(screen.getByRole('link', { name: 'Unassigned Charges' })).toBeInTheDocument();
  });
});
