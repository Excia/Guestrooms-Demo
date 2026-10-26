import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { ApiProvider } from '../../api/ApiProvider';
import { createMockClient } from '../../api/mock';
import { MAX_FAILED_PINS, MOCK_MANAGER_PIN, MOCK_STAFF_PIN } from '../../api/overridePin';
import type { ApiClient, PermissionGrant, VerifyOverridePinResult } from '../../api/types';
import { theme } from '../../theme';
import { OverridePinDialog } from './OverridePinDialog';

const ARRIVAL = {
  role: 'Staff',
  permissions: ['reservation.edit', 'reservation.check-in.arrival-date'],
} as PermissionGrant;

function setup(client: ApiClient = createMockClient({ grant: ARRIVAL })) {
  const onAuthorized = vi.fn();
  const onCancel = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <OverridePinDialog
          open
          title="Enter override code"
          message="A manager must authorize this."
          confirmLabel="Authorize"
          permission="reservation.check-in.any-time"
          onAuthorized={onAuthorized}
          onCancel={onCancel}
        />
      </ApiProvider>
    </ThemeProvider>,
  );
  return { user: userEvent.setup(), onAuthorized, onCancel };
}

const field = () => screen.getByLabelText('Override code');

describe('OverridePinDialog', () => {
  it('is a labelled dialog with a masked field that has focus', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Enter override code' });
    expect(within(dialog).getByText('A manager must authorize this.')).toBeInTheDocument();
    expect(field()).toHaveAttribute('type', 'password');
    expect(field()).toHaveAttribute('autocomplete', 'off');
    expect(field()).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Authorize' })).toBeDisabled();
  });

  it('hands over the PIN of an employee who holds the permission, on Enter', async () => {
    const { user, onAuthorized } = setup();
    await user.type(field(), `${MOCK_MANAGER_PIN}{Enter}`);
    await waitFor(() => expect(onAuthorized).toHaveBeenCalledWith(MOCK_MANAGER_PIN));
  });

  it('refuses the PIN of an employee without the permission, clears and refocuses the field', async () => {
    const { user, onAuthorized } = setup();
    await user.type(field(), MOCK_STAFF_PIN);
    await user.click(screen.getByRole('button', { name: 'Authorize' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That override code is not valid.');
    expect(field()).toBeInvalid();
    expect(field()).toHaveValue('');
    expect(field()).toHaveFocus();
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it('says it is locked out, with the wait, and stops accepting submits', async () => {
    const { user, onAuthorized } = setup();
    for (let i = 0; i < MAX_FAILED_PINS; i++) {
      await user.type(field(), '0000{Enter}');
      await waitFor(() => expect(field()).toHaveValue(''));
    }
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many incorrect codes. Try again in 5 minutes.',
    );
    await user.type(field(), MOCK_MANAGER_PIN);
    expect(screen.getByRole('button', { name: 'Authorize' })).toBeDisabled();
    await user.keyboard('{Enter}');
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it('shows a retry message when the check itself fails', async () => {
    const client = createMockClient({ grant: ARRIVAL });
    client.overrides = {
      verifyPin: () => Promise.reject(new Error('offline')),
    };
    const { user } = setup(client);
    await user.type(field(), `${MOCK_MANAGER_PIN}{Enter}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The override code could not be checked. Try again.',
    );
  });

  it('does not submit twice while a check is running', async () => {
    let resolve: (r: VerifyOverridePinResult) => void = () => {};
    const verifyPin = vi.fn(() => new Promise<VerifyOverridePinResult>((r) => (resolve = r)));
    const client = createMockClient({ grant: ARRIVAL });
    client.overrides = { verifyPin };
    const { user, onAuthorized } = setup(client);
    await user.type(field(), '1234{Enter}');
    await user.keyboard('{Enter}');
    expect(verifyPin).toHaveBeenCalledTimes(1);
    resolve({ valid: true });
    await waitFor(() => expect(onAuthorized).toHaveBeenCalledWith('1234'));
  });

  it('cancels with the Cancel button, the close icon and Escape', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(3);
  });
});
