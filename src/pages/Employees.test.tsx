import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError, type ApiClient } from '../api/types';
import type { Permission } from '../app/permissions';
import { GrantedAccess, saveButtonName } from '../app/testing';
import Employees from './Employees';

function renderPage(client: ApiClient = createMockClient(), granted?: readonly Permission[]) {
  return render(
    <ApiProvider client={client}>
      <GrantedAccess granted={granted}>
        <MemoryRouter initialEntries={['/admin/employees']}>
          <Employees />
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

const loaded = () => screen.findByRole('navigation', { name: 'Employees' });
const save = () => screen.getByRole('button', { name: saveButtonName('Employee') });
const pick = async (user: ReturnType<typeof userEvent.setup>, field: RegExp, option: string) => {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('Employees page', () => {
  it('lists active employees by name, inactive last, and shows the first one', async () => {
    renderPage();
    const nav = await loaded();
    const rows = within(nav).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Alex Moreno');
    expect(rows[rows.length - 1]).toHaveTextContent('Tom Hale');
    expect(rows[rows.length - 1]).toHaveTextContent('Inactive');
    expect(screen.getByRole('heading', { level: 1, name: 'Alex Moreno' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Employee' })).toHaveAttribute('readonly');
    expect(screen.getByRole('combobox', { name: /Employee Type/ })).toHaveTextContent(
      'Administrator',
    );
    expect(screen.getByRole('button', { name: 'Change Log' })).toBeInTheDocument();
    expect(save()).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows a loading indicator, then an error with Retry that reloads', async () => {
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

  it('shows the empty state with a new employee form', async () => {
    renderPage(createMockClient({ scenario: 'empty' }));
    await loaded();
    expect(screen.getByText(/No employees have access yet/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'New Employee' })).toBeInTheDocument();
  });

  it('adds an employee from the directory with a type and permission set', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const saveSpy = vi.spyOn(client.employees, 'save');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'New Employee' }));
    expect(screen.getByRole('heading', { level: 1, name: 'New Employee' })).toBeInTheDocument();
    await user.click(save());
    // Required fields: the first problem takes focus and is described.
    const person = screen.getByRole('combobox', { name: /^Employee( \*)?$/ });
    expect(person).toHaveFocus();
    expect(person).toHaveAccessibleDescription('Select an employee.');
    expect(saveSpy).not.toHaveBeenCalled();

    await user.type(person, 'sam');
    await user.click(await screen.findByRole('option', { name: 'Sam Rivera' }));
    await pick(user, /Permission Set/, 'Front Desk');
    await user.click(save());
    expect((await screen.findAllByText('Employee Saved')).length).toBeGreaterThan(0);
    expect(saveSpy.mock.calls[0][0]).toEqual({
      id: 'dir-1',
      role: 'staff',
      permissionSetId: 'set-front-desk',
      active: true,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Sam Rivera' })).toBeInTheDocument();
    expect(save()).toHaveAttribute('aria-disabled', 'true');
  });

  it('needs no permission set for an administrator', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'New Employee' }));
    await pick(user, /Employee Type/, 'Administrator');
    expect(screen.getByRole('combobox', { name: /Permission Set/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('Administrators have access to everything.')).toBeInTheDocument();
  });

  it('edits the type and permission set of an employee and saves', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    const nav = await loaded();
    await user.click(within(nav).getByRole('button', { name: 'Dana Whitfield' }));
    await pick(user, /Employee Type/, 'Manager');
    await pick(user, /Permission Set/, 'Accounting');
    await user.click(save());
    expect((await screen.findAllByText('Employee Saved')).length).toBeGreaterThan(0);
    expect((await client.employees.list()).find((e) => e.id === 'emp-3')).toMatchObject({
      role: 'manager',
      permissionSetId: 'set-accounting',
    });
  });

  it('deactivates an employee, who then moves to the end with the Inactive tag', async () => {
    const user = userEvent.setup();
    renderPage();
    const nav = await loaded();
    await user.click(within(nav).getByRole('button', { name: 'Dana Whitfield' }));
    await user.click(screen.getByRole('switch', { name: 'Active' }));
    await user.click(save());
    await screen.findAllByText('Employee Saved');
    const rows = within(nav).getAllByRole('listitem');
    // Inactive employees are last, by name: Dana before Tom.
    expect(rows[rows.length - 2]).toHaveTextContent('Dana Whitfield');
    expect(rows[rows.length - 2]).toHaveTextContent('Inactive');
  });

  it('refuses to demote the only active administrator without calling the server', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const saveSpy = vi.spyOn(client.employees, 'save');
    renderPage(client);
    await loaded();
    await pick(user, /Employee Type/, 'Manager');
    await pick(user, /Permission Set/, 'Accounting');
    await user.click(save());
    expect(await screen.findByText(/only active administrator/)).toBeInTheDocument();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('removes an employee from the three-dot menu after a confirmation', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    const nav = await loaded();
    await user.click(within(nav).getByRole('button', { name: 'Dana Whitfield' }));
    await user.click(screen.getByRole('button', { name: 'Dana Whitfield more options' }));
    expect(screen.queryByRole('menuitem', { name: /Copy/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Remove Employee' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this employee?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(within(nav).queryByRole('button', { name: 'Dana Whitfield' })).not.toBeInTheDocument(),
    );
    expect((await client.employees.list()).some((e) => e.id === 'emp-3')).toBe(false);
  });

  it('blocks removing the only active administrator', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Alex Moreno more options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Remove Employee' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cannot remove this employee' });
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  });

  it('shows a message when the save fails and keeps the edits', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const failing = vi.fn().mockRejectedValue(new ApiError(500, 'boom'));
    renderPage({ ...client, employees: { ...client.employees, save: failing } });
    const nav = await loaded();
    await user.click(within(nav).getByRole('button', { name: 'Dana Whitfield' }));
    await user.click(screen.getByRole('switch', { name: 'Active' }));
    await user.click(save());
    expect(
      await screen.findByText('The employee could not be saved. Try again.'),
    ).toBeInTheDocument();
    expect(save()).not.toHaveAttribute('aria-disabled');
  });

  it('asks before switching employees with unsaved changes', async () => {
    const user = userEvent.setup();
    renderPage();
    const nav = await loaded();
    await user.click(within(nav).getByRole('button', { name: 'Dana Whitfield' }));
    await user.click(screen.getByRole('switch', { name: 'Active' }));
    await user.click(within(nav).getByRole('button', { name: 'Marcus Bell' }));
    expect(
      await screen.findByRole('dialog', { name: 'This employee has not been saved.' }),
    ).toBeInTheDocument();
  });

  it('is view-only without employees.edit: no New, Save, menu, and fields are disabled', async () => {
    renderPage(createMockClient(), ['page.employees']);
    await loaded();
    expect(screen.getByText('Employees are view-only for your account.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Employee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more options/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Employee Type/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Active' })).toBeDisabled();
  });
});
