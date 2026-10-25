import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { MOCK_ROOM_OPTIONS } from '../api/roomOptionsData';
import { ApiError, type ApiClient } from '../api/types';
import { GrantedAccess } from '../app/testing';
import RoomOptions from './RoomOptions';
import RoomTypes from './RoomTypes';
import Rooms from './Rooms';

function renderPage(client: ApiClient = createMockClient()) {
  return render(
    <ApiProvider client={client}>
      <GrantedAccess>
        <MemoryRouter initialEntries={['/admin/room-options']}>
          <Link to="/schedule">Go to schedule</Link>
          <RoomOptions />
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

const loaded = async () =>
  (await screen.findAllByRole('textbox', { name: /^Feature \d+$/ }, { timeout: 3000 }))[0];
const saveButton = () => screen.getByRole('button', { name: 'Save Room Options' });
const withLabel = (name: string) => screen.getByDisplayValue(name);

describe('Room Options page', () => {
  it('shows the Features list with a Change Log button and the nav item selected', async () => {
    renderPage();
    expect(await loaded()).toHaveValue('Mini fridge');
    expect(screen.getAllByRole('textbox', { name: /^Feature \d+$/ })).toHaveLength(5);
    expect(screen.getByRole('heading', { level: 1, name: 'Room Options' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change Log/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Room Options' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add Feature' })).toBeInTheDocument();
  });

  it('switches to the Bed Sizes tab and labels its button "Add Bed Size"', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Bed Sizes' }));
    expect(screen.getAllByRole('textbox', { name: /^Bed Size \d+$/ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Add Bed Size' })).toBeInTheDocument();
  });

  it('shows a loading indicator, then an error with Retry', async () => {
    const client = createMockClient();
    const get = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
      .mockResolvedValue(MOCK_ROOM_OPTIONS);
    const user = userEvent.setup();
    renderPage({ ...client, roomOptions: { ...client.roomOptions, get } });
    expect(screen.getByLabelText('Loading Room Options')).toBeInTheDocument();
    expect(await screen.findByText('Room Options could not be loaded.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await loaded()).toBeInTheDocument();
  });

  it('shows the empty state of a list', async () => {
    const client = createMockClient();
    renderPage({
      ...client,
      roomOptions: { ...client.roomOptions, get: async () => ({ features: [], bedSizes: [] }) },
    });
    expect(await screen.findByText(/No features yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Feature' })).toBeInTheDocument();
  });

  it('adds a feature, focuses its field, saves, and confirms', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Feature' }));
    const fields = screen.getAllByRole('textbox', { name: /^Feature \d+$/ });
    await waitFor(() => expect(fields.at(-1)).toHaveFocus());
    await user.type(fields.at(-1) as HTMLElement, 'Fireplace');
    expect(screen.getByText('9/50')).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
    await user.click(saveButton());
    expect((await screen.findAllByText('Room Options Saved')).length).toBeGreaterThan(0);
    expect((await client.roomOptions.get()).features.map((f) => f.label)).toContain('Fireplace');
    expect(saveButton()).toBeDisabled();
  });

  it('stops typing at 50 characters', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Feature' }));
    const field = screen.getAllByRole('textbox', { name: /^Feature \d+$/ }).at(-1) as HTMLElement;
    await user.type(field, 'x'.repeat(60));
    expect(field).toHaveValue('x'.repeat(50));
    expect(screen.getByText('50/50')).toBeInTheDocument();
  });

  it('refuses a duplicate name in any case and focuses the field', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi.spyOn(client.roomOptions, 'save');
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Add Feature' }));
    const field = screen.getAllByRole('textbox', { name: /^Feature \d+$/ }).at(-1) as HTMLElement;
    await user.type(field, 'BALCONY');
    await user.click(saveButton());
    expect(save).not.toHaveBeenCalled();
    expect(screen.getAllByText(/already in the list/)).toHaveLength(2);
    const invalid = screen
      .getAllByRole('textbox', { name: /^Feature \d+$/ })
      .filter((f) => f.getAttribute('aria-invalid') === 'true');
    expect(invalid).toHaveLength(2);
    expect(invalid[0]).toHaveFocus();
  });

  it('refuses an empty name and moves to the tab with the error', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Bed Sizes' }));
    await user.click(screen.getByRole('button', { name: 'Add Bed Size' }));
    await user.click(screen.getByRole('tab', { name: 'Features' }));
    await user.click(screen.getByRole('button', { name: 'Remove Soaking tub' }));
    await user.click(saveButton());
    expect(await screen.findByText('Bed Size must have a name.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bed Sizes' })).toHaveAttribute('aria-selected', 'true');
  });

  it('removes an unused item and later ones move up', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Remove Balcony' }));
    // Balcony is used by King Room, so it stays and the reason is shown.
    expect(screen.getByRole('alert')).toHaveTextContent(/Balcony cannot be removed.*King Room/);
    expect(screen.getByDisplayValue('Balcony')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Soaking tub' }));
    expect(screen.queryByDisplayValue('Soaking tub')).not.toBeInTheDocument();
    await user.click(saveButton());
    await screen.findAllByText('Room Options Saved');
    expect((await client.roomOptions.get()).features).toHaveLength(4);
  });

  it('blocks removing a bed size that has a quantity on a room type', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Bed Sizes' }));
    await user.click(screen.getByRole('button', { name: 'Remove Queen' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Queen cannot be removed/);
    expect(withLabel('Queen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Twin' }));
    expect(screen.queryByDisplayValue('Twin')).not.toBeInTheDocument();
  });

  it('shows the server refusal when a removal is still in use there', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi
      .fn()
      .mockRejectedValue(new ApiError(409, 'in use', { code: 'in-use', details: {} }));
    renderPage({ ...client, roomOptions: { ...client.roomOptions, save } });
    await loaded();
    await user.type(withLabel('Soaking tub'), '2');
    await user.click(saveButton());
    expect(await screen.findByText(/still used by a Room Type or Room/)).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('reuses the request id when the same payload is retried', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(0, 'offline'))
      .mockResolvedValue(MOCK_ROOM_OPTIONS);
    renderPage({ ...client, roomOptions: { ...client.roomOptions, save } });
    await loaded();
    await user.type(withLabel('Soaking tub'), '2');
    await user.click(saveButton());
    await screen.findByText(/could not be saved/);
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][0].requestId).toBe(save.mock.calls[0][0].requestId);
  });

  it('asks before leaving with unsaved changes and can save from the prompt', async () => {
    const user = userEvent.setup();
    const client = createMockClient();
    renderPage(client);
    await loaded();
    await user.type(withLabel('Soaking tub'), '2');
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Room Options have not been saved.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save now' }));
    await waitFor(async () =>
      expect((await client.roomOptions.get()).features.map((f) => f.label)).toContain(
        'Soaking tub2',
      ),
    );
  });

  it('does not prompt when nothing changed', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('link', { name: 'Go to schedule' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('consumers read the shared list', () => {
  async function saveFireplace(client: ApiClient) {
    await client.roomOptions.save({
      requestId: 'c',
      features: [...MOCK_ROOM_OPTIONS.features, { label: 'Fireplace' }],
      bedSizes: [...MOCK_ROOM_OPTIONS.bedSizes, { label: 'Cot' }],
    });
  }

  it('Room Types offers the new feature and bed size', async () => {
    const client = createMockClient();
    await saveFireplace(client);
    render(
      <ApiProvider client={client}>
        <GrantedAccess>
          <MemoryRouter initialEntries={['/admin/room-types']}>
            <RoomTypes />
          </MemoryRouter>
        </GrantedAccess>
      </ApiProvider>,
    );
    expect(await screen.findByRole('checkbox', { name: 'Fireplace' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Cot' })).toBeInTheDocument();
  });

  it('Rooms offers the new feature', async () => {
    const client = createMockClient();
    await saveFireplace(client);
    render(
      <ApiProvider client={client}>
        <GrantedAccess>
          <MemoryRouter initialEntries={['/admin/rooms']}>
            <Rooms />
          </MemoryRouter>
        </GrantedAccess>
      </ApiProvider>,
    );
    await userEvent.click(await screen.findByRole('tab', { name: /^Features/ }));
    expect(await screen.findByRole('checkbox', { name: 'Fireplace' })).toBeInTheDocument();
  });
});
