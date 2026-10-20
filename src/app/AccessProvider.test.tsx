import { render, screen } from '@testing-library/react';
import { ApiProvider, ApiError, type ApiClient } from '../api';
import { createMockClient } from '../api/mock';
import { createUnavailableClient } from '../api/unavailable';
import { AccessProvider } from './AccessProvider';
import { useAccess } from './useAccess';

function Probe() {
  const { status, can, canSeeAdminSetup } = useAccess();
  return (
    <output>
      {status}|{String(can('page.schedule'))}|{String(canSeeAdminSetup)}
    </output>
  );
}

const view = (client: ApiClient) => (
  <ApiProvider client={client}>
    <AccessProvider>
      <Probe />
    </AccessProvider>
  </ApiProvider>
);

describe('AccessProvider', () => {
  it('fails closed while loading', () => {
    render(view(createMockClient({ scenario: 'loading' })));
    expect(screen.getByRole('status')).toHaveTextContent('loading|false|false');
  });

  it('serves the grant once loaded', async () => {
    render(view(createMockClient()));
    expect(await screen.findByText('ready|true|true')).toBeInTheDocument();
  });

  it('fails closed on error and on an unconfigured deployment', async () => {
    const { unmount } = render(view(createMockClient({ scenario: 'error' })));
    expect(await screen.findByText('error|false|false')).toBeInTheDocument();
    unmount();
    const unconfigured = createUnavailableClient(
      new ApiError(0, 'not configured', { code: 'misconfigured' }),
    );
    render(view(unconfigured));
    expect(await screen.findByText('unconfigured|false|false')).toBeInTheDocument();
  });

  it("never serves the previous client's permissions to the next client", async () => {
    const { rerender } = render(view(createMockClient()));
    expect(await screen.findByText('ready|true|true')).toBeInTheDocument();
    rerender(view(createMockClient({ scenario: 'loading' })));
    expect(screen.getByRole('status')).toHaveTextContent('loading|false|false');
  });
});
