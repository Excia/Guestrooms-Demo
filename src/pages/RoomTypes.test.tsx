import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { GrantedAccess } from '../app/testing';
import RoomTypes from './RoomTypes';

function renderPage(client: ApiClient = createMockClient()) {
  return render(
    <ApiProvider client={client}>
      <GrantedAccess>
        <MemoryRouter initialEntries={['/admin/room-types']}>
          <RoomTypes />
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

const loaded = () => screen.findByRole('textbox', { name: /Room Type Name/ });
const list = () => screen.getByRole('navigation', { name: 'Room Types' });

describe('Room Types page', () => {
  it('lists the room types with inactive ones last and selects the first', async () => {
    renderPage();
    await loaded();
    const items = within(list()).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Double Queen Room',
      'King Room',
      'Cottage (retired)Inactive',
    ]);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Double Queen Room' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Room Type Name/)).toHaveValue('Double Queen Room');
    expect(screen.getByRole('group', { name: 'Max Occupancy' })).toHaveTextContent('4');
    expect(screen.getByRole('group', { name: 'Queen' })).toHaveTextContent('2');
  });

  it('shows the end date only when "Configure active end date?" is checked', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    expect(screen.queryByLabelText('Active End Date')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Configure active end date?' }));
    expect(screen.getByLabelText('Active End Date')).toBeInTheDocument();
  });

  it('refuses to save an end date that is not after the start date', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('checkbox', { name: 'Configure active end date?' }));
    await user.type(screen.getByLabelText('Active End Date'), '2020-01-01');
    await user.click(screen.getByRole('button', { name: 'Save Room Type' }));
    expect(await screen.findByText(/must be after the start date/)).toBeInTheDocument();
  });

  it('counts selected associations and applies Select All and Select None', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    expect(screen.getByRole('tab', { name: 'Features (2)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByRole('tab', { name: 'Features (5)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select none' }));
    expect(screen.getByRole('tab', { name: 'Features (0)' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Add-Ons (1)' }));
    expect(screen.getByRole('checkbox', { name: 'Rollaway bed' })).toBeChecked();
  });

  it('shows a counter and stops the description at 750 characters', async () => {
    renderPage();
    await loaded();
    const field = screen.getByLabelText(/Description \(optional\)/);
    expect(field).toHaveAttribute('maxlength', '750');
    expect(screen.getByText(/^\d+ \/ 750$/)).toBeInTheDocument();
  });

  it('removes a photo and requires at least one to save', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove photo room.jpg' }));
    expect(screen.getByText('0 of 50 photos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Room Type' }));
    expect(await screen.findByText('Add at least one photo.')).toBeInTheDocument();
  });

  it('saves edits and shows the toast', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    const name = await loaded();
    await user.clear(name);
    await user.type(name, 'Queen Deluxe');
    await user.click(screen.getByRole('button', { name: 'Save Room Type' }));
    expect((await screen.findAllByText('Room Type Saved')).length).toBeGreaterThan(0);
    expect((await client.roomSetup.listRoomTypes()).some((t) => t.name === 'Queen Deluxe')).toBe(
      true,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Queen Deluxe' })).toBeInTheDocument();
  });

  it('creates a new room type: default title, required name, Cancel instead of delete', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'New Room Type' }));
    expect(screen.getByRole('heading', { level: 1, name: 'New Room Type' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Room Type Name/)).toHaveValue('');
    expect(screen.getByRole('group', { name: 'Max Occupancy' })).toHaveTextContent('2');
    expect(screen.queryByRole('button', { name: 'Delete room type' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Room Type' }));
    expect(await screen.findByText('Enter a room type name.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Room Type Name/)).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Double Queen Room' }),
    ).toBeInTheDocument();
  });

  it('duplicates into a new, unsaved room type with the values filled in', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Duplicate room type' }));
    expect(screen.getByRole('heading', { level: 1, name: 'New Room Type' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Room Type Name/)).toHaveValue('Copy of Double Queen Room');
    expect(screen.getByRole('group', { name: 'Queen' })).toHaveTextContent('2');
  });

  it('asks before leaving unsaved changes for another room type', async () => {
    const user = userEvent.setup();
    renderPage();
    const name = await loaded();
    await user.type(name, '!');
    await user.click(within(list()).getByRole('button', { name: 'King Room' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('This room type has not been saved.');
    await user.click(within(dialog).getByRole('button', { name: 'Leave without saving' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'King Room' })).toBeInTheDocument(),
    );
  });

  it('blocks deleting a room type that rooms use', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Delete room type' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('2 rooms use it');
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('deletes an unused room type after confirmation and selects the next one', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(within(list()).getByRole('button', { name: /Cottage/ }));
    await user.click(screen.getByRole('button', { name: 'Delete room type' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(within(list()).queryByRole('button', { name: /Cottage/ })).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Double Queen Room' }),
    ).toBeInTheDocument();
  });

  it('keeps the cancel button focused in the delete dialog so Enter never deletes', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(within(list()).getByRole('button', { name: /Cottage/ }));
    await user.click(screen.getByRole('button', { name: 'Delete room type' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('offers a retry when loading fails', async () => {
    renderPage(createMockClient({ scenario: 'error' }));
    expect(await screen.findByText('Room Types could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
