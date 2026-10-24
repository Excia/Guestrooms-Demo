import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { createMockClient } from '../api/mock';
import { renderWithApi } from '../api/testing';
import { GrantedAccess } from '../app/testing';
import App from '../App';
import Reporting from './Reporting';

const renderPage = (scenario?: 'empty' | 'error') =>
  renderWithApi(
    <MemoryRouter>
      <Reporting />
    </MemoryRouter>,
    { client: createMockClient({ scenario }) },
  );

describe('Reporting landing', () => {
  it('renders the three regions', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Reporting' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Stats' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Standard Reports' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Custom Reports' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /week view/i })).toBeInTheDocument();
  });

  it('lists the standard report tiles as links to their reports', () => {
    renderPage();
    const tiles = within(screen.getByRole('list', { name: 'Standard reports' })).getAllByRole(
      'link',
    );
    expect(tiles).toHaveLength(12);
    expect(screen.getByRole('link', { name: 'Rooms Sold' })).toHaveAttribute(
      'href',
      '/reporting/standard/rooms-sold',
    );
  });

  it('lists custom reports newest first with creator and updated time', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Custom reports' });
    const rows = within(list).getAllByRole('link');
    expect(rows[0]).toHaveTextContent('Weekend Occupancy by Room Type');
    expect(rows[0]).toHaveTextContent(
      /Dana Whitfield \| Updated: \d\d\/\d\d\/\d\d \d{1,2}:\d\d [AP]M/,
    );
    expect(rows[0]).toHaveAttribute('href', '/reporting/custom/cr-1');
    expect(rows.at(-1)).toHaveTextContent('Open Balances by Member');
  });

  it('points New Report at the custom builder', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'New Report' })).toHaveAttribute(
      'href',
      '/reporting/custom/new',
    );
  });

  it('filters as you type and shows a no-match state', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: 'Custom reports' });
    const search = screen.getByRole('textbox', { name: 'Search Custom Reports' });
    await user.type(search, 'cancel');
    expect(
      within(screen.getByRole('list', { name: 'Custom reports' })).getAllByRole('link'),
    ).toHaveLength(1);
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('No custom reports match your search.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Custom reports' })).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no custom reports', async () => {
    renderPage('empty');
    expect(await screen.findByText(/No custom reports yet/)).toBeInTheDocument();
  });

  it('shows an error with Retry when the list fails to load', async () => {
    renderPage('error');
    expect(await screen.findByText('Custom reports could not be loaded.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry' }).length).toBeGreaterThan(0);
  });

  it('is served at /reporting inside the shell', async () => {
    renderWithApi(
      <GrantedAccess>
        <MemoryRouter initialEntries={['/reporting']}>
          <App />
        </MemoryRouter>
      </GrantedAccess>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Reporting' })).toBeInTheDocument();
  });
});
