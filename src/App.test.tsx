import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import App from './App';

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output>{pathname + search}</output>;
}

describe('App', () => {
  it('keeps the query string when redirecting / to Schedule', () => {
    render(
      <MemoryRouter initialEntries={['/?mock=empty']}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('/schedule?mock=empty');
  });

  it('redirects / to the Schedule page inside the shell', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('shows the page title for a trailing-slash path', () => {
    render(
      <MemoryRouter initialEntries={['/admin/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Admin Setup' })).toBeInTheDocument();
  });

  it('shows Not found for unknown paths', () => {
    render(
      <MemoryRouter initialEntries={['/nope']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });
});
