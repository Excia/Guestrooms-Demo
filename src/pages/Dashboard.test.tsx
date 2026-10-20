import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { renderWithApi } from '../api/testing';
import App from '../App';
import Dashboard from './Dashboard';

const renderDashboard = (ui: ReactElement) => renderWithApi(<MemoryRouter>{ui}</MemoryRouter>);

describe('Dashboard', () => {
  it('has a page h1 and the three column headings in order', () => {
    renderDashboard(<Dashboard />);
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(['Reservation Management', 'Quick Stats', 'New Reservation']);
  });

  it('uppercases titles with CSS, keeping the source text', () => {
    renderDashboard(<Dashboard />);
    const h = screen.getByRole('heading', { name: 'Quick Stats' });
    expect(getComputedStyle(h).textTransform).toBe('uppercase');
  });

  it('renders slot content in its column', () => {
    renderDashboard(
      <Dashboard
        reservationManagement={<p>list here</p>}
        quickStats={<p>stats here</p>}
        newReservation={<p>search here</p>}
      />,
    );
    expect(screen.getByText('list here')).toBeInTheDocument();
    expect(screen.getByText('stats here')).toBeInTheDocument();
    expect(screen.getByText('search here')).toBeInTheDocument();
  });

  it('renders nothing in a column whose slot is null', () => {
    // Explicit slots everywhere, so the test does not depend on which tickets have landed.
    renderDashboard(
      <Dashboard
        reservationManagement={<p>list here</p>}
        quickStats={null}
        newReservation={<p>search here</p>}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Stats' })).toBeInTheDocument();
    expect(screen.queryByText(/arrives in a later ticket/)).not.toBeInTheDocument();
  });

  it('is served at /dashboard inside the shell', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });
});
