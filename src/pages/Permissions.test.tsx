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
  it('mirrors the legacy table: Management and Staff columns, one Admin Setup row, legacy rows in order', async () => {
    renderPage();
    const table = await loaded();
    expect(screen.getByRole('heading', { level: 1, name: 'Permissions' })).toBeInTheDocument();
    expect(
      screen.getByText('All Admins are granted all permissions by default in the system.'),
    ).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Management' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Staff' })).toBeInTheDocument();
    // No sections, no per-page setup rows, no PIN row.
    expect(screen.queryByRole('combobox', { name: /^Rooms,/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/PIN/)).not.toBeInTheDocument();
    const labels = within(table)
      .getAllByRole('rowheader')
      .map((h) => h.firstElementChild?.textContent);
    expect(labels).toEqual([
      'Admin Setup',
      'Closure Events + Details',
      'Reservation Events + Core Details',
      'Change Reservation Room',
      'Change Reservation Location',
      'Change Reservation Room Type',
      'Change Rate Category',
      'Adjust Room Rate',
      'Check In Room',
      'Undo Check In',
      'Check Out Reservation',
      'Reservation Full Details',
      'View Private Notes',
      'Night Audit',
      'Room Block',
      'Reporting',
      'Operation Reports',
      'Financial Reports',
      'Folio',
      'Add Manual Charge / Credit',
      'Add Positive Deposit / Payment',
      'Add Negative Deposit / Payment',
      'Split Folio',
      'Settle Folio',
      'Manually Reopen / Close Folio',
      'Non-Members',
    ]);
    expect(screen.getByText('from unassigned or other room')).toBeInTheDocument();
    expect(screen.getByText('manual check out prior to set check out time')).toBeInTheDocument();
    expect(screen.getByText('guests, add-ons, notes')).toBeInTheDocument();
    expect(screen.getByText('history and manual night audit run (create)')).toBeInTheDocument();
    // Legacy defaults.
    expect(screen.getByRole('combobox', { name: 'Admin Setup, Management' })).toHaveTextContent(
      'View',
    );
    expect(screen.getByRole('combobox', { name: 'Admin Setup, Staff' })).toHaveTextContent(
      'No Access',
    );
    expect(
      screen.getByRole('combobox', { name: 'Reservation Events + Core Details, Staff' }),
    ).toHaveTextContent('View');
    expect(screen.getByRole('combobox', { name: 'Check In Room, Management' })).toHaveTextContent(
      'On Check-In Date Only',
    );
    expect(screen.getByRole('combobox', { name: 'Check In Room, Staff' })).toHaveTextContent(
      'Never',
    );
    expect(screen.getByRole('combobox', { name: 'Reporting, Staff' })).toHaveTextContent(
      'No Access',
    );
    expect(
      screen.getByRole('combobox', { name: 'Manually Reopen / Close Folio, Management' }),
    ).toHaveTextContent('No');
    // The Staff column has no report rows.
    expect(
      screen.queryByRole('combobox', { name: 'Operation Reports, Staff' }),
    ).not.toBeInTheDocument();
    expect(save()).toHaveAttribute('aria-disabled', 'true');
  });

  it('reads as the Booking Rules chart: bordered grid, column and row headers, gray N/A cells', async () => {
    renderPage();
    const table = await loaded();
    expect(table).toHaveStyle({ tableLayout: 'fixed' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Permission', 'Management', 'Staff']);
    // Every body cell has the shared matrix border; the two Staff report cells are the N/A cells.
    const cells = within(table).getAllByRole('cell');
    expect(cells.length).toBe(26 * 2);
    for (const c of cells) expect(c).toHaveStyle({ borderStyle: 'solid' });
    const na = cells.filter((c) => c.textContent === 'N/A');
    expect(na).toHaveLength(2);
    // The table sits in a scrolling wrapper (desktop-first, scrolls below 1200px).
    expect(table.parentElement).toHaveStyle({ overflowX: 'auto' });
  });

  it('offers the legacy options row by row', async () => {
    renderPage();
    await loaded();
    const options = async (name: string) => {
      await userEvent.click(screen.getByRole('combobox', { name }));
      const list = (await screen.findAllByRole('option')).map((o) => o.textContent);
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('option')).not.toBeInTheDocument());
      return list;
    };
    expect(await options('Admin Setup, Staff')).toEqual(['View', 'No Access']);
    expect(await options('Closure Events + Details, Staff')).toEqual([
      'Create + Edit',
      'Edit',
      'View',
      'No Access',
    ]);
    expect(await options('Reservation Full Details, Staff')).toEqual(['Edit', 'View', 'No Access']);
    expect(await options('Reporting, Management')).toEqual(['Edit', 'No Access']);
    expect(await options('Folio, Staff')).toEqual(['Edit', 'View', 'No Access']);
    expect(await options('Night Audit, Staff')).toEqual([
      'Create + Edit',
      'Edit',
      'View',
      'No Access',
    ]);
    expect(await options('Check In Room, Staff')).toEqual([
      'AnyTime',
      'On Check-In Date Only',
      'Never',
    ]);
    expect(await options('Undo Check In, Staff')).toEqual(['Yes', 'No']);
  });

  it('cascades Reservation Events for Staff and shows N/A under No Access', async () => {
    renderPage();
    await loaded();
    await choose('Reservation Events + Core Details, Staff', 'Edit');
    expect(screen.getByRole('combobox', { name: 'Check In Room, Staff' })).toHaveTextContent(
      'AnyTime',
    );
    expect(screen.getByRole('combobox', { name: 'Undo Check In, Staff' })).toHaveTextContent('Yes');
    await choose('Reservation Events + Core Details, Staff', 'View');
    expect(screen.getByRole('combobox', { name: 'Check In Room, Staff' })).toHaveTextContent(
      'Never',
    );
    await choose('Reservation Events + Core Details, Staff', 'No Access');
    expect(
      screen.queryByRole('combobox', { name: 'Undo Check In, Staff' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Undo Check In, Management' })).toBeInTheDocument();
  });

  it('saves a change, shows Saved and maps Admin Setup onto every setup page', async () => {
    const client = createMockClient();
    const spy = vi.spyOn(client.permissions, 'savePermissionSets');
    renderPage(client);
    await loaded();
    await choose('Admin Setup, Staff', 'View');
    expect(save()).not.toHaveAttribute('aria-disabled');
    await userEvent.click(save());
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    const sent = spy.mock.calls[0]?.[0].find((s) => s.id === 'staff');
    expect(Object.values(sent?.setup ?? {}).every((l) => l === 'view')).toBe(true);
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
    await choose('Admin Setup, Staff', 'View');
    await userEvent.click(save());
    expect(
      await screen.findByText('You do not have permission to change permissions.'),
    ).toBeInTheDocument();
    await userEvent.click(save());
    expect(
      await screen.findByText('Permissions could not be saved. Try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Admin Setup, Staff' })).toHaveTextContent('View');
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
    expect(screen.getByRole('combobox', { name: 'Admin Setup, Staff' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
