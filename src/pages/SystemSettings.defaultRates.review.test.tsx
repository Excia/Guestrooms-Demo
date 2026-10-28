// Default Rate Categories tab: row ids, deleted choices, when errors show (review of ticket 189).
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { mockSystemSettings } from '../api/systemSettingsData';
import type { ApiClient, DefaultRateCategories } from '../api/types';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess, saveButtonName } from '../app/testing';
import SystemSettings from './SystemSettings';

function clientWith(defaults: Partial<DefaultRateCategories>): ApiClient {
  const client = createMockClient();
  const base = mockSystemSettings();
  vi.spyOn(client.systemSettings, 'get').mockResolvedValue({
    ...base,
    defaultRateCategories: { ...base.defaultRateCategories, ...defaults },
  });
  return client;
}

function renderPage(client: ApiClient) {
  return render(
    <ApiProvider client={client}>
      <SystemSettingsProvider>
        <GrantedAccess>
          <MemoryRouter initialEntries={['/admin/primary-setup']}>
            <SystemSettings />
          </MemoryRouter>
        </GrantedAccess>
      </SystemSettingsProvider>
    </ApiProvider>,
  );
}

type User = ReturnType<typeof userEvent.setup>;
async function openTab(user: User) {
  await screen.findByRole('combobox', { name: 'Time Zone' });
  await user.click(screen.getByRole('tab', { name: 'Default Rate Categories' }));
}
const save = (user: User) =>
  user.click(screen.getByRole('button', { name: saveButtonName('System Settings') }));

describe('override row ids', () => {
  it('stay distinct across a tab switch, so editing or removing one row touches only it', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const saveSpy = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await openTab(user);
    const add = () => user.click(screen.getByRole('button', { name: 'Add Member Type Override' }));
    await add();
    await user.click(screen.getByRole('tab', { name: 'Online Booking' }));
    await user.click(screen.getByRole('tab', { name: 'Default Rate Categories' }));
    await add();
    const empty = screen.getAllByRole('combobox', { name: 'Member type, new member type' });
    expect(empty).toHaveLength(2);
    expect(new Set(empty.map((e) => e.id)).size).toBe(2);

    // Edit the first new row only.
    await user.click(empty[0]);
    await user.click(await screen.findByRole('option', { name: 'Junior Member' }));
    expect(screen.getAllByRole('combobox', { name: 'Member type, new member type' })).toHaveLength(
      1,
    );
    await user.click(
      screen.getByRole('combobox', { name: 'Default rate category, Junior Member' }),
    );
    await user.click(await screen.findByRole('option', { name: 'Comp Rate' }));

    // Remove the other (still empty) new row.
    await user.click(screen.getByRole('button', { name: 'Remove override for new member type' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Confirm' })).getByRole('button', {
        name: 'OK',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('combobox', { name: 'Member type, new member type' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Member type, Junior Member' })).toBeVisible();

    await save(user);
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const rows = saveSpy.mock.calls[0][0].defaultRateCategories.memberTypeOverrides;
    expect(rows.map((r) => [r.memberTypeId, r.rateCategoryId])).toEqual([
      ['honorary', 'rc-comp'],
      ['junior', 'rc-comp'],
    ]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });

  it('do not collide with the ids the backend made for saved rows', async () => {
    const user = userEvent.setup();
    renderPage(
      clientWith({
        memberTypeOverrides: [
          { id: '1', memberTypeId: 'full', rateCategoryId: 'rc-comp' },
          { id: 'override-new-2', memberTypeId: 'social', rateCategoryId: 'rc-comp' },
        ],
      }),
    );
    await openTab(user);
    await user.click(screen.getByRole('button', { name: 'Add Member Type Override' }));
    await user.click(screen.getByRole('button', { name: 'Add Member Type Override' }));
    const ids = screen.getAllByRole('combobox', { name: /^Member type, / }).map((e) => e.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
});

describe('a saved choice that no longer exists', () => {
  it('shows an error on its select, refuses the save, and clears once another is chosen', async () => {
    const user = userEvent.setup();
    const client = clientWith({ owner: 'rc-deleted' });
    const saveSpy = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await openTab(user);
    const owners = screen.getByRole('combobox', { name: 'Owners default rate category' });
    expect(owners).toHaveAttribute('aria-invalid', 'true');
    expect(owners).toHaveAccessibleDescription(
      'This rate category no longer exists. Choose another.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('no longer exists');

    // Nothing changed yet, so Save is idle; the user must act. Pick another category.
    await user.click(owners);
    await user.click(await screen.findByRole('option', { name: 'Owner Rate' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(owners).not.toHaveAttribute('aria-invalid');
    await save(user);
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][0].defaultRateCategories.owner).toBe('rc-owner');
  });

  it('blocks a save made from another tab and moves to the stale select', async () => {
    const user = userEvent.setup();
    const client = clientWith({ member: 'rc-deleted' });
    const saveSpy = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await screen.findByRole('combobox', { name: 'Time Zone' });
    // Any edit makes the draft dirty so Save is live.
    await user.click(screen.getByRole('radio', { name: 'Run Automatically' }));
    await save(user);
    expect(saveSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Members default rate category' })).toHaveFocus(),
    );
  });
});

describe('when the tab shows errors', () => {
  it('keeps a just-added row calm and shows its messages, announced, after a refused save', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await openTab(user);
    await user.click(screen.getByRole('button', { name: 'Add Member Type Override' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const type = screen.getByRole('combobox', { name: 'Member type, new member type' });
    expect(type).not.toHaveAttribute('aria-invalid');
    await save(user);
    expect(await screen.findByText('Choose a member type.')).toHaveAttribute('role', 'alert');
    expect(type).toHaveAttribute('aria-invalid', 'true');
    expect(type).toHaveAccessibleDescription('Choose a member type.');
    // Fixed once the user chooses.
    await user.click(type);
    await user.click(await screen.findByRole('option', { name: 'Junior Member' }));
    expect(screen.queryByText('Choose a member type.')).not.toBeInTheDocument();
  });

  it('shows a repeated member type from the backend at once and focuses the later row', async () => {
    const user = userEvent.setup();
    const client = clientWith({
      memberTypeOverrides: [
        { id: '11', memberTypeId: 'full', rateCategoryId: 'rc-comp' },
        { id: '12', memberTypeId: 'full', rateCategoryId: 'rc-comp' },
      ],
    });
    const saveSpy = vi.spyOn(client.systemSettings, 'save');
    renderPage(client);
    await openTab(user);
    const full = screen.getAllByRole('combobox', { name: 'Member type, Full Member' });
    expect(full[0]).not.toHaveAttribute('aria-invalid');
    expect(full[1]).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('already has an override');
    // Make the draft dirty, then try to save: refused, focus on the repeated row.
    await user.click(screen.getByRole('combobox', { name: 'Owners default rate category' }));
    await user.click(await screen.findByRole('option', { name: 'Comp Rate' }));
    await save(user);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(full[1]).toHaveFocus();
  });
});
