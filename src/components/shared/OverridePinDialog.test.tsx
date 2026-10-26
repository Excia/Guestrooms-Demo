import { act, render, screen, waitFor, within } from '@testing-library/react';
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

function setup(
  client: ApiClient = createMockClient({ grant: ARRIVAL }),
  extra: { lockedForSeconds?: number; open?: boolean } = {},
) {
  const onAuthorized = vi.fn();
  const onCancel = vi.fn();
  const ui = (open: boolean) => (
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <OverridePinDialog
          open={open}
          lockedForSeconds={extra.lockedForSeconds}
          title="Enter override code"
          message="A manager must authorize this."
          confirmLabel="Authorize"
          permission="reservation.check-in.any-time"
          onAuthorized={onAuthorized}
          onCancel={onCancel}
        />
      </ApiProvider>
    </ThemeProvider>
  );
  const view = render(ui(extra.open ?? true));
  return {
    user: userEvent.setup(),
    onAuthorized,
    onCancel,
    setOpen: (open: boolean) => view.rerender(ui(open)),
  };
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
    expect(await screen.findAllByText('That override code is not valid.')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('That override code is not valid.');
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
    expect(await screen.findByRole('status')).toHaveTextContent(
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
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'The override code could not be checked. Try again.',
      ),
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

  it('ignores a check that finishes after the dialog was closed', async () => {
    let resolve: (r: VerifyOverridePinResult) => void = () => {};
    let signal: AbortSignal | undefined;
    const client = createMockClient({ grant: ARRIVAL });
    client.overrides = {
      verifyPin: (_r, o) => {
        signal = o?.signal;
        return new Promise<VerifyOverridePinResult>((r) => (resolve = r));
      },
    };
    const { user, onAuthorized, setOpen } = setup(client);
    await user.type(field(), '1234{Enter}');
    setOpen(false);
    expect(signal?.aborted).toBe(true);
    resolve({ valid: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it('starts locked when the caller is already locked out', async () => {
    const { user, onAuthorized } = setup(undefined, { lockedForSeconds: 90 });
    expect(screen.getAllByText('Too many incorrect codes. Try again in 2 minutes.')).toHaveLength(
      2,
    );
    await user.type(field(), MOCK_MANAGER_PIN);
    expect(screen.getByRole('button', { name: 'Authorize' })).toBeDisabled();
    expect(onAuthorized).not.toHaveBeenCalled();
  });
});

describe('OverridePinDialog lockout countdown', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('counts down quietly, announces the lock once and clears it when it ends', async () => {
    setup(undefined, { lockedForSeconds: 3 });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Try again in 3 seconds.');
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getAllByText('Too many incorrect codes. Try again in 1 second.')).toHaveLength(1);
    expect(status).toHaveTextContent('Try again in 3 seconds.');
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.queryByText(/Too many incorrect codes/)).not.toBeInTheDocument();
    expect(status).toBeEmptyDOMElement();
    expect(field()).toBeValid();
    // No more ticks: a later wait would show nothing new.
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText(/Too many incorrect codes/)).not.toBeInTheDocument();
  });
});
