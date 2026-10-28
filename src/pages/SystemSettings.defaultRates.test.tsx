// Default Rate Categories tab of System Settings (ticket 189; legacy DefaultRateCategoriesEdit.vue).
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { pagePermission } from '../app/permissions';
import RequireAccess from '../components/RequireAccess';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess, saveButtonName } from '../app/testing';
import SystemSettings from './SystemSettings';

function renderPage(client: ApiClient = createMockClient()) {
  return render(
    <ApiProvider client={client}>
      <SystemSettingsProvider>
        <GrantedAccess>
          <MemoryRouter initialEntries={['/admin/primary-setup']}>
            <Link to="/schedule">Go to schedule</Link>
            <SystemSettings />
          </MemoryRouter>
        </GrantedAccess>
      </SystemSettingsProvider>
    </ApiProvider>,
  );
}

async function openTab(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('combobox', { name: 'Time Zone' });
  await user.click(screen.getByRole('tab', { name: 'Default Rate Categories' }));
  return screen.getByRole('table', { name: 'Default rate categories' });
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  select: string | RegExp,
  option: string,
) {
  await user.click(screen.getByRole('combobox', { name: select }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Default Rate Categories tab', () => {
  it('is enabled and shows the four legacy rows with their saved choices and hints', async () => {
    const user = userEvent.setup();
    renderPage();
    const table = await openTab(user);
    expect(screen.getByRole('tab', { name: 'Default Rate Categories' })).toBeEnabled();
    expect(
      within(table).getByRole('columnheader', { name: 'Default Rate Category' }),
    ).toBeVisible();
    for (const label of ['Room Block Rate Category', 'Members', 'Non-Members', 'Owners']) {
      expect(within(table).getByRole('rowheader', { name: new RegExp(`^${label}`) })).toBeVisible();
    }
    expect(screen.getByText('default selection on creation of room block')).toBeVisible();
    expect(screen.getByText('applied when the occupant owns the room')).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Members default rate category' }),
    ).toHaveTextContent('Member Rate');
    expect(
      screen.getByRole('combobox', { name: 'Owners default rate category' }),
    ).toHaveTextContent('Owner Rate');
    // The override row of the sample data.
    expect(screen.getByRole('combobox', { name: 'Member type, Honorary Member' })).toBeVisible();
  });

  it('offers the Rate Categories list in each select', async () => {
    const user = userEvent.setup();
    renderPage();
    await openTab(user);
    await user.click(screen.getByRole('combobox', { name: 'Non-Members default rate category' }));
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(expect.arrayContaining(['Comp Rate', 'Member Rate', 'Non-Member Rate']));
  });

  it('saves a changed default with the one Save button, then shows the saved state', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await openTab(user);
    expect(screen.getByRole('button', { name: saveButtonName('System Settings') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await choose(user, 'Non-Members default rate category', 'Comp Rate');
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].defaultRateCategories.nonMember).toBe('rc-comp');
    expect((await client.systemSettings.get()).defaultRateCategories.nonMember).toBe('rc-comp');
    expect(await screen.findByText('System Settings Saved')).toBeInTheDocument();
  });

  it('asks before leaving with an unsaved change on this tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await openTab(user);
    await choose(user, 'Owners default rate category', 'Comp Rate');
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(
      await screen.findByRole('dialog', { name: 'System Settings have not been saved.' }),
    ).toBeInTheDocument();
  });

  it('adds an override row, focuses it, and refuses to save it empty', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await openTab(user);
    await user.click(screen.getByRole('button', { name: 'Add Member Type Override' }));
    const newType = screen.getByRole('combobox', { name: 'Member type, new member type' });
    expect(newType).toHaveFocus();
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText('Choose a member type.')).toBeVisible();
    expect(screen.getByText('Choose a rate category.')).toBeVisible();
    expect(newType).toHaveFocus();
  });

  it('saves a completed override and lists a taken member type as unavailable', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await openTab(user);
    await user.click(screen.getByRole('button', { name: 'Add Member Type Override' }));
    await user.click(screen.getByRole('combobox', { name: 'Member type, new member type' }));
    // Honorary Member already has an override.
    expect(await screen.findByRole('option', { name: 'Honorary Member' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('option', { name: 'Junior Member' }));
    await choose(user, 'Default rate category, Junior Member', 'Comp Rate');
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const rows = save.mock.calls[0][0].defaultRateCategories.memberTypeOverrides;
    expect(rows.map((r) => [r.memberTypeId, r.rateCategoryId])).toEqual([
      ['honorary', 'rc-comp'],
      ['junior', 'rc-comp'],
    ]);
  });

  it('confirms before removing an override and keeps it on Cancel', async () => {
    const user = userEvent.setup();
    renderPage();
    await openTab(user);
    await user.click(screen.getByRole('button', { name: 'Remove override for Honorary Member' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm' });
    expect(dialog).toHaveTextContent('Are you sure you want to delete member type override?');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Member type, Honorary Member' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remove override for Honorary Member' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Confirm' })).getByRole('button', {
        name: 'OK',
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('combobox', { name: 'Member type, Honorary Member' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      screen.getByRole('button', { name: saveButtonName('System Settings') }),
    ).not.toHaveAttribute('aria-disabled');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add Member Type Override' })).toHaveFocus(),
    );
  });

  it('moves to this tab and focuses the field when a save is refused from another tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await openTab(user);
    await user.click(screen.getByRole('button', { name: 'Add Member Type Override' }));
    await user.click(screen.getByRole('tab', { name: 'Online Booking' }));
    expect(
      screen.queryByRole('table', { name: 'Default rate categories' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    expect(await screen.findByRole('table', { name: 'Default rate categories' })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Member type, new member type' })).toHaveFocus(),
    );
  });

  it('shows the page error and keeps the draft when the save fails', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    vi.spyOn(client.systemSettings, 'save').mockRejectedValue(new Error('down'));
    renderPage(client);
    await openTab(user);
    await choose(user, 'Owners default rate category', 'Comp Rate');
    await user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));
    expect(await screen.findByText('System Settings could not be saved. Try again.')).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Owners default rate category' }),
    ).toHaveTextContent('Comp Rate');
  });

  it('is read only in View-only mode: selects disabled, no Add or Remove', async () => {
    const user = userEvent.setup();
    render(
      <ApiProvider client={createMockClient()}>
        <GrantedAccess granted={[pagePermission('primary-setup')]}>
          <SystemSettingsProvider>
            <MemoryRouter>
              <RequireAccess pageId="primary-setup">
                <SystemSettings />
              </RequireAccess>
            </MemoryRouter>
          </SystemSettingsProvider>
        </GrantedAccess>
      </ApiProvider>,
    );
    await openTab(user);
    expect(screen.getByRole('combobox', { name: 'Members default rate category' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      screen.queryByRole('button', { name: 'Add Member Type Override' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove override/ })).not.toBeInTheDocument();
  });
});
