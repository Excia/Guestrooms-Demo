import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from './App';
import { GrantedAccess } from './app/testing';
import { theme } from './theme';

// The Schedule chunk fails to load (stale tab after a deploy, offline).
vi.mock('./pages/Schedule', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

describe('App with a lazy page that fails to load', () => {
  it('keeps the shell and offers Reload instead of blanking', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ThemeProvider theme={theme}>
        <GrantedAccess>
          <MemoryRouter initialEntries={['/schedule']}>
            <App />
          </MemoryRouter>
        </GrantedAccess>
      </ThemeProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('This page could not be loaded.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    log.mockRestore();
  });
});
