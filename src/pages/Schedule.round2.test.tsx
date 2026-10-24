import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient, CreateReservationRequest } from '../api/types';
import { GrantedAccess } from '../app/testing';
import ReservationPanel from '../components/reservation/ReservationPanel';
import { theme } from '../theme';
import Schedule from './Schedule';

const TODAY = '2026-10-16';

function Probe() {
  const { pathname, search } = useLocation();
  return <output data-testid="url">{pathname + search}</output>;
}

function setup(url = '/schedule', client: ApiClient = createMockClient({ today: TODAY })) {
  return render(
    <ThemeProvider theme={theme}>
      <GrantedAccess>
        <ApiProvider client={client}>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route path="/schedule" element={<Schedule today={TODAY} />} />
              <Route path="*" element={<p>Elsewhere</p>} />
            </Routes>
            <Probe />
          </MemoryRouter>
        </ApiProvider>
      </GrantedAccess>
    </ThemeProvider>,
  );
}

const url = () => screen.getByTestId('url').textContent;
const grid = () => screen.getByRole('grid', { name: 'Schedule', hidden: true });
const panel = (name: RegExp | string) => screen.findByRole('dialog', { name });
const panelGone = () =>
  waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: /Reservation|New Reservation|New Room Closure/ }),
    ).not.toBeInTheDocument(),
  );
const liveText = () =>
  screen
    .getAllByRole('status', { hidden: true })
    .map((s) => s.textContent)
    .join(' | ');

async function loaded(url_?: string, client?: ApiClient) {
  const user = userEvent.setup();
  setup(url_, client);
  await screen.findByRole('grid', { name: 'Schedule', hidden: true });
  return user;
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});

/** jsdom has no layout: a 1460px wide grid (130px headers + 7 x 190px days). */
function mockGeometry() {
  const content = grid().firstElementChild as HTMLElement;
  content.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1460,
      bottom: 900,
      width: 1460,
      height: 900,
      toJSON: () => ({}),
    }) as DOMRect;
}
/** Client x in the middle of day column `n` (7 day view). */
const colX = (n: number) => 130 + 190 * n + 95;
const rowOf = (room: string) =>
  within(grid())
    .getAllByRole('row', { hidden: true })
    .find((r) =>
      within(r).queryByRole('rowheader', { hidden: true })?.textContent?.startsWith(room),
    )!;

describe('clicking an empty date on the schedule', () => {
  it('opens New Reservation with that room and date, and Back to schedule restores the view', async () => {
    const start = '/schedule?view=7&locations=main-clubhouse';
    const user = await loaded(start);
    mockGeometry();
    fireEvent.click(rowOf('203'), { clientX: colX(3) });
    const dialog = await panel('New Reservation');
    expect(url()).toBe(start + '&panel=new&room=rm-203&arrival=2026-10-19');
    expect(within(dialog).getByLabelText('Check In')).toHaveValue('2026-10-19');
    expect(within(dialog).getByLabelText('Check Out')).toHaveValue('');
    expect(within(dialog).getByRole('combobox', { name: 'Room' })).toHaveValue('Room 203');
    expect(within(dialog).getByRole('combobox', { name: /Location/ })).toHaveTextContent(
      'Main Clubhouse',
    );
    expect(within(dialog).getByRole('combobox', { name: /Room Type/ })).toHaveTextContent(
      'King Deluxe',
    );
    expect(liveText()).toMatch(/Starting a new reservation in Room 203/);
    await user.click(within(dialog).getByRole('button', { name: 'Back to schedule' }));
    await panelGone();
    expect(url()).toBe(start);
    expect(grid()).toHaveFocus();
  });

  it('the prefilled panel reopens from the URL after a reload, once the rooms have loaded', async () => {
    await loaded('/schedule?panel=new&room=rm-C3&arrival=2026-10-20');
    const dialog = await panel('New Reservation');
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: 'Room' })).toHaveValue('Room C3'),
    );
    expect(within(dialog).getByLabelText('Check In')).toHaveValue('2026-10-20');
  });

  it('a day that has passed becomes today, with a note', async () => {
    await loaded('/schedule?start=2026-10-10');
    mockGeometry();
    fireEvent.click(rowOf('203'), { clientX: colX(2) }); // Oct 12
    const dialog = await panel('New Reservation');
    expect(url()).toContain('arrival=2026-10-12');
    expect(within(dialog).getByLabelText('Check In')).toHaveValue(TODAY);
    expect(
      within(dialog).getByText(/set to today because the day you clicked has passed/),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Check In'), {
      target: { value: '2026-10-18' },
    });
    expect(within(dialog).queryByText(/has passed/)).not.toBeInTheDocument();
  });

  it('a closure block opens the Closure details panel', async () => {
    const user = await loaded();
    mockGeometry();
    await user.click(
      screen.getByRole('gridcell', { name: /Closure, Reserved: Fixed Loss, Room 208/ }),
    );
    expect(url()).toBe('/schedule?closure=cl-1');
    await panel('Room 208 Closure');
  });

  it('the column of an existing reservation and the room header open nothing', async () => {
    await loaded();
    mockGeometry();
    fireEvent.click(rowOf('202'), { clientX: colX(1) }); // Thomas Okafor's nights
    fireEvent.click(rowOf('203'), { clientX: 60 }); // the room header column
    expect(url()).toBe('/schedule');
  });

  it('Enter on an empty cell opens it and announces; Enter on a block still opens details', async () => {
    const user = await loaded();
    grid().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}{ArrowRight}{ArrowRight}'); // 203, Oct 19
    await user.keyboard('{Enter}');
    await panel('New Reservation');
    expect(url()).toContain('panel=new&room=rm-203&arrival=2026-10-19');
    await user.keyboard('{Escape}');
    await panelGone();
    expect(grid()).toHaveFocus();
  });

  it('a drag that ends over an empty cell does not open the panel', async () => {
    await loaded();
    mockGeometry();
    const el = within(grid())
      .getAllByRole('gridcell', { hidden: true })
      .find((c) => c.getAttribute('aria-label')?.includes('Thomas Okafor'))!;
    fireEvent.pointerDown(el, { clientX: 700, clientY: 150, button: 0, pointerType: 'mouse' });
    fireEvent.pointerMove(window, { clientX: 760, clientY: 150, pointerType: 'mouse' });
    fireEvent.pointerUp(window, { clientX: 760, clientY: 150, pointerType: 'mouse' });
    fireEvent.click(rowOf('202'), { clientX: colX(5) });
    expect(url()).toBe('/schedule');
  });
});

describe('Location, Room Type and Room', () => {
  const open = async () => {
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    const location = () => within(dialog).getByRole('combobox', { name: /Location/ });
    const type = () => within(dialog).getByRole('combobox', { name: /Room Type/ });
    const room = () => within(dialog).getByRole('combobox', { name: 'Room' });
    return { user, dialog, location, type, room };
  };
  const options = () => screen.getAllByRole('option').map((o) => o.textContent);

  it('all three show Unassigned by default', async () => {
    const { location, type, room } = await open();
    expect(location()).toHaveTextContent('Unassigned');
    expect(type()).toHaveTextContent('Unassigned');
    expect(room()).toHaveValue('');
    expect(room()).toHaveAttribute('placeholder', 'Unassigned');
  });

  it('a location narrows the room types and rooms; a type narrows the locations and rooms', async () => {
    const { user, location, type, room } = await open();
    await user.click(location());
    await user.click(await screen.findByRole('option', { name: 'Lakeside Cottages' }));
    await user.click(type());
    expect(options()).toEqual(['Unassigned', 'King Deluxe', 'Two-Bedroom Cottage']);
    await user.click(screen.getByRole('option', { name: 'King Deluxe' }));
    await user.click(room());
    expect(options()).toEqual(['Unassigned', 'Room C7', 'Room C8']);
    await user.click(screen.getByRole('option', { name: 'Room C8' }));
    expect(room()).toHaveValue('Room C8');
  });

  it('a type narrows the locations', async () => {
    const { user, location, type } = await open();
    await user.click(type());
    await user.click(await screen.findByRole('option', { name: 'Suite' }));
    await user.click(location());
    expect(options()).toEqual(['Unassigned', 'Main Clubhouse', 'North Lodge']);
  });

  it('choosing a room fills Location and Room Type; changing Location clears an incompatible room', async () => {
    const { user, location, type, room } = await open();
    await user.click(room());
    await user.click(await screen.findByRole('option', { name: 'Room C7' }));
    expect(location()).toHaveTextContent('Lakeside Cottages');
    expect(type()).toHaveTextContent('King Deluxe');
    await user.click(location());
    await user.click(await screen.findByRole('option', { name: 'North Lodge' }));
    expect(room()).toHaveValue(''); // C7 is not in North Lodge
    expect(type()).toHaveTextContent('King Deluxe'); // North Lodge has king rooms too
  });

  it('Unassigned in Location or Room Type also clears the room: never "Unassigned, Room 302"', async () => {
    const { user, location, type, room } = await open();
    await user.click(room());
    await user.click(await screen.findByRole('option', { name: 'Room 302' }));
    await user.click(location());
    await user.click(await screen.findByRole('option', { name: 'Unassigned' }));
    expect(room()).toHaveValue('');
    expect(location()).toHaveTextContent('Unassigned');
    expect(type()).toHaveTextContent('Unassigned'); // filled in by the room, so it went with it
    await user.click(room());
    await user.click(await screen.findByRole('option', { name: 'Room 302' }));
    await user.click(type());
    await user.click(await screen.findByRole('option', { name: 'Unassigned' }));
    expect(room()).toHaveValue('');
    expect(location()).toHaveTextContent('Unassigned');
  });

  it('clearing the room (Clear button) undoes what it filled in', async () => {
    const { user, dialog, location, type, room } = await open();
    await user.click(room());
    await user.click(await screen.findByRole('option', { name: 'Room 302' }));
    await user.click(within(dialog).getByRole('button', { name: 'Clear room' }));
    expect(room()).toHaveValue('');
    expect(location()).toHaveTextContent('Unassigned');
    expect(type()).toHaveTextContent('Unassigned');
    await user.click(room());
    expect(options()).toHaveLength(31); // the list widened again
  });

  it('an explicit location stays when the room goes; the Unassigned entry clears the room too', async () => {
    const { user, location, type, room } = await open();
    // the user chose the location: it stays when the room goes; the Unassigned entry clears too
    await user.click(location());
    await user.click(await screen.findByRole('option', { name: 'North Lodge' }));
    await user.click(room());
    await user.click(await screen.findByRole('option', { name: 'Room 105' }));
    expect(type()).toHaveTextContent('King Deluxe');
    await user.click(room());
    await user.click((await screen.findAllByRole('option'))[0]); // Unassigned
    expect(room()).toHaveValue('');
    expect(location()).toHaveTextContent('North Lodge');
    expect(type()).toHaveTextContent('Unassigned');
  });

  it('the room list ignores the schedule filters', async () => {
    const user = await loaded('/schedule?locations=lakeside');
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
    expect(screen.getAllByRole('option')).toHaveLength(31); // 30 rooms and Unassigned
  });
});

describe('Booking Guest and Lead Occupant', () => {
  const open = async (client?: ApiClient) => {
    const user = await loaded('/schedule', client);
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    return { user, dialog };
  };

  it('Booking Guest is titled, shows TBD, and lists the first directory people when focused', async () => {
    const { user, dialog } = await open();
    expect(within(dialog).getByText('Booking Guest')).toBeInTheDocument();
    const field = within(dialog).getByRole('combobox', { name: 'Booking guest' });
    expect(field).toHaveAttribute('placeholder', 'TBD');
    expect(field).toHaveValue('');
    await user.click(field);
    const list = await screen.findByRole('listbox');
    expect(await within(list).findAllByRole('option')).toHaveLength(8);
    expect(within(list).getAllByRole('option')[0]).toHaveTextContent(
      /Annika Lindqvist \(MEM-0003\)/,
    );
    await user.type(field, 'vic');
    await waitFor(() =>
      expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1),
    );
    await user.click(screen.getByRole('option', { name: /Victor Almeida/ }));
    expect(field).toHaveValue('Victor Almeida');
  });

  it('Reserver reveals Lead Occupant (TBD) with its own +; Occupant hides it again', async () => {
    const { user, dialog } = await open();
    expect(
      within(dialog).queryByRole('combobox', { name: 'Lead occupant' }),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Reserver' }));
    const lead = within(dialog).getByRole('combobox', { name: 'Lead occupant' });
    expect(within(dialog).getByText('Lead Occupant')).toBeInTheDocument();
    expect(lead).toHaveAttribute('placeholder', 'TBD');
    expect(within(dialog).getByRole('button', { name: 'Add lead occupant' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Occupant' }));
    expect(
      within(dialog).queryByRole('combobox', { name: 'Lead occupant' }),
    ).not.toBeInTheDocument();
  });

  it('the X beside Lead Occupant clears it back to TBD; it is optional', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('radio', { name: 'Reserver' }));
    const clear = within(dialog).getByRole('button', { name: 'Clear lead occupant' });
    expect(clear).toBeDisabled();
    const lead = within(dialog).getByRole('combobox', { name: 'Lead occupant' });
    await user.click(lead);
    await user.click(await screen.findByRole('option', { name: /Beatrice Quinn/ }));
    expect(lead).toHaveValue('Beatrice Quinn');
    expect(clear).toBeEnabled();
    await user.click(clear);
    expect(lead).toHaveValue('');
    expect(clear).toBeDisabled();
    // no error for a missing lead occupant: Create goes ahead
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    expect(await panel(/Reservation #GR-7000\d/)).toBeInTheDocument();
  });

  it('the + opens Add guest: focus on Name, validation, Escape returns focus; adding selects the guest', async () => {
    const { user, dialog } = await open();
    const plus = within(dialog).getByRole('button', { name: 'Add booking guest' });
    await user.click(plus);
    const add = await screen.findByRole('dialog', { name: 'Add guest' });
    const name = within(add).getByRole('textbox', { name: /Name/ });
    expect(name).toHaveFocus();
    await user.click(within(add).getByRole('button', { name: /^Add as/ }));
    expect(await within(add).findByText(/Enter the guest/)).toBeInTheDocument();
    expect(name).toHaveFocus();
    await user.type(within(add).getByRole('textbox', { name: 'Email' }), 'nope');
    await user.type(name, 'Zed Newcomer');
    await user.click(within(add).getByRole('button', { name: /^Add as/ }));
    expect(within(add).getByText('Enter a valid email address.')).toBeInTheDocument();
    // Escape closes only the dialog; focus goes back to the + button; the panel stays
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add guest' })).not.toBeInTheDocument(),
    );
    expect(plus).toHaveFocus();
    expect(url()).toContain('panel=new');
    // add for real
    await user.click(plus);
    const again = await screen.findByRole('dialog', { name: 'Add guest' });
    expect(within(again).getByRole('textbox', { name: /Name/ })).toHaveValue(''); // a fresh form
    await user.type(within(again).getByRole('textbox', { name: /Name/ }), 'Zed Newcomer');
    await user.click(within(again).getByRole('button', { name: /^Add as/ }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add guest' })).not.toBeInTheDocument(),
    );
    expect(within(dialog).getByRole('combobox', { name: 'Booking guest' })).toHaveValue(
      'Zed Newcomer',
    );
  });

  it('the lead occupant + adds to the lead field, not the booking guest', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('radio', { name: 'Reserver' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add lead occupant' }));
    const add = await screen.findByRole('dialog', { name: 'Add guest' });
    await user.type(within(add).getByRole('textbox', { name: /Name/ }), 'Lena Visitor');
    await user.click(within(add).getByRole('button', { name: /^Add as lead occupant/ }));
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: 'Lead occupant' })).toHaveValue(
        'Lena Visitor',
      ),
    );
    expect(within(dialog).getByRole('combobox', { name: 'Booking guest' })).toHaveValue('');
  });

  it('a directory failure says so with Retry', async () => {
    const base = createMockClient({ today: TODAY });
    let fail = true;
    const { user, dialog } = await open({
      ...base,
      members: {
        ...base.members,
        search: (q, o) => (fail ? Promise.reject(new Error('down')) : base.members.search(q, o)),
      },
    });
    await user.click(within(dialog).getByRole('combobox', { name: 'Booking guest' }));
    expect(await screen.findByText('Guests could not be loaded.')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findAllByRole('option')).toHaveLength(8);
  });
});

describe('creating with TBD, Unassigned and a reserver', () => {
  it('creates with TBD and no room; the details say Unassigned and that it is off the grid', async () => {
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    const created = await panel(/Reservation #GR-7000\d/);
    expect(await within(created).findByText('Unassigned')).toBeInTheDocument();
    expect(
      within(created).getByText(
        /Shown in the Unassigned section of the schedule until a room is assigned/,
      ),
    ).toBeInTheDocument();
    expect(within(created).getAllByText('TBD').length).toBeGreaterThan(0);
    expect(await screen.findAllByText(/created without a room/)).not.toHaveLength(0);
  });

  it('sends the booking guest, the reserver role and the lead occupant', async () => {
    const base = createMockClient({ today: TODAY });
    const seen: CreateReservationRequest[] = [];
    const user = await loaded('/schedule', {
      ...base,
      reservations: {
        ...base.reservations,
        create: (r, o) => {
          seen.push(r);
          return base.reservations.create(r, o);
        },
      },
    });
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await user.click(within(dialog).getByRole('radio', { name: 'Reserver' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Booking guest' }));
    await user.click(await screen.findByRole('option', { name: /Annika Lindqvist/ }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Lead occupant' }));
    await user.click(await screen.findByRole('option', { name: /Beatrice Quinn/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    await panel(/Reservation #GR-7000\d/);
    expect(seen[0]).toMatchObject({
      roomId: null,
      guestName: 'Annika Lindqvist',
      bookingGuestRole: 'reserver',
      leadOccupant: { name: 'Beatrice Quinn' },
    });
  });
});

describe('New Room Closure tab, close button and panel side', () => {
  it('the closure tab is selectable by mouse and keyboard, shows the closure form, keeps the form', async () => {
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    const reservationTab = within(dialog).getByRole('tab', { name: 'New Reservation' });
    const closureTab = within(dialog).getByRole('tab', { name: 'New Room Closure' });
    expect(closureTab).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Increase adults' }));
    await user.click(closureTab);
    expect(closureTab).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('textbox', { name: 'Description' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Save Closure' })).toBeVisible();
    expect(within(dialog).getByRole('heading', { name: 'New Room Closure' })).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Create New Reservation' }),
    ).not.toBeInTheDocument();
    reservationTab.focus();
    await user.keyboard('{Enter}');
    expect(reservationTab).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByText('03')).toBeInTheDocument(); // adults kept
  });

  it('the close buttons use the primary (green) color', async () => {
    const user = await loaded('/schedule?res=rs-5');
    const details = await panel(/Reservation #GR-50310/);
    expect(within(details).getByRole('button', { name: 'Close reservation details' })).toHaveClass(
      'MuiIconButton-colorPrimary',
    );
    await user.keyboard('{Escape}');
    await panelGone();
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const fresh = await panel('New Reservation');
    expect(within(fresh).getByRole('button', { name: 'Close new reservation' })).toHaveClass(
      'MuiIconButton-colorPrimary',
    );
  });

  it.each([
    ['left', 'MuiDrawer-anchorLeft'],
    ['right', 'MuiDrawer-anchorRight'],
  ] as const)(
    'the panel flies out from the %s when the side setting says so',
    async (side, cls) => {
      render(
        <ThemeProvider theme={theme}>
          <GrantedAccess>
            <ApiProvider client={createMockClient({ today: TODAY })}>
              <MemoryRouter>
                <ReservationPanel
                  side={side}
                  panel={{ kind: 'new' }}
                  today={TODAY}
                  data={null}
                  dataFailed={false}
                  onRetryData={() => undefined}
                  onClose={() => undefined}
                  onCreated={() => undefined}
                  onUnknownOutcome={() => undefined}
                  onEarlyLateSaved={() => undefined}
                />
              </MemoryRouter>
            </ApiProvider>
          </GrantedAccess>
        </ThemeProvider>,
      );
      const dialog = await screen.findByRole('dialog', { name: 'New Reservation' });
      expect(dialog.closest('.MuiDrawer-root')).toHaveClass(cls);
    },
  );

  it('the default side is the one setting in layout.ts', async () => {
    const { RESERVATION_PANEL_SIDE } = await import('../app/layout');
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    expect(dialog.closest('.MuiDrawer-root')).toHaveClass(
      `MuiDrawer-anchor${RESERVATION_PANEL_SIDE === 'left' ? 'Left' : 'Right'}`,
    );
  });
});

// ---- round 3 -----------------------------------------------------------------------------------

describe('a press that moves is not a click on an empty date', () => {
  it('a drag of 10px or 60px that starts on an empty cell opens nothing; a still click does', async () => {
    await loaded();
    mockGeometry();
    for (const dx of [10, 60]) {
      const row = rowOf('203');
      fireEvent.pointerDown(row, {
        clientX: colX(3),
        clientY: 150,
        button: 0,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(window, { clientX: colX(3) + dx, clientY: 150, pointerType: 'mouse' });
      fireEvent.pointerUp(window, { clientX: colX(3) + dx, clientY: 150, pointerType: 'mouse' });
      fireEvent.click(row, { clientX: colX(3) + dx, clientY: 150 });
      expect(url()).toBe('/schedule');
    }
    const row = rowOf('203');
    fireEvent.pointerDown(row, { clientX: colX(3), clientY: 150, button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(window, { clientX: colX(3) + 1, clientY: 150, pointerType: 'mouse' });
    fireEvent.click(row, { clientX: colX(3) + 1, clientY: 150 });
    await panel('New Reservation');
    expect(url()).toContain('room=rm-203');
  });

  it('a cancelled press (a touch scroll) opens nothing, a touch tap does, the keyboard still does', async () => {
    const user = await loaded();
    mockGeometry();
    const row = rowOf('203');
    fireEvent.pointerDown(row, { clientX: colX(3), clientY: 150, pointerType: 'touch' });
    fireEvent.pointerCancel(row, { pointerType: 'touch' });
    fireEvent.click(row, { clientX: colX(3), clientY: 150 });
    expect(url()).toBe('/schedule');
    fireEvent.pointerDown(row, { clientX: colX(3), clientY: 150, pointerType: 'touch' });
    fireEvent.pointerUp(row, { clientX: colX(3), clientY: 150, pointerType: 'touch' });
    fireEvent.click(row, { clientX: colX(3), clientY: 150 });
    await panel('New Reservation');
    await user.keyboard('{Escape}');
    await panelGone();
    grid().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}{ArrowRight}{ArrowRight}{Enter}');
    await panel('New Reservation');
  });
});

describe('the toast keeps clear of the panel', () => {
  async function createUnassigned(panelSide: 'left' | 'right') {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <GrantedAccess>
          <ApiProvider client={createMockClient({ today: TODAY })}>
            <MemoryRouter initialEntries={['/schedule']}>
              <Routes>
                <Route
                  path="/schedule"
                  element={<Schedule today={TODAY} panelSide={panelSide} />}
                />
              </Routes>
            </MemoryRouter>
          </ApiProvider>
        </GrantedAccess>
      </ThemeProvider>,
    );
    await screen.findByRole('grid', { name: 'Schedule', hidden: true });
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    await screen.findByRole('dialog', { name: /Reservation #GR-7000\d/ });
    return document.querySelector('.MuiSnackbar-root');
  }

  it('right panel: the toast is bottom-left', async () => {
    expect(await createUnassigned('right')).toHaveClass('MuiSnackbar-anchorOriginBottomLeft');
  });

  it('left panel: the toast is bottom-right', async () => {
    expect(await createUnassigned('left')).toHaveClass('MuiSnackbar-anchorOriginBottomRight');
  });
});

describe('guest fields', () => {
  const open = async () => {
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    return { user, dialog: await panel('New Reservation') };
  };

  it('the dropdown and clear buttons have real names', async () => {
    const { user, dialog } = await open();
    expect(within(dialog).getByRole('button', { name: 'Show booking guests' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Show rooms' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('combobox', { name: 'Booking guest' }));
    await user.click(await screen.findByRole('option', { name: /Beatrice Quinn/ }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Room' }));
    await user.click(await screen.findByRole('option', { name: 'Room 204' }));
    expect(dialog.querySelector('button[aria-label="Clear booking guest"]')).not.toBeNull();
    expect(dialog.querySelector('button[aria-label="Clear room"]')).not.toBeNull();
    expect(
      within(dialog).queryByRole('button', { name: 'Clear', hidden: true }),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Reserver' }));
    expect(within(dialog).getByRole('button', { name: 'Show lead occupants' })).toBeInTheDocument();
  });

  it('Add guest: the Name field has focus when the dialog opens', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Add booking guest' }));
    const add = await screen.findByRole('dialog', { name: 'Add guest' });
    expect(within(add).getByRole('textbox', { name: /Name/ })).toHaveFocus();
  });

  it('the Lead Occupant X puts focus on the Lead Occupant field', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('radio', { name: 'Reserver' }));
    const lead = within(dialog).getByRole('combobox', { name: 'Lead occupant' });
    await user.click(lead);
    await user.click(await screen.findByRole('option', { name: /Beatrice Quinn/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Clear lead occupant' }));
    expect(lead).toHaveValue('');
    expect(lead).toHaveFocus();
  });
});

describe('Check In for an unassigned reservation', () => {
  it('opens the check in panel, which says to assign the room first and offers Assign now', async () => {
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await user.click(within(dialog).getByRole('button', { name: 'Create New Reservation' }));
    const created = await panel(/Reservation #GR-7000\d/);
    await user.click(await within(created).findByRole('button', { name: 'Check In' }));
    const checkIn = await panel('Check in');
    expect(
      within(checkIn).getByText('You must assign this room before check in.'),
    ).toBeInTheDocument();
    expect(within(checkIn).getByRole('button', { name: 'Complete check in' })).toBeDisabled();
    await user.click(within(checkIn).getByRole('button', { name: 'Assign now' }));
    expect(
      await within(await panel(/Reservation #GR-7000\d/)).findByText(
        /Assigning a room arrives with the Reservation Hub/,
      ),
    ).toBeInTheDocument();
  });

  it('an assigned reservation keeps an enabled Check In', async () => {
    await loaded('/schedule?res=rs-5&rr=rr-5');
    const details = await panel(/Reservation #GR-50310/);
    expect(await within(details).findByRole('button', { name: 'Check In' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });
});

describe('the time limit pauses on the New Room Closure tab', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => vi.useRealTimers());
  const tick = (ms: number) =>
    act(async () => {
      vi.advanceTimersByTime(ms);
    });

  it('shows no timer there, does not count that time, and resumes with what was left', async () => {
    const base = createMockClient({ today: TODAY });
    setup('/schedule?panel=new', {
      ...base,
      settings: {
        ...base.settings,
        getBookingHold: async () => ({ employee: 2, member: 2, nonMember: 2 }),
      },
    });
    const timer = await screen.findByRole('timer');
    await waitFor(() => expect(timer).toHaveTextContent('Time left: 02:00'));
    await tick(30_000);
    expect(timer).toHaveTextContent('Time left: 01:30');
    fireEvent.click(screen.getByRole('tab', { name: 'New Room Closure' }));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    await tick(300_000); // far longer than the limit
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'New Reservation' }));
    const resumed = await screen.findByRole('timer');
    expect(resumed).toHaveTextContent('Time left: 01:30'); // exactly what was left
    await tick(31_000);
    expect(resumed).toHaveTextContent('Time left: 00:59');
  });
});

describe('guest field controls', () => {
  const open = async () => {
    const user = await loaded();
    await user.click(screen.getByRole('button', { name: 'New Reservation' }));
    const dialog = await panel('New Reservation');
    await user.click(within(dialog).getByRole('radio', { name: 'Reserver' }));
    return { user, dialog };
  };
  const fieldRoot = (el: HTMLElement) => el.closest('.MuiOutlinedInput-root') as HTMLElement;

  it('the + is inside both fields, after the dropdown button, and named; none sits outside', async () => {
    const { dialog } = await open();
    for (const [field, add, show] of [
      ['Booking guest', 'Add booking guest', 'Show booking guests'],
      ['Lead occupant', 'Add lead occupant', 'Show lead occupants'],
    ]) {
      const root = fieldRoot(within(dialog).getByRole('combobox', { name: field }));
      const plus = within(dialog).getByRole('button', { name: add });
      const popup = within(dialog).getByRole('button', { name: show });
      expect(root.contains(plus)).toBe(true);
      // keyboard (DOM) order: input, dropdown, +
      const order = [...root.querySelectorAll('input, button')];
      const names = order.map((e) => e.getAttribute('aria-label'));
      expect(names.indexOf(show)).toBeGreaterThan(names.indexOf(field));
      expect(names.indexOf(add)).toBeGreaterThan(names.indexOf(show));
      expect(popup).toBeInTheDocument();
    }
  });

  it('the dropdown arrow and the + are siblings in one adornment row (no stacking), arrow first', async () => {
    const { user, dialog } = await open();
    for (const [show, add] of [
      ['Show booking guests', 'Add booking guest'],
      ['Show lead occupants', 'Add lead occupant'],
    ]) {
      const popup = within(dialog).getByRole('button', { name: show });
      const plus = within(dialog).getByRole('button', { name: add });
      const row = plus.parentElement!;
      expect(row.contains(popup)).toBe(true);
      expect(plus.closest('.MuiAutocomplete-endAdornment')).toBeNull(); // not inside MUI's absolute box
      const kids = [...row.querySelectorAll<HTMLElement>('button')];
      expect(kids.indexOf(popup)).toBeLessThan(kids.indexOf(plus));
      expect(getComputedStyle(plus).position).not.toBe('absolute');
    }
    // the + opens the dialog without opening the list; the arrow opens the list
    await user.click(within(dialog).getByRole('button', { name: 'Add booking guest' }));
    expect(await screen.findByRole('dialog', { name: 'Add guest' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add guest' })).not.toBeInTheDocument(),
    );
    await user.click(await within(dialog).findByRole('button', { name: 'Show booking guests' }));
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });

  it('keyboard order after the lead field: its + then the X', async () => {
    const { dialog } = await open();
    // (the disabled X is still in the DOM order; it becomes tabbable once a lead occupant is chosen)
    const all = [...dialog.querySelectorAll<HTMLElement>('input, button')];
    const label = (e: HTMLElement) => e.getAttribute('aria-label');
    const names = all.map(label);
    expect(names.indexOf('Add lead occupant')).toBeGreaterThan(names.indexOf('Lead occupant'));
    expect(names.indexOf('Clear lead occupant')).toBeGreaterThan(
      names.indexOf('Add lead occupant'),
    );
  });

  it('there is exactly one Clear lead occupant button: the outside X, red, with the same trailing space on the Booking Guest row', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('combobox', { name: 'Lead occupant' }));
    await user.click(await screen.findByRole('option', { name: /Beatrice Quinn/ }));
    const xs = dialog.querySelectorAll('button[aria-label="Clear lead occupant"]');
    expect(xs).toHaveLength(1);
    const x = xs[0] as HTMLElement;
    const lead = fieldRoot(within(dialog).getByRole('combobox', { name: 'Lead occupant' }));
    expect(lead.contains(x)).toBe(false); // beside the field, as the owner asked
    expect(x).toBeEnabled();
    expect(x).toHaveStyle({ color: theme.palette.error.main });
    // the Booking Guest row reserves the same width, so both boxes line up
    const bookingRow = fieldRoot(
      within(dialog).getByRole('combobox', { name: 'Booking guest' }),
    ).closest('.MuiAutocomplete-root')!.parentElement!;
    const spacer = bookingRow.lastElementChild as HTMLElement;
    expect(spacer).not.toBeNull();
    expect(getComputedStyle(spacer).width).toBe(getComputedStyle(x).width);
  });

  it('the X reads as disabled while the lead occupant is TBD', async () => {
    const { dialog } = await open();
    const x = within(dialog).getByRole('button', { name: 'Clear lead occupant' });
    expect(x).toBeDisabled();
    expect(x).not.toHaveStyle({ color: theme.palette.error.main });
  });
});
