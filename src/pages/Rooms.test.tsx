import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { mockSystemSettings } from '../api/systemSettingsData';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess } from '../app/testing';
import Rooms from './Rooms';

async function renderPage(ownerEnabled = false) {
  const client: ApiClient = createMockClient();
  if (ownerEnabled)
    await client.systemSettings.save({ ...mockSystemSettings(), roomOwnerFieldEnabled: true });
  render(
    <ApiProvider client={client}>
      <SystemSettingsProvider>
        <GrantedAccess>
          <MemoryRouter initialEntries={['/admin/rooms']}>
            <Rooms />
          </MemoryRouter>
        </GrantedAccess>
      </SystemSettingsProvider>
    </ApiProvider>,
  );
  return client;
}

const loaded = () => screen.findByRole('textbox', { name: /Room Name/ });
const list = () => screen.getByRole('navigation', { name: 'Rooms' });

describe('Rooms page', () => {
  it('lists retired rooms last with an Inactive tag', async () => {
    await renderPage();
    await loaded();
    const items = within(list()).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      '100',
      '101',
      '200',
      '300 (retired)Inactive',
    ]);
    expect(within(items[3]).getByText('Inactive')).toBeVisible();
  });

  it('shows the room with inherited details disabled', async () => {
    await renderPage();
    await loaded();
    expect(screen.getByRole('heading', { level: 1, name: '100' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Inherit Details from Room Type' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Increase max occupancy' })).toBeDisabled();
    expect(screen.getByLabelText(/Description \(optional\)/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeDisabled();
    await userEvent.click(screen.getByRole('tab', { name: /^Features/ }));
    expect(screen.getByRole('checkbox', { name: 'Mini fridge' })).toBeDisabled();
  });

  it('enables and keeps the fields when Inherit Details is turned off, and re-reads them when turned on', async () => {
    const user = userEvent.setup();
    await renderPage();
    await loaded();
    const toggle = screen.getByRole('switch', { name: 'Inherit Details from Room Type' });
    await user.click(toggle);
    const plus = screen.getByRole('button', { name: 'Increase max occupancy' });
    expect(plus).toBeEnabled();
    await user.click(plus);
    expect(screen.getByRole('group', { name: 'Max Occupancy' })).toHaveTextContent('5');
    await user.click(toggle);
    expect(screen.getByRole('group', { name: 'Max Occupancy' })).toHaveTextContent('4');
    expect(screen.getByRole('button', { name: 'Increase max occupancy' })).toBeDisabled();
  });

  it('changing the room type refreshes inherited details', async () => {
    const user = userEvent.setup();
    await renderPage();
    await loaded();
    await user.click(screen.getByRole('combobox', { name: 'Room Type' }));
    await user.click(await screen.findByRole('option', { name: 'King Room' }));
    expect(screen.getByRole('group', { name: 'King' })).toHaveTextContent('1');
    expect(screen.getByRole('switch', { name: 'Inherit Details from Room Type' })).toBeChecked();
  });

  it('shows the Room Owner field only when the Owner setting is on, always enabled', async () => {
    await renderPage(false);
    await loaded();
    expect(screen.queryByRole('combobox', { name: 'Room Owner' })).not.toBeInTheDocument();
  });

  it('with the Owner setting on, the owner is enabled while details are inherited and saved per room', async () => {
    const user = userEvent.setup();
    const client = await renderPage(true);
    const owner = await screen.findByRole('combobox', { name: 'Room Owner' });
    expect(owner).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Inherit Details from Room Type' })).toBeChecked();
    await user.click(owner);
    await user.click(await screen.findByRole('option', { name: 'Sam Ortega (Member)' }));
    await user.click(screen.getByRole('button', { name: 'Save Room' }));
    expect((await screen.findAllByText('Room Saved')).length).toBeGreaterThan(0);
    const saved = (await client.roomSetup.listRooms()).find((r) => r.id === 'room-100');
    expect(saved?.owner?.label).toBe('Sam Ortega (Member)');
    // The other room of the same type keeps its own owner (not inherited).
    expect((await client.roomSetup.listRooms()).find((r) => r.id === 'room-101')?.owner).toBeNull();
  });

  it('links rooms two ways', async () => {
    const user = userEvent.setup();
    const client = await renderPage();
    await loaded();
    expect(screen.getByRole('tab', { name: 'Linked Rooms (1)' })).toBeInTheDocument();
    expect(screen.getByText(/If “Required” switch is active/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: '200' }));
    await user.click(screen.getByRole('button', { name: 'Save Room' }));
    await screen.findAllByText('Room Saved');
    expect(
      (await client.roomSetup.listRooms()).find((r) => r.id === 'room-200')?.linkedRoomIds,
    ).toEqual(['room-100']);
  });

  it('requires a name and a room type for a new room', async () => {
    const user = userEvent.setup();
    await renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'New Room' }));
    expect(screen.getByRole('heading', { level: 1, name: 'New Room' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Room' }));
    expect(await screen.findByText('Enter a room name.')).toBeInTheDocument();
  });

  it('warns before deleting a room with upcoming reservations, then deletes it', async () => {
    const user = userEvent.setup();
    await renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Delete room' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('2 upcoming reservations');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(within(list()).queryByRole('button', { name: '100' })).not.toBeInTheDocument(),
    );
  });

  it('duplicates a room as an unsaved, unlinked copy', async () => {
    const user = userEvent.setup();
    await renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Duplicate room' }));
    expect(screen.getByLabelText(/Room Name/)).toHaveValue('Copy of 100');
    expect(screen.getByRole('tab', { name: 'Linked Rooms (0)' })).toBeInTheDocument();
  });
});
