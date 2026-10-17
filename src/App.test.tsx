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
