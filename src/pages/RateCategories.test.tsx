import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { Link, MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess, saveButtonName } from '../app/testing';
import { blankRateCategory } from '../app/rateCategories';
import { theme } from '../theme';
import RateCategories from './RateCategories';
import { clickMoreMenuItem } from './moreMenuTestHelpers';

function renderPage(client: ApiClient = createMockClient(), withSettings = false) {
  const page = (
    <MemoryRouter initialEntries={['/admin/rate-categories']}>
      <Link to="/schedule">Go to schedule</Link>
      <RateCategories />
    </MemoryRouter>
  );
  return render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <GrantedAccess>
          {withSettings ? <SystemSettingsProvider>{page}</SystemSettingsProvider> : page}
        </GrantedAccess>
      </ApiProvider>
    </ThemeProvider>,
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
      'New Rate Category',
      'Comp Rate',
      'Member Rate',
      'Non-Member Rate',
      'Owner Rate',
      'Aardvark Special, Inactive',
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
    await clickMoreMenuItem(user, 'Copy Rate Category');
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
    await clickMoreMenuItem(user, 'Delete Rate Category');
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
    await clickMoreMenuItem(user, 'Delete Rate Category');
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
    await clickMoreMenuItem(user, 'Delete Rate Category');
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

  it('counts text that is not money as an unsaved change: Save is offered and leaving asks first', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    const saved = screen.getByRole('button', { name: saveButtonName('Rate Category') });
    expect(saved).toHaveAccessibleName('Saved, Rate Category');
    const cell = await screen.findByRole('textbox', { name: 'Default, King Room, Standard Base' });
    await user.clear(cell);
    await user.type(cell, 'abc');
    await user.tab();
    const save = screen.getByRole('button', { name: 'Save Rate Category' });
    expect(save).not.toHaveAttribute('aria-disabled');
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('has not been saved');
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
    await clickMoreMenuItem(user, 'Copy Rate Category');
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

describe('Rate Categories layout (legacy match)', () => {
  const addRow = () => within(list()).getAllByRole('listitem')[0];

  it('puts the add action and the new category on ONE line', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const rows = within(list()).getAllByRole('listitem');
    // The add row first, then the four categories.
    expect(rows).toHaveLength(5);
    expect(within(addRow()).getByRole('button', { name: 'New Rate Category' })).not.toHaveAttribute(
      'aria-current',
    );
    await user.click(within(addRow()).getByRole('button', { name: 'New Rate Category' }));
    // Still five rows: the add row itself is now the selected new category, not a second row.
    expect(within(list()).getAllByRole('listitem')).toHaveLength(5);
    expect(within(list()).getAllByRole('button', { name: 'New Rate Category' })).toHaveLength(1);
    expect(within(addRow()).getByRole('button', { name: 'New Rate Category' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'New Rate Category' }),
    ).toBeInTheDocument();
  });

  it('gives the list rows the height of the Admin Setup navigation rows (59px)', async () => {
    renderPage();
    await loaded();
    const add = within(addRow()).getByRole('button', { name: 'New Rate Category' });
    const category = within(list()).getByRole('button', { name: 'Member Rate' });
    for (const button of [add, category]) {
      expect(getComputedStyle(button).minHeight).toBe(theme.spacing(7.375));
    }
    expect(theme.spacing(7.375)).toBe('59px');
  });

  it('shows the Item and Combo choice with a visible label next to the SKU lookup', async () => {
    renderPage();
    await loaded();
    const group = screen.getByRole('radiogroup', { name: 'SKU Type' });
    expect(within(group).getByRole('radio', { name: 'Item' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Combo' })).not.toBeChecked();
    expect(screen.getByText('SKU Type')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'SKU' })).toBeVisible();
  });

  it('draws Add Season as the green primary call to action with a plus icon', async () => {
    renderPage();
    await loaded();
    const add = screen.getByRole('button', { name: 'Add Season' });
    expect(add).toHaveClass('MuiButton-contained', 'MuiButton-colorPrimary');
    expect(add.querySelector('svg[data-testid="AddIcon"]')).not.toBeNull();
    expect(theme.palette.primary.main).toBe('#2e7d32');
  });

  it('colours each season by its place: neutral default, then the tones in order', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    const table = await screen.findByRole('table', { name: 'Rates by season and room type' });
    const bodies = [...table.querySelectorAll('tbody[data-season]')];
    expect(bodies.map((b) => b.getAttribute('data-tone'))).toEqual(['neutral', '0', '1']);
    const bands = bodies.map((b) => getComputedStyle(b.querySelector('td')!).backgroundColor);
    expect(new Set(bands).size).toBe(3);
    // Not colour alone: each card also shows its name and dates.
    expect(screen.getAllByRole('textbox', { name: 'Season name' })).toHaveLength(2);
    expect(screen.getByLabelText('Summer start date')).toHaveValue('2026-06-01');
    expect(screen.getByLabelText('Holidays end date')).toHaveValue('2027-01-02');
  });

  it('gives each season its own SKU lookup (not the default season) and saves it', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    await screen.findByRole('table', { name: 'Rates by season and room type' });
    expect(screen.getAllByRole('combobox', { name: /^SKU \(/ })).toHaveLength(2);
    expect(screen.queryByRole('combobox', { name: 'SKU (Default)' })).not.toBeInTheDocument();
    // Same Item/Combo rule as the category: the lookup lists SKUs of the chosen kind only.
    const kind = screen.getByRole('radiogroup', { name: 'SKU type (Summer)' });
    await user.click(within(kind).getByRole('radio', { name: 'Combo' }));
    await user.click(screen.getByRole('combobox', { name: 'SKU (Summer)' }));
    expect(screen.queryByRole('option', { name: 'Room night, member' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Stay and play package' }));
    await user.click(screen.getByRole('button', { name: 'Save Rate Category' }));
    expect((await screen.findAllByText('Rate Category Saved')).length).toBeGreaterThan(0);
    const stored = (await client.rateCategories.list()).find((c) => c.id === 'rc-member');
    const summer = stored?.seasons.find((x) => x.name === 'Summer');
    expect(summer).toMatchObject({ skuKind: 'combo', sku: { id: 'sku-package' } });
    // The other season and the category keep theirs.
    expect(stored?.seasons.find((x) => x.name === 'Holidays')?.sku ?? null).toBeNull();
    expect(stored?.sku?.id).toBe('sku-room-member');
  });

  it('switching a season SKU kind clears a SKU of the other kind', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(within(list()).getByRole('button', { name: 'Member Rate' }));
    await screen.findByRole('table', { name: 'Rates by season and room type' });
    await user.click(screen.getByRole('combobox', { name: 'SKU (Summer)' }));
    await user.click(await screen.findByRole('option', { name: 'Room night, member' }));
    expect(screen.getByRole('combobox', { name: 'SKU (Summer)' })).toHaveValue(
      'Room night, member',
    );
    const kind = screen.getByRole('radiogroup', { name: 'SKU type (Summer)' });
    await user.click(within(kind).getByRole('radio', { name: 'Combo' }));
    expect(screen.getByRole('combobox', { name: 'SKU (Summer)' })).toHaveValue('');
  });

  it('focuses the name of a season that was just added', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Season' }));
    expect(screen.getByRole('textbox', { name: 'Season name' })).toHaveFocus();
  });

  it('does nothing when the selected New Rate Category row is clicked again', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const row = () => within(list()).getByRole('button', { name: 'New Rate Category' });
    await user.click(row());
    await user.type(screen.getByLabelText(/Rate Category Name/), 'Typed');
    await user.click(row());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Rate Category Name/)).toHaveValue('Typed');
  });
});
