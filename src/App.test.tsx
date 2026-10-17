import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from './App';

describe('App', () => {
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
