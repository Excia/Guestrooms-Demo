import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess } from '../app/testing';
import { blankRateCategory } from '../app/rateCategories';
import RateCategories from './RateCategories';

function renderPage(client: ApiClient = createMockClient(), withSettings = false) {
  const page = (
    <MemoryRouter initialEntries={['/admin/rate-categories']}>
      <RateCategories />
    </MemoryRouter>
  );
  return render(
    <ApiProvider client={client}>
      <GrantedAccess>
        {withSettings ? <SystemSettingsProvider>{page}</SystemSettingsProvider> : page}
      </GrantedAccess>
    </ApiProvider>,
  );
}

const loaded = () => screen.findByRole('textbox', { name: /Rate Category Name/ });
const list = () => screen.getByRole('navigation', { name: 'Rate Categories' });
const sku = { id: 'sku-room-guest', label: 'Room night, non-member' };

describe('Rate Categories page', () => {
  it('lists the four categories, inactive ones last, and opens the first', async () => {
    const client = createMockClient();
    await client.rateCategories.save({
      ...blankRateCategory('2025-01-01', ['rt-king']),
      endDate: '2025-12-31',
      name: 'Aardvark Special',
      sku,
    });
    renderPage(client);
    await loaded();
    expect(
      within(list())
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Comp Rate',
      'Member Rate',
      'Non-Member Rate',
      'Owner Rate',
      'Aardvark Special(Inactive)',
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Comp Rate' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'SKU' })).toHaveValue('Room night, complimentary');
    expect(screen.getByRole('tab', { name: 'Room Types (3)' })).toBeInTheDocument();
  });

  it('has a Change Log button', async () => {
    renderPage();
    await loaded();
    expect(screen.getByRole('button', { name: /Change Log/ })).toBeInTheDocument();
  });

  it('shows one row per associated room type and season, with the default season first', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    const table = await screen.findByRole('table', { name: 'Rates by season and room type' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual([
      'Season / Special Rates',
      'Room Type',
      'Standard Base',
      'Mon',
      'Tues',
      'Weds',
      'Thurs',
      'Fri',
      'Sat',
      'Sun',
      'Guest 2',
      'Guest 3',
      'Guest 4+',
      'Child',
    ]);
    // Three seasons, three room types each.
    expect(within(table).getAllByRole('rowheader')).toHaveLength(9);
    expect(
      within(table).getByText(/If no other seasons or special rates apply/),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Default, King Room, Standard Base' })).toHaveValue(
      '180.00',
    );
    expect(screen.getByRole('textbox', { name: 'Summer, King Room, Standard Base' })).toHaveValue(
      '205.00',
    );
    expect(screen.getByLabelText('Summer start date')).toHaveValue('2026-06-01');
  });

  it('adds the alternative base rate columns that System Settings enables', async () => {
    renderPage(createMockClient(), true);
    await loaded();
    expect(
      await screen.findByRole('columnheader', { name: 'Alt Base (7+ nights)' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /14\+ nights/ })).not.toBeInTheDocument();
  });

  it('saves a changed rate and shows the toast', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    const cell = await screen.findByRole('textbox', { name: 'Default, King Room, Standard Base' });
    await user.clear(cell);
    await user.type(cell, '190.5');
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect((await screen.findAllByText('Rate Category Saved')).length).toBeGreaterThan(0);
    const stored = (await client.rateCategories.list()).find((c) => c.id === 'rc-member');
    expect(stored?.seasons[0].rates['rt-king'].standardBase).toBe(19050);
  });

  it('adds a season that must be named and dated before it can be saved', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Season' }));
    expect(screen.getByRole('textbox', { name: 'Season name' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect(await screen.findByText('Enter a season name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a start date.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Season name' })).toHaveFocus();
  });

  it('refuses overlapping seasons', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    await screen.findByRole('table', { name: 'Rates by season and room type' });
    await user.click(screen.getByRole('button', { name: 'Duplicate season Summer' }));
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect(await screen.findByText('Dates overlap Summer.')).toBeInTheDocument();
  });

  it('removes a season after confirmation, but not the default', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    await screen.findByRole('table', { name: 'Rates by season and room type' });
    expect(screen.queryByRole('button', { name: 'Remove season Default' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove season Holidays' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: 'Holidays, King Room, Standard Base' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('drops a room type from the table when it is unchecked', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('checkbox', { name: 'King Room' }));
    expect(screen.getByRole('tab', { name: 'Room Types (2)' })).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Default, King Room, Standard Base' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select none' }));
    expect(screen.getByText('No room types selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect(await screen.findByText('Select at least one room type.')).toBeInTheDocument();
  });

  it('creates a new category: required name and SKU, Cancel instead of delete', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'New Rate Category' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'New Rate Category' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete rate category' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect(await screen.findByText('Enter a rate category name.')).toBeInTheDocument();
    expect(screen.getByText('Select an item or combo SKU.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Rate Category Name/)).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Comp Rate' })).toBeInTheDocument();
  });

  it('refuses a name that is already in use', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'New Rate Category' }));
    await user.type(screen.getByLabelText(/Rate Category Name/), 'member rate');
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect(
      await screen.findByText('This name is already in use. Enter a unique name.'),
    ).toBeInTheDocument();
  });

  it('shows the end date only when "Configure active end date?" is checked', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    expect(screen.queryByLabelText('Active End Date')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Configure active end date?' }));
    expect(screen.getByLabelText('Active End Date')).toBeInTheDocument();
  });

  it('duplicates through the shared dialog and selects the copy', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    await user.click(screen.getByRole('button', { name: 'Duplicate rate category' }));
    const dialog = await screen.findByRole('dialog', { name: 'Duplicate Rate Category' });
    const field = within(dialog).getByRole('textbox');
    expect(field).toHaveValue('Member Rate (Copy)');
    await user.clear(field);
    await user.type(field, 'Member Rate');
    expect(
      within(dialog).getByText('This name is already in use. Enter a unique name.'),
    ).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, 'Trade Rate{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Trade Rate' })).toBeInTheDocument(),
    );
    expect((await client.rateCategories.list()).some((c) => c.name === 'Trade Rate')).toBe(true);
  });

  it('asks before leaving unsaved changes for another category', async () => {
    const user = userEvent.setup();
    renderPage();
    const name = await loaded();
    await user.type(name, '!');
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('This rate category has not been saved.');
    await user.click(within(dialog).getByRole('button', { name: 'Leave without saving' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Member Rate' })).toBeInTheDocument(),
    );
  });

  it('deletes an unused category after confirmation', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Owner Rate' }));
    await user.click(screen.getByRole('button', { name: 'Delete rate category' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Delete Owner Rate?');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(within(list()).queryByRole('button', { name: 'Owner Rate' })).not.toBeInTheDocument(),
    );
    expect((await client.rateCategories.list()).some((c) => c.id === 'rc-owner')).toBe(false);
  });

  it('explains why a category in use cannot be deleted', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    await user.click(screen.getByRole('button', { name: 'Delete rate category' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cannot delete this rate category' });
    expect(dialog).toHaveTextContent(/3 reservations use it/);
    expect(dialog).toHaveTextContent(/Members default rate category/);
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(list()).getByRole('button', { name: 'Member Rate' })).toBeInTheDocument();
  });

  it('shows the server answer when a delete is refused', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Owner Rate' }));
    // Someone else started using it since the page loaded.
    const { ApiError } = await import('../api/types');
    vi.spyOn(client.rateCategories, 'delete').mockRejectedValue(
      new ApiError(409, 'in use', { code: 'in-use' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete rate category' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/is in use and cannot be deleted/)).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    renderPage(createMockClient({ scenario: 'error' }));
    expect(await screen.findByText('Rate Categories could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('opens on a new category when there are none', async () => {
    renderPage(createMockClient({ scenario: 'empty' }));
    await loaded();
    expect(
      screen.getByRole('heading', { level: 1, name: 'New Rate Category' }),
    ).toBeInTheDocument();
  });

  it('keeps the saved category when the list refresh fails afterwards', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const listSpy = vi.spyOn(client.rateCategories, 'list');
    renderPage(client);
    const name = await loaded();
    listSpy.mockRejectedValueOnce(new Error('offline'));
    await user.clear(name);
    await user.type(name, 'Complimentary');
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect((await screen.findAllByText('Rate Category Saved')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument();
    expect(within(list()).getByRole('button', { name: 'Complimentary' })).toBeInTheDocument();
  });

  it('retries a failed create with the same request id (no second category)', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.rateCategories, 'save');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'New Rate Category' }));
    await user.type(screen.getByLabelText(/Rate Category Name/), 'Trade Rate');
    await user.click(screen.getByRole('combobox', { name: 'SKU' }));
    await user.click(await screen.findByRole('option', { name: 'Room night, non-member' }));
    save.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect(
      await screen.findByText('The rate category could not be saved. Try again.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect((await screen.findAllByText('Rate Category Saved')).length).toBeGreaterThan(0);
    const ids = save.mock.calls.map(([input]) => input.requestId);
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBe(ids[0]);
  });

  it('keeps text that is not money, explains it, and holds the save until corrected', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    const cell = await screen.findByRole('textbox', { name: 'Default, King Room, Standard Base' });
    await user.clear(cell);
    await user.type(cell, 'abc');
    await user.tab();
    expect(cell).toHaveValue('abc');
    expect(cell).toBeInvalid();
    expect(cell).toHaveAccessibleDescription('Enter an amount from 0 to 9,999,999.99');
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect(await screen.findByText(/Correct the rates marked in the table/)).toBeInTheDocument();
    expect(
      (await client.rateCategories.list()).find((c) => c.id === 'rc-member')?.seasons[0].rates[
        'rt-king'
      ].standardBase,
    ).toBe(18000);
    await user.clear(cell);
    await user.type(cell, '1,234.50');
    await user.tab();
    expect(cell).toHaveValue('1,234.50');
    expect(cell).toBeValid();
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect((await screen.findAllByText('Rate Category Saved')).length).toBeGreaterThan(0);
  });

  it('offers only SKUs of the chosen kind and clears one that no longer matches', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    expect(screen.getByRole('combobox', { name: 'SKU' })).toHaveValue('Room night, complimentary');
    await user.click(screen.getByRole('radio', { name: 'Combo' }));
    expect(screen.getByRole('combobox', { name: 'SKU' })).toHaveValue('');
    await user.click(screen.getByRole('combobox', { name: 'SKU' }));
    expect(
      await screen.findByRole('option', { name: 'Stay and play package' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Room night, member' })).not.toBeInTheDocument();
  });

  it('clears a duplicate-name error from the server when the name is edited', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Duplicate rate category' }));
    const dialog = await screen.findByRole('dialog', { name: 'Duplicate Rate Category' });
    const { ApiError } = await import('../api/types');
    vi.spyOn(client.rateCategories, 'duplicate').mockRejectedValue(
      new ApiError(409, 'taken', { code: 'duplicate-name' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Duplicate' }));
    expect(await within(dialog).findByText(/already in use/)).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox'), '2');
    expect(within(dialog).queryByText(/already in use/)).not.toBeInTheDocument();
  });
});
