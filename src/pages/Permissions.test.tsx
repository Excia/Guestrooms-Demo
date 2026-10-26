import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError, type ApiClient } from '../api/types';
import { pagePermission } from '../app/permissions';
import { GrantedAccess, saveButtonName } from '../app/testing';
import RequireAccess from '../components/RequireAccess';
import Permissions from './Permissions';

function renderPage(client: ApiClient = createMockClient(), granted?: readonly string[]) {
  return render(
    <ApiProvider client={client}>
      <GrantedAccess granted={granted as never}>
        <MemoryRouter>
          <RequireAccess pageId="permissions">
            <Permissions />
          </RequireAccess>
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

const loaded = () => screen.findByRole('table', { name: 'Permission sets' });
const save = () => screen.getByRole('button', { name: saveButtonName('Permissions') });

async function choose(name: string, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

describe('Permissions page', () => {
  it('shows one column per set with Admin Setup, Access, Function and PIN rows', async () => {
    renderPage();
    const table = await loaded();
    expect(screen.getByRole('heading', { level: 1, name: 'Permissions' })).toBeInTheDocument();
    expect(screen.getByText(/All Admins are granted all permissions/)).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Management' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Rooms, Management' })).toHaveTextContent('View');
    expect(screen.getByRole('combobox', { name: 'Rooms, Staff' })).toHaveTextContent('No Access');
    expect(screen.getByRole('combobox', { name: 'Night Audit, Staff' })).toHaveTextContent('View');
    expect(screen.getByRole('combobox', { name: 'Check In Room, Staff' })).toHaveTextContent(
      'On Check-In Date Only',
    );
    expect(screen.getByRole('combobox', { name: 'Split Folio, Management' })).toHaveTextContent(
      'Yes',
    );
    expect(
      screen.getByRole('combobox', { name: 'Authorize Overrides with PIN, Management' }),
    ).toHaveTextContent('Yes');
    expect(save()).toHaveAttribute('aria-disabled', 'true');
  });

  it('offers No Access, View and Edit for a setup page and the legacy levels for areas', async () => {
    renderPage();
    await loaded();
    await userEvent.click(screen.getByRole('combobox', { name: 'Rooms, Staff' }));
    // Like the legacy screen: View or No Access only; Edit is for administrators.
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      'No Access',
      'View',
    ]);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('combobox', { name: 'Reporting, Staff' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      'Edit',
      'No Access',
    ]);
  });

  it('marks function rows N/A when their area is No Access', async () => {
    renderPage();
    await loaded();
    await choose('Folio, Staff', 'No Access');
    expect(screen.queryByRole('combobox', { name: 'Split Folio, Staff' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Split Folio, Management' })).toBeInTheDocument();
  });

  it('saves a change, shows Saved and stores it', async () => {
    const client = createMockClient();
    const spy = vi.spyOn(client.permissions, 'savePermissionSets');
    renderPage(client);
    await loaded();
    await choose('Rooms, Staff', 'View');
    expect(save()).not.toHaveAttribute('aria-disabled');
    await userEvent.click(save());
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0]?.[0].find((s) => s.id === 'staff')?.setup.rooms).toBe('view');
    expect((await screen.findAllByText('Permissions Saved')).length).toBeGreaterThan(0);
    expect(save()).toHaveAttribute('aria-disabled', 'true');
    expect(
      (await client.permissions.getPermissionSets()).find((s) => s.id === 'staff')?.setup.rooms,
    ).toBe('view');
  });

  it('keeps the changes and says why when the save is refused or fails', async () => {
    const client = createMockClient();
    const fail = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(403, 'no', { code: 'forbidden' }))
      .mockRejectedValueOnce(new ApiError(500, 'boom'));
    renderPage({ ...client, permissions: { ...client.permissions, savePermissionSets: fail } });
    await loaded();
    await choose('Rooms, Staff', 'View');
    await userEvent.click(save());
    expect(
      await screen.findByText('You do not have permission to change permissions.'),
    ).toBeInTheDocument();
    await userEvent.click(save());
    expect(
      await screen.findByText('Permissions could not be saved. Try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Rooms, Staff' })).toHaveTextContent('View');
  });

  it('shows an error with Retry that reloads', async () => {
    const client = createMockClient();
    const get = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
      .mockImplementation(() => client.permissions.getPermissionSets());
    renderPage({ ...client, permissions: { ...client.permissions, getPermissionSets: get } });
    expect(screen.getByRole('progressbar', { name: 'Loading Permissions' })).toBeInTheDocument();
    expect(await screen.findByText('Permissions could not be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await loaded()).toBeInTheDocument();
  });

  it('says there is nothing to edit when there are no sets', async () => {
    renderPage(createMockClient({ scenario: 'empty' }));
    expect(await screen.findByText('There are no permission sets to edit.')).toBeInTheDocument();
  });

  it('is read-only for a user who may only view the page', async () => {
    renderPage(createMockClient(), [pagePermission('permissions')]);
    await loaded();
    expect(screen.getByTestId('read-only-note')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: saveButtonName('Permissions') }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Rooms, Staff' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
