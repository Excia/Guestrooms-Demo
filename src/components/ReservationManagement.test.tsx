import { screen, waitFor } from '@testing-library/react';
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

  it.each([
    [1, '1', '1 unassigned charge'],
    [10, '10', '10 unassigned charges'],
    [100, '100', '100 unassigned charges'],
    [1000, '1,000', '1,000 unassigned charges'],
    [12000, '12,000', '12,000 unassigned charges'],
  ])('shows %i with 28px minimum, 8px padding and one label', async (count, text, label) => {
    renderList(withCount(count));
    const link = await screen.findByRole('link', {
      name: new RegExp(`^Unassigned Charges\\s*, ${label}$`),
    });
    expect(link).toHaveAttribute('href', '/unassigned-charges');
    const badge = screen.getByText(text);
    const style = getComputedStyle(badge);
    expect(style.height).toBe('28px');
    expect(style.minWidth).toBe('28px');
    expect(style.paddingLeft).toBe('8px');
    expect(style.paddingRight).toBe('8px');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
  });

  it('hides the badge at zero', async () => {
    const client = withCount(0);
    const spy = vi.spyOn(client.dashboard, 'getStats');
    renderList(client);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await spy.mock.results[0].value;
    expect(screen.getByRole('link', { name: 'Unassigned Charges' })).toBeInTheDocument();
    expect(screen.queryByText(/^, .*unassigned charges?$/)).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it.each(['loading', 'error'] as const)('keeps the links working in %s', async (scenario) => {
    const client = createMockClient({ scenario });
    const spy = vi.spyOn(client.dashboard, 'getStats');
    renderList(client);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(screen.getAllByRole('link')).toHaveLength(10);
    expect(screen.getByRole('link', { name: 'Unassigned Charges' })).toBeInTheDocument();
  });
});
