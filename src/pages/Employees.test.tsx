import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError, type ApiClient } from '../api/types';
import type { Permission } from '../app/permissions';
import { GrantedAccess, saveButtonName } from '../app/testing';
import RequireAccess from '../components/RequireAccess';
import Employees from './Employees';

function renderPage(client: ApiClient = createMockClient(), granted?: readonly Permission[]) {
  return render(
    <ApiProvider client={client}>
      <GrantedAccess granted={granted}>
        <MemoryRouter initialEntries={['/admin/employees']}>
          <Link to="/schedule">Go to schedule</Link>
          {granted ? (
            <RequireAccess pageId="employees">
              <Employees />
            </RequireAccess>
          ) : (
            <Employees />
          )}
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

const loaded = () => screen.findByRole('list', { name: 'Employees' });
const save = () => screen.getByRole('button', { name: saveButtonName('Employees') });
const typeOf = (name: string) => screen.getByRole('combobox', { name: `Employee Type, ${name}` });
const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  field: HTMLElement,
  option: string,
) => {
  await user.click(field);
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('Employees page (legacy EmployeesEdit)', () => {
  it('lists every employee as a read-only Name and an Employee Type, in the server order', async () => {
    renderPage();
    const list = await loaded();
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    const rows = within(list).getAllByRole('group');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Alex Moreno',
      'Marcus Bell',
      'Dana Whitfield',
      'Priya Nair',
      'Tom Hale',
      'Grace Okafor',
    ]);
    const name = within(rows[1]).getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('Marcus Bell');
    expect(name).toHaveAttribute('readonly');
    expect(typeOf('Marcus Bell')).toHaveTextContent('Manager');
    expect(screen.getByRole('heading', { level: 1, name: 'Employees' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('aria-current', 'page');
    // No permission set, Active switch or list of items on the legacy screen.
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText(/Permission Set/)).not.toBeInTheDocument();
    expect(save()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Add Employee' })).toBeInTheDocument();
  });

  it('offers the three legacy types', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(typeOf('Marcus Bell'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Administrator',
      'Manager',
      'Staff',
    ]);
  });

  it('shows loading, then an error with Retry that reloads', async () => {
    const client = createMockClient();
    const list = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
      .mockImplementation(() => client.employees.list());
    renderPage({ ...client, employees: { ...client.employees, list } });
    expect(screen.getByRole('progressbar', { name: 'Loading Employees' })).toBeInTheDocument();
    expect(await screen.findByText('Employees could not be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await loaded()).toBeInTheDocument();
  });

  it('shows only the Add Employee button when there are no employees', async () => {
    renderPage(createMockClient({ scenario: 'empty' }));
    const list = await loaded();
    expect(within(list).queryAllByRole('group')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Add Employee' })).toBeInTheDocument();
  });

  it('changes a type and saves it; Save reads Saved afterwards', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const spy = vi.spyOn(client.employees, 'saveRoles');
    renderPage(client);
    await loaded();
    await choose(user, typeOf('Dana Whitfield'), 'Manager');
    expect(save()).not.toHaveAttribute('aria-disabled');
    await user.click(save());
    expect((await screen.findAllByText('Employees Saved')).length).toBeGreaterThan(0);
    expect(spy).toHaveBeenCalledWith([{ id: 'emp-3', role: 'manager' }]);
    expect(typeOf('Dana Whitfield')).toHaveTextContent('Manager');
    expect(save()).toHaveAttribute('aria-disabled', 'true');
  });

  it('adds an employee from the directory: lookup, type, one Save', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const spy = vi.spyOn(client.employees, 'saveRoles');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Employee' }));
    // Legacy: the add button is replaced by the new row; the lookup takes focus.
    expect(screen.queryByRole('button', { name: 'Add Employee' })).not.toBeInTheDocument();
    const lookup = screen.getByRole('combobox', { name: 'Add Employee' });
    expect(lookup).toHaveFocus();
    await user.type(lookup, 'sam');
    await user.click(await screen.findByRole('option', { name: 'Sam Rivera' }));
    await choose(
      user,
      screen.getByRole('combobox', { name: 'Employee Type, new employee' }),
      'Staff',
    );
    await user.click(save());
    expect((await screen.findAllByText('Employees Saved')).length).toBeGreaterThan(0);
    expect(spy).toHaveBeenCalledWith([{ id: 'dir-1', role: 'staff' }]);
    const list = screen.getByRole('list', { name: 'Employees' });
    expect(within(list).getByRole('group', { name: 'Sam Rivera' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Employee' })).toBeInTheDocument();
  });

  it('refuses a new row without a type in the legacy validation dialog', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const spy = vi.spyOn(client.employees, 'saveRoles');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Employee' }));
    await user.type(screen.getByRole('combobox', { name: 'Add Employee' }), 'sam');
    await user.click(await screen.findByRole('option', { name: 'Sam Rivera' }));
    await user.click(save());
    const dialog = await screen.findByRole('dialog', { name: 'Validation Error(s)' });
    expect(within(dialog).getByText('Please correct the following errors:')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Please select an employee and an employee type.'),
    ).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('cancels the new row with its remove button, and disables Remove on the others meanwhile', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Employee' }));
    expect(screen.getByRole('button', { name: 'Remove Marcus Bell' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove new employee' }));
    expect(screen.queryByRole('group', { name: 'New employee' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Employee' })).toHaveFocus();
  });

  it('does not offer Remove or a type change for the only administrator, until another is promoted', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    expect(screen.queryByRole('button', { name: 'Remove Alex Moreno' })).not.toBeInTheDocument();
    expect(typeOf('Alex Moreno')).toHaveAttribute('aria-disabled', 'true');
    expect(typeOf('Alex Moreno')).toHaveAccessibleDescription(/only administrator/);
    await choose(user, typeOf('Marcus Bell'), 'Administrator');
    expect(typeOf('Alex Moreno')).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Remove Alex Moreno' })).toBeInTheDocument();
  });

  it('removes after the legacy confirmation at once, without Save; unsaved type edits stay', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const remove = vi.spyOn(client.employees, 'remove');
    renderPage(client);
    const list = await loaded();
    await choose(user, typeOf('Dana Whitfield'), 'Manager');
    await user.click(screen.getByRole('button', { name: 'Remove Priya Nair' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm' });
    expect(
      within(dialog).getByText('Are you sure you want to remove this Employee?'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(within(list).queryByRole('group', { name: 'Priya Nair' })).not.toBeInTheDocument(),
    );
    expect(remove).toHaveBeenCalledWith('emp-4');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(typeOf('Dana Whitfield')).toHaveTextContent('Manager');
    expect(save()).not.toHaveAttribute('aria-disabled');
    // The person can be added again.
    expect((await client.employees.listCandidates()).some((c) => c.id === 'emp-4')).toBe(true);
  });

  it('keeps the list when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const remove = vi.spyOn(client.employees, 'remove');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove Priya Nair' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(remove).not.toHaveBeenCalled();
  });

  it('explains a failed remove inside the dialog (409, 403, other)', async () => {
    for (const [status, text] of [
      [409, /at least one active administrator/],
      [403, 'You may not remove employees.'],
      [500, 'The employee could not be removed. Try again.'],
    ] as const) {
      const user = userEvent.setup();
      const client = createMockClient();
      const view = renderPage({
        ...client,
        employees: {
          ...client.employees,
          remove: vi.fn().mockRejectedValue(new ApiError(status, 'x')),
        },
      });
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Remove Priya Nair' }));
      const dialog = await screen.findByRole('dialog', { name: 'Confirm' });
      await user.click(within(dialog).getByRole('button', { name: 'OK' }));
      expect(await within(dialog).findByText(text)).toBeInTheDocument();
      view.unmount();
    }
  });

  it('treats a 404 on remove as already gone', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const list = vi
      .fn()
      .mockImplementationOnce(() => client.employees.list())
      .mockImplementation(async () =>
        (await client.employees.list()).filter((e) => e.id !== 'emp-4'),
      );
    renderPage({
      ...client,
      employees: {
        ...client.employees,
        list,
        remove: vi.fn().mockRejectedValue(new ApiError(404, 'gone')),
      },
    });
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove Priya Nair' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Confirm' })).getByRole('button', {
        name: 'OK',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('group', { name: 'Priya Nair' })).not.toBeInTheDocument();
  });

  it('shows a message when the save fails and keeps the edits', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage({
      ...client,
      employees: {
        ...client.employees,
        saveRoles: vi.fn().mockRejectedValue(new ApiError(500, 'boom')),
      },
    });
    await loaded();
    await choose(user, typeOf('Dana Whitfield'), 'Manager');
    await user.click(save());
    expect(await screen.findByText('Employees could not be saved. Try again.')).toBeInTheDocument();
    expect(typeOf('Dana Whitfield')).toHaveTextContent('Manager');
    expect(save()).not.toHaveAttribute('aria-disabled');
  });

  it('asks before leaving with unsaved changes (also with an empty add row)', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before leaving when a row is being added', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Employee' }));
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(
      await screen.findByRole('dialog', { name: 'Employees have not been saved.' }),
    ).toBeInTheDocument();
  });

  it('is view-only without employees.edit: no Add, Save or Remove, fields disabled', async () => {
    renderPage(createMockClient(), ['page.employees']);
    await loaded();
    expect(screen.getByTestId('read-only-note')).toHaveTextContent('View only');
    expect(screen.queryByRole('button', { name: 'Add Employee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    expect(typeOf('Marcus Bell')).toHaveAttribute('aria-disabled', 'true');
  });

  it('says there are no employees for a view-only user with none', async () => {
    renderPage(createMockClient({ scenario: 'empty' }), ['page.employees']);
    await loaded();
    expect(screen.getByText('No employees.')).toBeInTheDocument();
  });

  it('shows a message for 409 and 422 from the save and keeps the edits', async () => {
    for (const [status, text] of [
      [409, /at least one active administrator/],
      [422, /not valid/],
    ] as const) {
      const user = userEvent.setup();
      const client = createMockClient();
      const view = renderPage({
        ...client,
        employees: {
          ...client.employees,
          saveRoles: vi.fn().mockRejectedValue(new ApiError(status, 'x')),
        },
      });
      await loaded();
      await choose(user, typeOf('Dana Whitfield'), 'Manager');
      await user.click(save());
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(typeOf('Dana Whitfield')).toHaveTextContent('Manager');
      view.unmount();
    }
  });

  it('saves from the leave prompt and then leaves', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const spy = vi.spyOn(client.employees, 'saveRoles');
    renderPage(client);
    await loaded();
    await choose(user, typeOf('Dana Whitfield'), 'Manager');
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    const dialog = await screen.findByRole('dialog', { name: 'Employees have not been saved.' });
    await user.click(within(dialog).getByRole('button', { name: 'Save now' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith([{ id: 'emp-3', role: 'manager' }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not offer a saved person again, and offers a removed one, when the refresh fails', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const failRefresh = vi
      .fn()
      .mockImplementationOnce(() => client.employees.list())
      .mockRejectedValue(new ApiError(500, 'boom'));
    renderPage({ ...client, employees: { ...client.employees, list: failRefresh } });
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Employee' }));
    await user.type(screen.getByRole('combobox', { name: 'Add Employee' }), 'sam');
    await user.click(await screen.findByRole('option', { name: 'Sam Rivera' }));
    await choose(
      user,
      screen.getByRole('combobox', { name: 'Employee Type, new employee' }),
      'Staff',
    );
    await user.click(save());
    await screen.findAllByText('Employees Saved');
    // Remove Priya: the refresh fails again, the lists are patched locally.
    await user.click(screen.getByRole('button', { name: 'Remove Priya Nair' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Confirm' })).getByRole('button', {
        name: 'OK',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add Employee' }));
    await user.click(screen.getByRole('combobox', { name: 'Add Employee' }));
    expect(await screen.findByRole('option', { name: 'Priya Nair' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Sam Rivera' })).not.toBeInTheDocument();
  });
});
