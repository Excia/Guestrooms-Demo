import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { GrantedAccess } from '../app/testing';
import AddOnItems from './AddOnItems';

function renderPage(client: ApiClient = createMockClient()) {
  return render(
    <ApiProvider client={client}>
      <GrantedAccess>
        <MemoryRouter initialEntries={['/admin/add-on-items']}>
          <AddOnItems />
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

const loaded = () => screen.findByRole('textbox', { name: /Add-On Name/ });
const list = () => screen.getByRole('navigation', { name: 'Add-Ons' });

describe('Add-On Items page', () => {
  it('lists the add-ons with inactive ones last and selects the first', async () => {
    renderPage();
    await loaded();
    const items = within(list()).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Crib',
      'Late checkout',
      'Rollaway bed',
      'Welcome package',
      'Holiday decorations (retired)(Inactive)',
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Crib' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Add-On Name/)).toHaveValue('Crib');
    expect(screen.getByRole('radio', { name: 'Item' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'SKU' })).toHaveValue('Crib');
  });

  it('switches between Item and Combo', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Combo' }));
    expect(screen.getByRole('radio', { name: 'Combo' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Item' })).not.toBeChecked();
  });

  it('enables the nightly quantity stepper only while tracking, within 1 and 99', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    // Crib tracks 2 per night.
    const stepper = screen.getByRole('group', { name: 'Nightly Qty.' });
    expect(stepper).toHaveTextContent('2');
    await user.click(screen.getByRole('button', { name: 'Increase Nightly Qty.' }));
    expect(stepper).toHaveTextContent('3');
    await user.click(screen.getByRole('button', { name: 'Decrease Nightly Qty.' }));
    await user.click(screen.getByRole('button', { name: 'Decrease Nightly Qty.' }));
    await user.click(screen.getByRole('button', { name: 'Decrease Nightly Qty.' }));
    expect(stepper).toHaveTextContent('1');
    await user.click(screen.getByRole('switch', { name: 'Track Nightly Countdown' }));
    expect(screen.getByRole('button', { name: 'Increase Nightly Qty.' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease Nightly Qty.' })).toBeDisabled();
  });

  it('shows the end date only when "Configure active end date?" is checked', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    expect(screen.queryByLabelText('Active End Date')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Configure active end date?' }));
    expect(screen.getByLabelText('Active End Date')).toBeInTheDocument();
  });

  it('counts selected associations in the Locations and Room Types tabs', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    expect(screen.getByRole('tab', { name: 'Locations (3)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select none' }));
    expect(screen.getByRole('tab', { name: 'Locations (0)' })).toBeInTheDocument();
    expect(screen.getByText(/not offered on any reservation/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'North Lodge' }));
    expect(screen.getByRole('tab', { name: 'Locations (1)' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Room Types (2)' }));
    expect(screen.getByRole('checkbox', { name: 'King Room' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByRole('tab', { name: 'Room Types (3)' })).toBeInTheDocument();
  });

  it('stops the description at 400 characters and shows a counter', async () => {
    renderPage();
    await loaded();
    expect(screen.getByLabelText(/Description \(optional\)/)).toHaveAttribute('maxlength', '400');
    expect(screen.getByText(/^\d+ \/ 400$/)).toBeInTheDocument();
  });

  it('removes a photo; photos are optional', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Rollaway bed' }));
    await user.click(screen.getByRole('button', { name: 'Remove photo rollaway.jpg' }));
    expect(screen.getByText('0 of 50 photos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Add-On' }));
    expect((await screen.findAllByText('Add-On Saved')).length).toBeGreaterThan(0);
  });

  it('saves edits and shows the toast', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    const name = await loaded();
    await user.clear(name);
    await user.type(name, 'Baby crib');
    await user.click(screen.getByRole('button', { name: 'Save Add-On' }));
    expect((await screen.findAllByText('Add-On Saved')).length).toBeGreaterThan(0);
    expect((await client.addOns.list()).some((a) => a.name === 'Baby crib')).toBe(true);
    expect(screen.getByRole('heading', { level: 1, name: 'Baby crib' })).toBeInTheDocument();
  });

  it('creates a new add-on: default title, required name and SKU, Cancel instead of delete', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'New Add-On' }));
    expect(screen.getByRole('heading', { level: 1, name: 'New Add-On' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Add-On Name/)).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Delete add-on' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Add-On' }));
    expect(await screen.findByText('Enter an add-on name.')).toBeInTheDocument();
    expect(screen.getByText('Select a SKU.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Add-On Name/)).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Crib' })).toBeInTheDocument();
  });

  it('duplicates into a new, unsaved add-on with the values filled in', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Duplicate add-on' }));
    expect(screen.getByRole('heading', { level: 1, name: 'New Add-On' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Add-On Name/)).toHaveValue('Copy of Crib');
    expect(screen.getByRole('group', { name: 'Nightly Qty.' })).toHaveTextContent('2');
  });

  it('asks before leaving unsaved changes for another add-on', async () => {
    const user = userEvent.setup();
    renderPage();
    const name = await loaded();
    await user.type(name, '!');
    await user.click(within(list()).getByRole('button', { name: 'Rollaway bed' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('This add-on has not been saved.');
    await user.click(within(dialog).getByRole('button', { name: 'Leave without saving' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Rollaway bed' })).toBeInTheDocument(),
    );
  });

  it('deletes after confirmation and selects the next add-on', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Delete add-on' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Delete Crib?');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(within(list()).queryByRole('button', { name: 'Crib' })).not.toBeInTheDocument(),
    );
    expect((await client.addOns.list()).some((a) => a.id === 'addon-crib')).toBe(false);
  });

  it('keeps the add-on when the delete is cancelled', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Delete add-on' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(list()).getByRole('button', { name: 'Crib' })).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    renderPage(createMockClient({ scenario: 'error' }));
    expect(await screen.findByText('Add-Ons could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('opens on a new add-on when there are none', async () => {
    renderPage(createMockClient({ scenario: 'empty' }));
    await loaded();
    expect(screen.getByRole('heading', { level: 1, name: 'New Add-On' })).toBeInTheDocument();
  });

  it('keeps the saved add-on when the list refresh fails afterwards (no duplicate on retry)', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const listSpy = vi.spyOn(client.addOns, 'list');
    renderPage(client);
    const name = await loaded();
    listSpy.mockRejectedValueOnce(new Error('offline'));
    await user.clear(name);
    await user.type(name, 'Baby crib');
    await user.click(screen.getByRole('button', { name: 'Save Add-On' }));
    expect((await screen.findAllByText('Add-On Saved')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument();
    expect(within(list()).getByRole('button', { name: 'Baby crib' })).toBeInTheDocument();
  });

  it('removes the add-on locally when the list refresh fails after a delete', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const listSpy = vi.spyOn(client.addOns, 'list');
    renderPage(client);
    await loaded();
    listSpy.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Delete add-on' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(within(list()).queryByRole('button', { name: 'Crib' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/could not be deleted/)).not.toBeInTheDocument();
  });

  it('ignores locations and room types that no longer exist', async () => {
    const client = createMockClient();
    const real = await client.addOns.list();
    vi.spyOn(client.addOns, 'list').mockResolvedValue(
      real.map((a, i) =>
        i === 0
          ? {
              ...a,
              locationIds: [...a.locationIds, 'gone'],
              roomTypeIds: [...a.roomTypeIds, 'gone'],
            }
          : a,
      ),
    );
    renderPage(client);
    await loaded();
    expect(screen.getByRole('tab', { name: 'Locations (3)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Room Types (2)' })).toBeInTheDocument();
  });

  it('ties the SKU error to the input', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'New Add-On' }));
    await user.click(screen.getByRole('button', { name: 'Save Add-On' }));
    const sku = await screen.findByRole('combobox', { name: 'SKU' });
    expect(sku).toBeInvalid();
    expect(sku).toHaveAccessibleDescription('Select a SKU.');
  });
});
