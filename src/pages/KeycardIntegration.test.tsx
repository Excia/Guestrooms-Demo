import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { GrantedAccess, saveButtonName } from '../app/testing';
import KeycardIntegration from './KeycardIntegration';

function renderPage(client: ApiClient = createMockClient()) {
  return render(
    <ApiProvider client={client}>
      <GrantedAccess>
        <MemoryRouter initialEntries={['/admin/keycard-integration']}>
          <Link to="/schedule">Go to schedule</Link>
          <KeycardIntegration />
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

const loaded = () => screen.findByRole('list', { name: 'Encoder Key' });
const inputs = () => screen.getAllByRole('textbox', { name: /^Encoder Key \d+$/ });
const values = () => inputs().map((i) => (i as HTMLInputElement).value);
const save = () => screen.getByRole('button', { name: saveButtonName('Encoder Keys') });
const withRetrieve = (retrieveEncoders: ApiClient['keycards']['retrieveEncoders']): ApiClient => {
  const client = createMockClient();
  return { ...client, keycards: { ...client.keycards, retrieveEncoders } };
};

describe('Keycard Integration page', () => {
  it('lists the saved keys under the shell with Save disabled', async () => {
    renderPage();
    await loaded();
    expect(values()).toEqual(['48001937465201', '48001937465202']);
    expect(screen.getByRole('heading', { level: 1, name: 'Keycard Integration' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Keycard Integration' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(save()).toHaveAttribute('aria-disabled', 'true');
    expect(inputs()[0]).toHaveAttribute(
      'placeholder',
      expect.stringContaining('digit Encoder Key'),
    );
  });

  it('shows a loading indicator, then an error with Retry', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const list = vi
      .fn<ApiClient['keycards']['listEncoders']>()
      .mockRejectedValueOnce(new Error('down'))
      .mockImplementation(client.keycards.listEncoders);
    renderPage({ ...client, keycards: { ...client.keycards, listEncoders: list } });
    expect(screen.getByLabelText('Loading Encoder Keys')).toBeInTheDocument();
    expect(await screen.findByText('Encoder Keys could not be loaded.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await loaded();
    expect(inputs()).toHaveLength(2);
  });

  it('shows an empty state when no keys are saved', async () => {
    renderPage(createMockClient({ scenario: 'empty' }));
    expect(await screen.findByText(/No Encoder Keys yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove All' })).toBeDisabled();
  });

  it('adds a blank row and focuses it', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Encoder' }));
    expect(inputs()).toHaveLength(3);
    expect(inputs()[2]).toHaveFocus();
    // A blank row alone is not a change.
    expect(save()).toHaveAttribute('aria-disabled', 'true');
  });

  it('removes one row and moves focus to a neighbor', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove Encoder Key 1' }));
    expect(values()).toEqual(['48001937465202']);
    expect(inputs()[0]).toHaveFocus();
    expect(save()).not.toHaveAttribute('aria-disabled');
  });

  it('asks before removing all, and Cancel keeps the list', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove All' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove all Encoder Keys?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(inputs()).toHaveLength(2);
  });

  it('clears the list when removing all is confirmed and focuses Add Encoder', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove All' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove All' }));
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByText(/No Encoder Keys yet/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Encoder' })).toHaveFocus());
    expect(save()).not.toHaveAttribute('aria-disabled');
  });

  it('retrieves an encoder from Visionline and shows the success toast', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Retrieve Encoder' }));
    expect(await screen.findAllByText('1 Encoder Successfully Retrieved')).not.toHaveLength(0);
    expect(values()).toEqual(['48001937465201', '48001937465202', '48001937465203']);
    expect(save()).not.toHaveAttribute('aria-disabled');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Notification' })).toBeNull());
  });

  it('says so when every retrieved encoder is already listed', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Retrieve Encoder' }));
    await screen.findAllByText('1 Encoder Successfully Retrieved');
    await user.click(screen.getByRole('button', { name: 'Retrieve Encoder' }));
    expect(
      (await screen.findAllByText('Every retrieved encoder is already in the list.')).length,
    ).toBeGreaterThan(0);
    expect(inputs()).toHaveLength(3);
  });

  it('keeps the dialog open while Try Again retries, and keeps focus on it', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    let release: (keys: string[]) => void = () => {};
    const retrieve = vi
      .fn<ApiClient['keycards']['retrieveEncoders']>()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => new Promise<string[]>((resolve) => (release = resolve)))
      .mockImplementation(client.keycards.retrieveEncoders);
    renderPage(withRetrieve(retrieve));
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Retrieve Encoder' }));
    const dialog = await screen.findByRole('dialog', { name: 'No encoders retrieved.' });
    const tryAgain = within(dialog).getByRole('button', { name: 'Try Again' });
    expect(tryAgain).toHaveFocus();
    await user.click(tryAgain);
    await waitFor(() => expect(retrieve).toHaveBeenCalledTimes(2));
    // Pending: the same dialog, the button busy but still focused, a second click does nothing.
    expect(dialog).toBeInTheDocument();
    expect(tryAgain).toHaveAttribute('aria-disabled', 'true');
    expect(tryAgain).toHaveFocus();
    fireEvent.click(tryAgain); // pointer-events are off, but Enter on the focused button still arrives
    expect(retrieve).toHaveBeenCalledTimes(2);
    release([]);
    await waitFor(() => expect(tryAgain).toHaveAttribute('aria-disabled', 'false'));
    expect(dialog).toBeInTheDocument();
    await user.click(tryAgain);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(values()).toHaveLength(3);
  });

  it('keeps focus on Retrieve Encoder while it runs', async () => {
    const user = userEvent.setup();
    let release: (keys: string[]) => void = () => {};
    renderPage(withRetrieve(() => new Promise<string[]>((resolve) => (release = resolve))));
    await loaded();
    const button = screen.getByRole('button', { name: 'Retrieve Encoder' });
    await user.click(button);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
    release(['48001937465203']);
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
  });

  it('keeps edits made while a retrieve is pending', async () => {
    const user = userEvent.setup();
    let release: (keys: string[]) => void = () => {};
    renderPage(withRetrieve(() => new Promise<string[]>((resolve) => (release = resolve))));
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Encoder' }));
    await user.click(screen.getByRole('button', { name: 'Retrieve Encoder' }));
    await user.type(inputs()[2], '1234');
    await user.click(screen.getByRole('button', { name: 'Add Encoder' }));
    release(['48001937465203']);
    await screen.findAllByText('1 Encoder Successfully Retrieved');
    // The typed row is kept (retrieve fills the other blank row), and the added row survives.
    expect(values()).toEqual(['48001937465201', '48001937465202', '1234', '48001937465203']);
  });

  it('Cancel closes the error dialog without changing the list', async () => {
    const user = userEvent.setup();
    renderPage(withRetrieve(() => Promise.resolve([])));
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Retrieve Encoder' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(inputs()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Retrieve Encoder' })).toHaveFocus();
  });

  it('flags a short key after leaving the field and refuses to save it', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const saveSpy = vi.spyOn(client.keycards, 'saveEncoders');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Encoder' }));
    await user.type(inputs()[2], '123');
    expect(inputs()[2]).not.toHaveAttribute('aria-invalid', 'true');
    await user.tab();
    expect(inputs()[2]).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter a 14 digit Encoder Key.')).toBeInTheDocument();
    await user.click(save());
    expect(saveSpy).not.toHaveBeenCalled();
    expect(inputs()[2]).toHaveFocus();
  });

  it('rejects letters and duplicates on save', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Encoder' }));
    await user.type(inputs()[2], '4800-1937-465201');
    await user.click(save());
    expect(screen.getByText('This Encoder Key is already in the list.')).toBeInTheDocument();
    await user.clear(inputs()[2]);
    await user.type(inputs()[2], 'abcdefghijklmn');
    await user.click(save());
    expect(screen.getByText('Use digits only.')).toBeInTheDocument();
  });

  it('saves normalized keys, drops blank rows and shows the toast', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Encoder' }));
    await user.type(inputs()[2], '4800-1937-465209');
    await user.click(screen.getByRole('button', { name: 'Add Encoder' }));
    await user.click(save());
    expect((await screen.findAllByText('Encoder Keys Saved')).length).toBeGreaterThan(0);
    expect(await client.keycards.listEncoders()).toEqual([
      '48001937465201',
      '48001937465202',
      '48001937465209',
    ]);
    expect(inputs()).toHaveLength(4);
    expect(save()).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows a key typed with hyphens in its saved form after saving', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Encoder' }));
    await user.type(inputs()[2], '4800-1937-465209');
    await user.click(save());
    await screen.findAllByText('Encoder Keys Saved');
    expect(values()[2]).toBe('48001937465209');
  });

  it('shows an error and keeps the edits when saving fails', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const failing: ApiClient = {
      ...client,
      keycards: { ...client.keycards, saveEncoders: () => Promise.reject(new Error('down')) },
    };
    renderPage(failing);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove Encoder Key 1' }));
    await user.click(save());
    expect(await screen.findByText('Encoder Keys could not be saved. Try again.')).toBeVisible();
    expect(inputs()).toHaveLength(1);
    expect(save()).not.toHaveAttribute('aria-disabled');
  });

  it('asks before leaving with unsaved edits', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove Encoder Key 1' }));
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(
      await screen.findByRole('dialog', { name: 'Encoder Keys have not been saved.' }),
    ).toBeInTheDocument();
  });

  it('labels every control for keyboard and screen reader users', async () => {
    renderPage();
    await loaded();
    expect(screen.getByRole('button', { name: 'Retrieve Encoder' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add Encoder' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove Encoder Key 2' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Encoder Key 1' })).toBeVisible();
  });
});
