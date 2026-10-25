import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError, type ApiClient } from '../api/types';
import { GrantedAccess } from '../app/testing';
import type { Permission } from '../app/permissions';
import Locations from './Locations';

function renderPage(client: ApiClient = createMockClient(), granted?: readonly Permission[]) {
  return render(
    <ApiProvider client={client}>
      <GrantedAccess granted={granted}>
        <MemoryRouter initialEntries={['/admin/locations']}>
          <Link to="/schedule">Go to schedule</Link>
          <Locations />
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

const loaded = () => screen.findByRole('list', { name: 'Locations' });
const save = () => screen.getByRole('button', { name: 'Save Locations' });

describe('Locations page', () => {
  it('lists the saved locations in the shared shell with the nav item current', async () => {
    renderPage();
    const list = await loaded();
    expect(within(list).getAllByRole('group')).toHaveLength(3);
    expect(screen.getAllByRole('textbox', { name: /Location Name/ })[0]).toHaveValue(
      'Main Clubhouse',
    );
    expect(screen.getAllByRole('combobox', { name: /Location Area/ })[0]).toHaveValue(
      'Guest Rooms',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Locations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Locations' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Change Log' })).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('shows a loading indicator, then an error with Retry that reloads', async () => {
    const client = createMockClient();
    const list = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
      .mockImplementation(() => client.locations.list());
    renderPage({ ...client, locations: { ...client.locations, list } });
    expect(screen.getByRole('progressbar', { name: 'Loading Locations' })).toBeInTheDocument();
    expect(await screen.findByText('Locations could not be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await loaded()).toBeInTheDocument();
  });

  it('starts a club with no locations on one blank row without marking it changed', async () => {
    renderPage(createMockClient({ scenario: 'empty' }));
    const list = await loaded();
    expect(within(list).getAllByRole('group')).toHaveLength(1);
    expect(save()).toBeDisabled();
    const remove = screen.getByRole('button', { name: 'Remove location 1' });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAccessibleDescription('A club needs at least one location');
  });

  it('removes a location with the red trash can, not a text button', async () => {
    renderPage();
    await loaded();
    const remove = screen.getByRole('button', { name: 'Remove Main Clubhouse' });
    expect(remove).toHaveTextContent('');
    expect(remove.querySelector('[data-testid="DeleteIcon"]')).not.toBeNull();
    expect(remove.className).toMatch(/colorError/);
  });

  it('limits the name to 50 characters and counts them', async () => {
    renderPage();
    await loaded();
    const name = screen.getAllByRole('textbox', { name: /Location Name/ })[0];
    expect(name).toHaveAttribute('maxlength', '50');
    expect(screen.getAllByText(/\/ 50$/)[0]).toHaveTextContent('14 / 50');
  });

  it('adds a row, focuses its name, and removes it again', async () => {
    const user = userEvent.setup();
    renderPage();
    const list = await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Location' }));
    expect(within(list).getAllByRole('group')).toHaveLength(4);
    const names = screen.getAllByRole('textbox', { name: /Location Name/ });
    expect(names[3]).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove location 4' }));
    expect(within(list).getAllByRole('group')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Add Location' })).toHaveFocus();
  });

  it('blocks removing a location that is in use and offers Room Types', async () => {
    const user = userEvent.setup();
    renderPage();
    const list = await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove Main Clubhouse' }));
    const dialog = await screen.findByRole('dialog', { name: 'Unable to Remove Location' });
    expect(within(dialog).getByText(/used by 2 room types and 8 rooms/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Double Queen Room, King Room/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Adjust Room Types' })).toHaveAttribute(
      'href',
      '/admin/room-types',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(list).getAllByRole('group')).toHaveLength(3);
  });

  it('removes a free location, then saves the list', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const saveSpy = vi.spyOn(client.locations, 'save');
    renderPage(client);
    const list = await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove North Lodge' }));
    expect(within(list).getAllByRole('group')).toHaveLength(2);
    await user.click(save());
    expect((await screen.findAllByText('Locations Saved')).length).toBeGreaterThan(0);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0].map((l) => l.name)).toEqual([
      'Main Clubhouse',
      'Lakeside Cottages',
    ]);
    expect(save()).toBeDisabled();
  });

  it('refuses to save an incomplete row, ties the errors to the inputs and focuses the first', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const saveSpy = vi.spyOn(client.locations, 'save');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Location' }));
    await user.type(
      screen.getByRole('textbox', { name: /Location Name/, description: /0 \/ 50/ }),
      'Annex',
    );
    await user.click(save());
    const area = screen.getAllByRole('combobox', { name: /Location Area/ })[3];
    expect(area).toHaveFocus();
    expect(area).toBeInvalid();
    expect(area).toHaveAccessibleDescription('Select an area.');
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('keeps the character counter visible next to a name error', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Location' }));
    await user.keyboard('Main Clubhouse');
    await user.click(save());
    const name = screen.getAllByRole('textbox', { name: /Location Name/ })[3];
    expect(name).toHaveFocus();
    expect(name).toHaveAccessibleDescription('Another location already has this name. (14 / 50)');
  });

  it('picks an area by typing and saves a new location', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Location' }));
    await user.keyboard('Annex');
    const area = screen.getAllByRole('combobox', { name: /Location Area/ })[3];
    await user.type(area, 'event');
    await user.click(await screen.findByRole('option', { name: 'Event Lodging' }));
    await user.click(save());
    expect((await screen.findAllByText('Locations Saved')).length).toBeGreaterThan(0);
    expect((await client.locations.list()).map((l) => l.name)).toContain('Annex');
  });

  it('shows a message when the server refuses the save, and keeps the edits', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const failing = vi.fn().mockRejectedValue(new ApiError(500, 'boom'));
    renderPage({ ...client, locations: { ...client.locations, save: failing } });
    await loaded();
    await user.type(screen.getAllByRole('textbox', { name: /Location Name/ })[0], ' II');
    await user.click(save());
    expect(await screen.findByText('Locations could not be saved. Try again.')).toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it('asks before leaving with unsaved changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.type(screen.getAllByRole('textbox', { name: /Location Name/ })[0], ' II');
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(
      await screen.findByRole('dialog', { name: 'Locations have not been saved.' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Leave without saving' }));
  });

  it('is read-only without the edit permission: fields disabled, no Add, Remove or Save', async () => {
    renderPage(createMockClient(), ['page.locations']);
    await loaded();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    for (const box of screen.getAllByRole('textbox', { name: /Location Name/ })) {
      expect(box).toBeDisabled();
    }
    for (const box of screen.getAllByRole('combobox', { name: /Location Area/ })) {
      expect(box).toBeDisabled();
    }
    expect(screen.queryByRole('button', { name: 'Add Location' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Locations' })).not.toBeInTheDocument();
  });
});
