import { render, screen } from '@testing-library/react';
import { renderWithApi } from '../api/testing';
import { MemoryRouter } from 'react-router';
import App from '../App';
import Dashboard from './Dashboard';

describe('Dashboard', () => {
  it('has a page h1 and the three column headings in order', () => {
    renderWithApi(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(['Reservation Management', 'Quick Stats', 'New Reservation']);
  });

  it('uppercases titles with CSS, keeping the source text', () => {
    renderWithApi(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    const h = screen.getByRole('heading', { name: 'Quick Stats' });
    expect(getComputedStyle(h).textTransform).toBe('uppercase');
  });

  it('renders slot content in its column', () => {
    render(
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
    renderWithApi(
      <MemoryRouter>
        <Dashboard
          reservationManagement={null}
          quickStats={<p>stats here</p>}
          newReservation={null}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('stats here')).toBeInTheDocument();
    expect(screen.queryByText(/arrives in a later ticket/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('is served at /dashboard inside the shell', () => {
    renderWithApi(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });
});
