import { act, render, screen, waitFor } from '@testing-library/react';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { SystemSettingsProvider } from './SystemSettingsProvider';
import { useSystemSettings } from './useSystemSettings';

function Consumer() {
  const { status, settings, apply } = useSystemSettings();
  return (
    <>
      <output aria-label="status">{status}</output>
      <output aria-label="label">{settings?.serviceChargeLabel ?? 'none'}</output>
      <button onClick={() => settings && apply({ ...settings, serviceChargeLabel: 'Fee' })}>
        apply
      </button>
    </>
  );
}

describe('SystemSettingsProvider', () => {
  it('does not fetch until a consumer asks', () => {
    const client = createMockClient();
    const get = vi.spyOn(client.systemSettings, 'get');
    render(
      <ApiProvider client={client}>
        <SystemSettingsProvider>
          <p>no consumer</p>
        </SystemSettingsProvider>
      </ApiProvider>,
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('loads on first use and publishes applied settings to every consumer', async () => {
    const client = createMockClient();
    render(
      <ApiProvider client={client}>
        <SystemSettingsProvider>
          <Consumer />
        </SystemSettingsProvider>
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText('status')).toHaveTextContent('ready'));
    expect(screen.getByLabelText('label')).toHaveTextContent('Service Charge');
    act(() => screen.getByRole('button', { name: 'apply' }).click());
    expect(screen.getByLabelText('label')).toHaveTextContent('Fee');
  });

  it('reports an error status when loading fails', async () => {
    render(
      <ApiProvider client={createMockClient({ scenario: 'error' })}>
        <SystemSettingsProvider>
          <Consumer />
        </SystemSettingsProvider>
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText('status')).toHaveTextContent('error'));
  });

  it('reads as not loaded without a provider', () => {
    render(<Consumer />);
    expect(screen.getByLabelText('status')).toHaveTextContent('idle');
    expect(screen.getByLabelText('label')).toHaveTextContent('none');
  });
});
