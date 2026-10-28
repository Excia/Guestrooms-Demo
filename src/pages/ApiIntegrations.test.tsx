import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { pagePermission } from '../app/permissions';
import { GrantedAccess, saveButtonName } from '../app/testing';
import RequireAccess from '../components/RequireAccess';
import ApiIntegrations from './ApiIntegrations';

function renderPage(
  client: ApiClient = createMockClient(),
  granted?: Parameters<typeof GrantedAccess>[0]['granted'],
) {
  return render(
    <ApiProvider client={client}>
      <GrantedAccess granted={granted}>
        <MemoryRouter initialEntries={['/admin/api-integrations']}>
          <Link to="/schedule">Go to schedule</Link>
          <RequireAccess pageId="api-integrations">
            <ApiIntegrations />
          </RequireAccess>
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

const save = () => screen.getByRole('button', { name: saveButtonName('API Integrations') });
const openTab = async (name: string) => {
  await userEvent.click(screen.getByRole('tab', { name }));
};

describe('API Integrations page: shell', () => {
  it('opens on PayCloud API Tokens with three tabs and Save disabled', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'API Integrations' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'API Integrations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'PayCloud API Tokens',
      'Authentications',
      'API Keys',
    ]);
    expect(screen.getByRole('tab', { name: 'PayCloud API Tokens' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('list', { name: 'PayCloud API Tokens' })).toBeVisible();
    expect(save()).toHaveAttribute('aria-disabled', 'true');
  });

  it('is View-only for anyone who is not an administrator', async () => {
    renderPage(createMockClient(), [pagePermission('api-integrations')]);
    expect(await screen.findByTestId('read-only-note')).toHaveTextContent('View only');
    await screen.findByRole('list', { name: 'PayCloud API Tokens' });
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add API Token' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    await openTab('API Keys');
    expect(screen.queryByRole('button', { name: 'Create New Key' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Rotate/ })).not.toBeInTheDocument();
  });
});

describe('PayCloud API Tokens', () => {
  it('lists masked keys with their environment and never the full key', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'PayCloud API Tokens' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list.textContent).not.toContain('3f2b8c1e');
    expect(
      (
        within(list).getByRole('textbox', {
          name: /^API Key 1, saved, ends in/,
        }) as HTMLInputElement
      ).value,
    ).toMatch(/^•+[0-9a-f]{4}$/);
    expect(within(list).getByRole('combobox', { name: 'Environment 1' })).toHaveTextContent(
      'Production',
    );
  });

  it('shows an error with Retry, and an empty state', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const list = vi
      .fn<ApiClient['integrations']['listPayCloudTokens']>()
      .mockRejectedValueOnce(new Error('down'))
      .mockImplementation(client.integrations.listPayCloudTokens);
    const view = renderPage({
      ...client,
      integrations: { ...client.integrations, listPayCloudTokens: list },
    });
    expect(screen.getByLabelText('Loading PayCloud API Tokens')).toBeInTheDocument();
    expect(await screen.findByText('PayCloud API Tokens could not be loaded.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('list', { name: 'PayCloud API Tokens' })).toBeVisible();
    view.unmount();
    renderPage(createMockClient({ scenario: 'empty' }));
    expect(await screen.findByText('No PayCloud API Tokens yet.')).toBeInTheDocument();
  });

  it('adds a token, refuses a blank key, then saves and masks it', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: 'PayCloud API Tokens' });
    await user.click(screen.getByRole('button', { name: 'Add API Token' }));
    const input = screen.getByLabelText('API Key 3');
    expect(input).toHaveFocus();
    await user.click(save());
    expect(await screen.findByText('Enter the API key.')).toBeInTheDocument();
    expect(input).toHaveFocus();
    await user.type(input, 'abcd-1234-wxyz-9876');
    await user.click(save());
    expect(await screen.findByText('PayCloud API Tokens Saved')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'PayCloud API Tokens' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(list.textContent).not.toContain('abcd-1234');
    expect(
      (
        within(list).getByRole('textbox', {
          name: /^API Key 3, saved, ends in 9876/,
        }) as HTMLInputElement
      ).value,
    ).toMatch(/9876$/);
    await waitFor(() => expect(save()).toHaveAttribute('aria-disabled', 'true'));
  });

  it('replaces a saved key without ever showing it', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const spy = vi.spyOn(client.integrations, 'savePayCloudTokens');
    renderPage(client);
    await screen.findByRole('list', { name: 'PayCloud API Tokens' });
    await user.click(screen.getByRole('button', { name: 'Replace key of API Key 2' }));
    const input = screen.getByLabelText('API Key 2');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('type', 'password');
    await user.type(input, 'new-secret-0042');
    await user.click(save());
    await screen.findByText('PayCloud API Tokens Saved');
    expect(spy).toHaveBeenCalledWith([
      { id: 'paycloud-1', environment: 'production' },
      { id: 'paycloud-2', apiKey: 'new-secret-0042', environment: 'test' },
    ]);
  });

  it('confirms before removing a saved token and removes it on Save', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await screen.findByRole('list', { name: 'PayCloud API Tokens' });
    await user.click(screen.getByRole('button', { name: 'Remove PayCloud API Token 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this PayCloud API Token?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    const list = screen.getByRole('list', { name: 'PayCloud API Tokens' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    await user.click(save());
    await screen.findByText('PayCloud API Tokens Saved');
    expect(await client.integrations.listPayCloudTokens()).toHaveLength(1);
  });

  it('keeps the edits on a tab while another tab is open, and asks before leaving', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: 'PayCloud API Tokens' });
    await user.click(screen.getByRole('button', { name: 'Add API Token' }));
    await user.type(screen.getByLabelText('API Key 3'), 'kept-value');
    await openTab('API Keys');
    await openTab('PayCloud API Tokens');
    expect(screen.getByLabelText('API Key 3')).toHaveValue('kept-value');
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'API Integrations have not been saved.',
    });
    expect(within(dialog).getByRole('button', { name: 'Save now' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Leave without saving' }));
  });

  it('shows a save failure and keeps the edits', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    client.integrations.savePayCloudTokens = () => Promise.reject(new Error('down'));
    renderPage(client);
    await screen.findByRole('list', { name: 'PayCloud API Tokens' });
    await user.click(screen.getByRole('button', { name: 'Add API Token' }));
    await user.type(screen.getByLabelText('API Key 3'), 'abc');
    await user.click(save());
    expect(
      await screen.findByText('PayCloud API Tokens could not be saved. Try again.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('API Key 3')).toHaveValue('abc');
  });
});

describe('Authentications', () => {
  const field = (name: string, index = 0) => screen.getAllByLabelText(name)[index];

  it('shows both integrations, disabled, with no password loaded', async () => {
    renderPage();
    await openTab('Authentications');
    expect(await screen.findByRole('heading', { name: 'Tiger TMS' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Assa Abloy' })).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Enable Tiger TMS' })).not.toBeChecked();
    expect(screen.getAllByLabelText('Password')[0]).toHaveValue('');
    expect(screen.getByLabelText('Access ID')).toBeInTheDocument();
  });

  it('refuses to save an enabled integration with a bad URL, then saves and reports the test', async () => {
    const user = userEvent.setup();
    renderPage();
    await openTab('Authentications');
    await screen.findByRole('heading', { name: 'Tiger TMS' });
    await user.click(screen.getByRole('switch', { name: 'Enable Tiger TMS' }));
    await user.click(save());
    expect(
      await screen.findByText('Enter a valid URL, for example https://example.com.'),
    ).toBeInTheDocument();
    expect(field('URL')).toHaveFocus();
    await user.type(field('URL'), 'https://tms.example.com');
    await user.type(field('Password'), 'pw-secret');
    await user.click(save());
    expect(
      (await screen.findAllByText('Connection has been made successfully.')).length,
    ).toBeGreaterThan(0);
    expect(field('Password')).toHaveValue('');
    expect(screen.getByText('A password is saved. Type to replace it.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('pw-secret');
  });

  it('requires an Access ID for Assa Abloy and reports a failed connection test', async () => {
    const user = userEvent.setup();
    renderPage();
    await openTab('Authentications');
    await screen.findByRole('heading', { name: 'Assa Abloy' });
    await user.click(screen.getByRole('switch', { name: 'Enable Assa Abloy' }));
    await user.type(field('URL', 1), 'https://offline.example.com');
    await user.click(save());
    expect(await screen.findByText('Access ID is required for Assa Abloy.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Access ID'), 'ACC-1');
    await user.type(field('Password', 1), 'pw');
    await user.click(save());
    expect(
      (await screen.findAllByText('Credentials saved, but connection test failed for Assa Abloy.'))
        .length,
    ).toBeGreaterThan(0);
  });

  it('tests a connection without saving', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const saveSpy = vi.spyOn(client.integrations, 'saveAuthentications');
    renderPage(client);
    await openTab('Authentications');
    await screen.findByRole('heading', { name: 'Tiger TMS' });
    await user.click(screen.getByRole('button', { name: 'Test Connection to Tiger TMS' }));
    expect(
      await screen.findByText('Enter a valid URL, for example https://example.com.'),
    ).toBeInTheDocument();
    await user.type(field('URL'), 'https://tms.example.com');
    await user.type(field('Password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Test Connection to Tiger TMS' }));
    expect(
      (await screen.findAllByText('Successful connection to Tiger TMS.')).length,
    ).toBeGreaterThan(0);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('shows an error with Retry when the list cannot be loaded', async () => {
    const client = createMockClient();
    client.integrations.listAuthentications = () => Promise.reject(new Error('down'));
    renderPage(client);
    await openTab('Authentications');
    expect(await screen.findByText('Authentications could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('API Keys', () => {
  const keyList = () => screen.findByRole('list', { name: 'Guest Rooms API Keys' });

  it('lists the keys masked', async () => {
    renderPage();
    await openTab('API Keys');
    const list = await keyList();
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list.textContent).not.toContain('grk_');
    expect(within(list).getByText('Website booking widget')).toBeVisible();
  });

  it('shows an empty state and an error with Retry', async () => {
    const view = renderPage(createMockClient({ scenario: 'empty' }));
    await openTab('API Keys');
    expect(await screen.findByText('No API keys yet.')).toBeInTheDocument();
    view.unmount();
    renderPage(createMockClient({ scenario: 'error' }));
    await openTab('API Keys');
    expect(await screen.findByText('API Keys could not be loaded.')).toBeInTheDocument();
  });

  it('creates a key, shows it once, copies it, and lists it masked afterwards', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderPage();
    await openTab('API Keys');
    await keyList();
    await user.click(screen.getByRole('button', { name: 'Create New Key' }));
    const create = await screen.findByRole('dialog', { name: 'Create New API Key' });
    await user.click(within(create).getByRole('button', { name: 'Create' }));
    expect(await within(create).findByText('Enter a key name.')).toBeInTheDocument();
    await user.type(within(create).getByLabelText(/Key Name/), 'Night audit');
    await user.click(within(create).getByRole('button', { name: 'Create' }));

    const shown = await screen.findByRole('dialog', { name: 'API key created: Night audit' });
    const secret = (within(shown).getByLabelText('API key') as HTMLInputElement).value;
    expect(secret).toMatch(/^grk_[a-z0-9]{40}$/);
    expect(within(shown).getByText(/shown only once/)).toBeInTheDocument();
    await user.click(within(shown).getByRole('button', { name: 'Copy Key' }));
    expect(writeText).toHaveBeenCalledWith(secret);
    expect(await within(shown).findByText('Key copied to clipboard.')).toBeInTheDocument();
    await user.click(within(shown).getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.textContent).not.toContain(secret);
    const list = await keyList();
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByText('Night audit')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create New Key' })).toHaveFocus();
  });

  it('says so when the clipboard is not available', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    renderPage();
    await openTab('API Keys');
    await keyList();
    await user.click(screen.getByRole('button', { name: 'Rotate key Accounting export' }));
    await user.click(await screen.findByRole('button', { name: 'Rotate' }));
    const shown = await screen.findByRole('dialog', { name: /^API key rotated/ });
    await user.click(within(shown).getByRole('button', { name: 'Copy Key' }));
    expect(await within(shown).findByText(/Could not copy/)).toBeInTheDocument();
  });

  it('refuses a name already in use', async () => {
    const user = userEvent.setup();
    renderPage();
    await openTab('API Keys');
    await keyList();
    await user.click(screen.getByRole('button', { name: 'Create New Key' }));
    const create = await screen.findByRole('dialog', { name: 'Create New API Key' });
    await user.type(within(create).getByLabelText(/Key Name/), 'accounting export');
    await user.click(within(create).getByRole('button', { name: 'Create' }));
    expect(
      await within(create).findByText('A key with this name already exists.'),
    ).toBeInTheDocument();
  });

  it('asks before rotating, then shows the new key once', async () => {
    const user = userEvent.setup();
    renderPage();
    await openTab('API Keys');
    const list = await keyList();
    const before = within(list).getAllByRole('listitem')[0].textContent;
    await user.click(screen.getByRole('button', { name: 'Rotate key Website booking widget' }));
    const confirm = await screen.findByRole('dialog', { name: 'Rotate Website booking widget?' });
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(confirm).getByRole('button', { name: 'Rotate' }));
    const shown = await screen.findByRole('dialog', {
      name: 'API key rotated: Website booking widget',
    });
    const secret = (within(shown).getByLabelText('API key') as HTMLInputElement).value;
    await user.click(within(shown).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.textContent).not.toContain(secret);
    expect(within(await keyList()).getAllByRole('listitem')[0].textContent).not.toBe(before);
  });

  it('asks before revoking and removes the key', async () => {
    const user = userEvent.setup();
    renderPage();
    await openTab('API Keys');
    await keyList();
    await user.click(screen.getByRole('button', { name: 'Remove key Accounting export' }));
    const confirm = await screen.findByRole('dialog', { name: 'Revoke Accounting export?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Accounting export')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove key Accounting export' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Revoke Accounting export?' })).getByRole(
        'button',
        { name: 'Revoke' },
      ),
    );
    await waitFor(() => expect(screen.queryByText('Accounting export')).not.toBeInTheDocument());
    expect(await screen.findByText('API key "Accounting export" revoked')).toBeInTheDocument();
  });

  it('keeps the confirmation open with a message when the server refuses', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    client.integrations.revokeApiKey = () => Promise.reject(new Error('down'));
    renderPage(client);
    await openTab('API Keys');
    await keyList();
    await user.click(screen.getByRole('button', { name: 'Remove key Accounting export' }));
    const confirm = await screen.findByRole('dialog', { name: 'Revoke Accounting export?' });
    await user.click(within(confirm).getByRole('button', { name: 'Revoke' }));
    expect(
      await within(confirm).findByText('The key could not be revoked. Try again.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Accounting export')).toBeInTheDocument();
  });
});
