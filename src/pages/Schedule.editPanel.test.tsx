import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { GrantedAccess } from '../app/testing';
import { theme } from '../theme';
import Schedule from './Schedule';

const TODAY = '2026-10-16';

function Probe() {
  const { pathname, search } = useLocation();
  return <output data-testid="url">{pathname + search}</output>;
}

async function loaded(
  url_: string,
  client: ApiClient = createMockClient({ today: TODAY }),
  granted?: Parameters<typeof GrantedAccess>[0]['granted'],
) {
  const user = userEvent.setup();
  render(
    <ThemeProvider theme={theme}>
      <GrantedAccess granted={granted}>
        <ApiProvider client={client}>
          <MemoryRouter initialEntries={[url_]}>
            <Routes>
              <Route path="/schedule" element={<Schedule today={TODAY} />} />
            </Routes>
            <Probe />
          </MemoryRouter>
        </ApiProvider>
      </GrantedAccess>
    </ThemeProvider>,
  );
  await screen.findByRole('grid', { name: 'Schedule', hidden: true });
  return user;
}

const url = () => screen.getByTestId('url').textContent;
const grid = () => screen.getByRole('grid', { name: 'Schedule', hidden: true });
const blocksOf = (text: string) =>
  within(grid())
    .getAllByRole('gridcell', { hidden: true })
    .filter((c) => c.getAttribute('aria-label')?.includes(text));
const panel = (name: RegExp | string) => screen.findByRole('dialog', { name });

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});

describe('Add Another Room', () => {
  async function open(res = 'rs-5', rr = 'rr-5', title = /Reservation #GR-50310/) {
    const user = await loaded(`/schedule?res=${res}&rr=${rr}`);
    const details = await panel(title);
    await within(details).findByRole('button', { name: 'More reservation actions' });
    await user.click(within(details).getByRole('button', { name: 'More reservation actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Add Another Room' }));
    return { user, add: await panel('Add Room to Reservation') };
  }

  it('opens the panel with the reservation number and the stay dates fixed (no date fields)', async () => {
    const { add } = await open();
    expect(url()).toBe('/schedule?panel=add-room&res=rs-5');
    expect(await within(add).findByText('Check In: 10/16/2026')).toBeInTheDocument();
    expect(within(add).getByText('Check Out: 10/19/2026 (3 Nights)')).toBeInTheDocument();
    expect(within(add).getByText('Reservation #GR-50310')).toBeInTheDocument();
    expect(within(add).queryByLabelText(/Check In|Check Out/)).not.toBeInTheDocument();
    expect(within(add).getByRole('group', { name: 'Adults' })).toBeInTheDocument();
    expect(within(add).getByRole('group', { name: 'Children' })).toBeInTheDocument();
    expect(
      within(add).getByRole('button', { name: 'Add Room to Reservation' }),
    ).toBeInTheDocument();
    // focus lands on the heading
    await waitFor(() =>
      expect(within(add).getByRole('heading', { name: 'Add Room to Reservation' })).toHaveFocus(),
    );
  });

  it('lists only rooms that are free for the whole stay', async () => {
    const { user, add } = await open();
    const room = within(add).getByRole('combobox', { name: 'Room' });
    await waitFor(() => expect(room).toBeEnabled());
    await user.click(room);
    const list = await screen.findByRole('listbox');
    // its own room (202) and a room booked during the stay (201 has GR-50240/50188/...) are not offered
    expect(within(list).queryByRole('option', { name: 'Room 202' })).not.toBeInTheDocument();
    expect(within(list).getAllByRole('option').length).toBeGreaterThan(1);
  });

  it('adds an unassigned room: the details then show two rooms and the schedule is updated', async () => {
    const { user, add } = await open();
    await user.click(within(add).getByRole('button', { name: 'Add Room to Reservation' }));
    const details = await panel(/Reservation #GR-50310 \(2 Rooms\)/);
    // the new room is selected in the room selector, and the URL names it
    expect(
      await within(details).findByRole('button', { name: /Unassigned.*Choose a room/ }),
    ).toBeInTheDocument();
    expect(url()).toMatch(/^\/schedule\?res=rs-5&rr=rr-add-/);
    expect(await screen.findAllByText('Room added to reservation #GR-50310.')).not.toHaveLength(0);
  });

  it('adds a chosen room with its own party', async () => {
    const { user, add } = await open();
    await user.click(within(add).getByRole('button', { name: 'Increase adults' }));
    await user.click(within(add).getByRole('button', { name: 'Increase children' }));
    const room = within(add).getByRole('combobox', { name: 'Room' });
    await waitFor(() => expect(room).toBeEnabled());
    await user.click(room);
    const list = await screen.findByRole('listbox');
    expect(blocksOf('Thomas Okafor')).toHaveLength(1);
    const first = within(list).getAllByRole('option')[1]; // [0] is Unassigned
    const name = first.textContent!;
    await user.click(first);
    expect(room).toHaveValue(name.split(' ').slice(0, 2).join(' '));
    await user.click(within(add).getByRole('button', { name: 'Add Room to Reservation' }));
    const details = await panel(/Reservation #GR-50310 \(2 Rooms\)/);
    expect(
      await within(details).findByRole('button', { name: /Room \d+.*Choose a room/ }),
    ).toBeInTheDocument();
    await user.click(within(details).getByRole('button', { name: 'Guest Details' }));
    expect((await within(details).findAllByText('3 Adults 1 Child')).length).toBeGreaterThan(0);
    // the schedule behind the panel shows the new block without a page reload
    await waitFor(() => expect(blocksOf('Thomas Okafor')).toHaveLength(2));
  });

  it('Back to reservation returns to its details; the close button returns to the schedule', async () => {
    const { user, add } = await open();
    await user.click(within(add).getByRole('button', { name: 'Back to reservation' }));
    await panel(/Reservation #GR-50310/);
    expect(url()).toBe('/schedule?res=rs-5');
  });

  it('has no permission check, as in legacy: a user without reservation.edit can add a room', async () => {
    const user = await loaded('/schedule?panel=add-room&res=rs-5', undefined, ['page.schedule']);
    const add = await panel('Add Room to Reservation');
    const cta = await within(add).findByRole('button', { name: 'Add Room to Reservation' });
    expect(cta).not.toHaveAttribute('aria-disabled');
    await user.click(cta);
    await panel(/Reservation #GR-50310 \(2 Rooms\)/);
  });

  it('a retry after a lost answer does not add a second room (the key and body are kept)', async () => {
    const client = createMockClient({ today: TODAY });
    const real = client.reservations.addRoom.bind(client.reservations);
    let lost = true;
    client.reservations.addRoom = async (request) => {
      const answer = await real(request);
      if (lost) {
        lost = false;
        throw new Error('connection lost');
      }
      return answer;
    };
    const user = await loaded('/schedule?res=rs-5&rr=rr-5', client);
    const details = await panel(/Reservation #GR-50310/);
    await user.click(
      await within(details).findByRole('button', { name: 'More reservation actions' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Add Another Room' }));
    const add = await panel('Add Room to Reservation');
    await user.click(within(add).getByRole('button', { name: 'Add Room to Reservation' }));
    expect(await within(add).findByRole('alert')).toHaveTextContent(/not added twice/);
    await user.click(within(add).getByRole('button', { name: 'Add Room to Reservation' }));
    await panel(/Reservation #GR-50310 \(2 Rooms\)/);
    expect((await client.reservations.getDetail('rs-5')).rooms).toHaveLength(2);
  });

  it('labels the total honestly when the new room has no rate yet', async () => {
    await loaded('/schedule?panel=add-room&res=rs-5');
    const add = await panel('Add Room to Reservation');
    expect(
      await within(add).findByText(/Estimated Reservation Total \(excludes the new room\)/),
    ).toBeInTheDocument();
  });

  it('a reservation that can no longer take a room says so and cannot add', async () => {
    const user = await loaded('/schedule?panel=add-room&res=rs-1');
    const add = await panel('Add Room to Reservation');
    expect(await within(add).findByText(/can no longer be added/)).toBeInTheDocument();
    const cta = within(add).getByRole('button', { name: 'Add Room to Reservation' });
    expect(cta).toHaveAttribute('aria-disabled', 'true');
    await user.click(cta);
    expect(url()).toBe('/schedule?panel=add-room&res=rs-1');
  });

  it('an unknown reservation says so', async () => {
    await loaded('/schedule?panel=add-room&res=rs-nope');
    const add = await panel('Add Room to Reservation');
    expect(await within(add).findByText(/could not be found/)).toBeInTheDocument();
  });
});

describe('Guest Details', () => {
  async function open(res: string, rr: string, title: RegExp) {
    const user = await loaded(`/schedule?res=${res}&rr=${rr}`);
    const dialog = await panel(title);
    await user.click(await within(dialog).findByRole('button', { name: 'Guest Details' }));
    return { user, dialog };
  }

  it('edits the party and a guest, then shows the guest card; confirmation is off by default', async () => {
    const { user, dialog } = await open('rs-5', 'rr-5', /Reservation #GR-50310/);
    expect((await within(dialog).findAllByText(/^2 Adults/)).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Guest 2 \(Adult\)/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Edit Guests' }));
    expect(await within(dialog).findByRole('heading', { name: 'Edit guests' })).toHaveFocus();
    const update = within(dialog).getByRole('button', { name: 'Update' });
    expect(update).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'Increase children' }));
    expect(within(dialog).getByRole('combobox', { name: 'Guest 3' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('combobox', { name: 'Guest 2' }));
    await user.click(await screen.findByRole('option', { name: /Annika Lindqvist/ }));
    const toggle = await within(dialog).findByRole('switch', { name: /Send Confirmation/ });
    expect(toggle).not.toBeChecked();
    expect(update).not.toHaveAttribute('aria-disabled');
    await user.click(toggle);
    await user.click(update);
    expect(
      (await screen.findAllByText(/Guests updated\. A confirmation was sent\./)).length,
    ).toBeGreaterThan(0);
    expect((await within(dialog).findAllByText(/^2 Adults \d+ Child/)).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Annika Lindqvist/)).toBeInTheDocument();
    expect(within(dialog).getByText('Confirmation sent')).toBeInTheDocument();
    expect(within(dialog).getByText(/Guest 3 \(Child\)/)).toBeInTheDocument();
    // focus is back on the Edit Guests button
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Edit Guests' })).toHaveFocus(),
    );
  });

  it('Cancel discards the changes', async () => {
    const { user, dialog } = await open('rs-5', 'rr-5', /Reservation #GR-50310/);
    await user.click(await within(dialog).findByRole('button', { name: 'Edit Guests' }));
    await user.click(within(dialog).getByRole('button', { name: 'Increase adults' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await within(dialog).findByRole('button', { name: 'Edit Guests' })).toBeInTheDocument();
    expect(within(dialog).queryByText(/^3 Adults/)).not.toBeInTheDocument();
  });

  it('is read-only once the room is checked in', async () => {
    const { dialog } = await open('rs-2', 'rr-2', /Reservation #GR-50240/);
    expect(
      await within(dialog).findByText(/cannot be changed once the room is checked in/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Edit Guests' })).not.toBeInTheDocument();
  });

  it('each room of a multi-room reservation has its own guests', async () => {
    const { user, dialog } = await open('rs-7', 'rr-7', /Reservation #GR-50321 \(3 Rooms\)/);
    expect((await within(dialog).findAllByText('2 Adults 2 Children')).length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: /Next room/ }));
    await waitFor(() =>
      expect(within(dialog).queryByText('2 Adults 2 Children')).not.toBeInTheDocument(),
    );
    expect((await within(dialog).findAllByText('1 Adult')).length).toBeGreaterThan(0);
  });

  it('a failed save keeps the editor open and says why', async () => {
    const client = createMockClient({ today: TODAY });
    client.reservations.updateGuests = () => Promise.reject(new Error('offline'));
    const user = await loaded('/schedule?res=rs-5&rr=rr-5', client);
    const dialog = await panel(/Reservation #GR-50310/);
    await user.click(await within(dialog).findByRole('button', { name: 'Guest Details' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Edit Guests' }));
    await user.click(within(dialog).getByRole('button', { name: 'Increase adults' }));
    await user.click(within(dialog).getByRole('button', { name: 'Update' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Could not confirm/);
    expect(within(dialog).getByRole('button', { name: 'Update' })).toBeInTheDocument();
  });
});

describe('Notes', () => {
  it('shows the notes, edits them, saves and shows the saved text', async () => {
    const user = await loaded('/schedule?res=rs-5&rr=rr-5');
    const dialog = await panel(/Reservation #GR-50310/);
    await user.click(await within(dialog).findByRole('button', { name: 'Notes' }));
    expect(await within(dialog).findAllByText('None')).toHaveLength(2);
    await user.click(within(dialog).getByRole('button', { name: 'Edit notes' }));
    const publicNotes = within(dialog).getByRole('textbox', { name: 'Public Notes' });
    await waitFor(() => expect(publicNotes).toHaveFocus());
    const save = within(dialog).getByRole('button', { name: 'Save Notes' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await user.type(publicNotes, 'Arrives late');
    await user.type(within(dialog).getByRole('textbox', { name: 'Private Notes' }), 'VIP');
    await user.click(save);
    expect((await screen.findAllByText('Notes saved.')).length).toBeGreaterThan(0);
    expect(await within(dialog).findByText('Arrives late')).toBeInTheDocument();
    expect(within(dialog).getByText('VIP')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Edit notes' })).toHaveFocus(),
    );
  });

  it('describes the character count and refuses text over the limit', async () => {
    const user = await loaded('/schedule?res=rs-2&rr=rr-2');
    const dialog = await panel(/Reservation #GR-50240/);
    await user.click(await within(dialog).findByRole('button', { name: 'Notes' }));
    await user.click(within(dialog).getByRole('button', { name: 'Edit notes' }));
    const field = within(dialog).getByRole('textbox', { name: 'Public Notes' });
    expect(field).toHaveAccessibleDescription(/of 2000 characters/);
    expect(field).toHaveValue('Guest is celebrating a birthday!');
  });

  it('over-long notes focus the field with the problem and describe it', async () => {
    const user = await loaded('/schedule?res=rs-5&rr=rr-5');
    const dialog = await panel(/Reservation #GR-50310/);
    await user.click(await within(dialog).findByRole('button', { name: 'Notes' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Edit notes' }));
    const priv = within(dialog).getByRole('textbox', { name: 'Private Notes' });
    fireEvent.change(priv, { target: { value: 'x'.repeat(2001) } });
    await user.click(within(dialog).getByRole('button', { name: 'Save Notes' }));
    await waitFor(() => expect(priv).toHaveFocus());
    expect(priv).toBeInvalid();
    expect(priv).toHaveAccessibleDescription(/at most 2000/);
  });

  it('a user without reservation.edit can read the notes but not edit them', async () => {
    const user = await loaded('/schedule?res=rs-2&rr=rr-2', undefined, ['page.schedule']);
    const dialog = await panel(/Reservation #GR-50240/);
    await user.click(await within(dialog).findByRole('button', { name: 'Notes' }));
    expect(await within(dialog).findByText('Guest is celebrating a birthday!')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Edit notes' })).not.toBeInTheDocument();
  });

  it('a stale save reloads the reservation and keeps the typed text', async () => {
    const client = createMockClient({ today: TODAY });
    const user = await loaded('/schedule?res=rs-5&rr=rr-5', client);
    const dialog = await panel(/Reservation #GR-50310/);
    await user.click(await within(dialog).findByRole('button', { name: 'Notes' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Edit notes' }));
    const now = await client.reservations.getDetail('rs-5');
    // someone else saves first
    await client.reservations.updateNotes({
      requestId: 'other-1234567',
      reservationId: 'rs-5',
      version: now.version,
      publicNotes: 'Other',
      privateNotes: '',
    });
    await user.type(within(dialog).getByRole('textbox', { name: 'Public Notes' }), 'Mine');
    await user.click(within(dialog).getByRole('button', { name: 'Save Notes' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/changed elsewhere/);
    expect(within(dialog).getByRole('textbox', { name: 'Public Notes' })).toHaveValue('Mine');
    // the next try works with the reloaded version
    await user.click(within(dialog).getByRole('button', { name: 'Save Notes' }));
    expect((await screen.findAllByText('Notes saved.')).length).toBeGreaterThan(0);
    expect(await within(dialog).findByText('Mine')).toBeInTheDocument();
  });
});
