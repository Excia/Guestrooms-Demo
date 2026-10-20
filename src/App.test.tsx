import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import App from './App';
import { ApiProvider } from './api';
import { createMockClient } from './api/mock';
import { GrantedAccess } from './app/testing';
import { theme } from './theme';

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{pathname + search}</output>;
}

// The Schedule page fetches through the API client and uses the app theme.
function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <ApiProvider client={createMockClient()}>{children}</ApiProvider>
    </ThemeProvider>
  );
}

describe('App', () => {
  it('keeps the query string when redirecting / to Schedule', () => {
    render(
      <Providers>
        <GrantedAccess>
          <MemoryRouter initialEntries={['/?mock=empty']}>
            <App />
            <LocationProbe />
          </MemoryRouter>
        </GrantedAccess>
      </Providers>,
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/schedule?mock=empty');
  });

  it('redirects / to the Schedule page inside the shell', async () => {
    render(
      <Providers>
        <GrantedAccess>
          <MemoryRouter initialEntries={['/']}>
            <App />
          </MemoryRouter>
        </GrantedAccess>
      </Providers>,
    );
    expect(await screen.findByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('shows the page title for a trailing-slash path', () => {
    render(
      <GrantedAccess>
        <MemoryRouter initialEntries={['/admin/']}>
          <App />
        </MemoryRouter>
      </GrantedAccess>,
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

describe('dev components route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function renderAt(path: string) {
    vi.resetModules();
    const { default: FreshApp } = await import('./App');
    render(
      <MemoryRouter initialEntries={[path]}>
        <FreshApp />
      </MemoryRouter>,
    );
  }

  it('is served in development', async () => {
    vi.stubEnv('DEV', true);
    await renderAt('/dev/components');
    expect(await screen.findByRole('heading', { name: 'Shared components' })).toBeInTheDocument();
  });

  it('is a 404 in production builds', async () => {
    vi.stubEnv('DEV', false);
    await renderAt('/dev/components');
    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });
});
