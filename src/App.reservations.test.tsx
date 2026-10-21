import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from './App';
import { ApiProvider } from './api';
import { createMockClient } from './api/mock';
import { GrantedAccess } from './app/testing';
import { theme } from './theme';

const renderAt = (path: string) =>
  render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={createMockClient()}>
        <GrantedAccess>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </GrantedAccess>
      </ApiProvider>
    </ThemeProvider>,
  );

describe('reservation routes', () => {
  it('serves the Reservation List at /reservations', async () => {
    renderAt('/reservations');
    expect(await screen.findByRole('table', { name: 'Reservations' })).toBeInTheDocument();
  });

  it('serves a placeholder for the Reservation Hub at /reservations/:id', async () => {
    renderAt('/reservations/rs-5');
    expect(await screen.findByRole('heading', { name: 'Reservation Hub' })).toBeInTheDocument();
  });
});
