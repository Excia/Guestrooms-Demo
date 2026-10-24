import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { SystemSettingsProvider } from '../app/SystemSettingsProvider';
import { GrantedAccess } from '../app/testing';
import { theme } from '../theme';
import Schedule from './Schedule';

const TODAY = '2026-10-16';

function setup(
  url: string,
  client: ApiClient,
  granted?: Parameters<typeof GrantedAccess>[0]['granted'],
  withSettings = false,
) {
  const routes = (
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/schedule" element={<Schedule today={TODAY} />} />
        <Route path="*" element={<p>Elsewhere</p>} />
      </Routes>
    </MemoryRouter>
  );
  return render(
    <ThemeProvider theme={theme}>
      <GrantedAccess granted={granted}>
        <ApiProvider client={client}>
          {withSettings ? <SystemSettingsProvider>{routes}</SystemSettingsProvider> : routes}
        </ApiProvider>
      </GrantedAccess>
    </ThemeProvider>,
  );
}

// Audited through the 10th: the seeded check ins (arrivals 13th to 15th) can still be undone.
const before = () => createMockClient({ today: TODAY, lastAuditedDate: '2026-10-10' });
const after = () => createMockClient({ today: TODAY });

async function open(
  url: string,
  client: ApiClient,
  name: RegExp,
  granted?: Parameters<typeof setup>[2],
  withSettings = false,
) {
  const user = userEvent.setup();
  setup(url, client, granted, withSettings);
  const dialog = await screen.findByRole('dialog', { name });
  await within(dialog).findByRole('button', { name: 'More reservation actions' });
  return { user, dialog };
}

const menuItems = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
  await user.click(within(dialog).getByRole('button', { name: 'More reservation actions' }));
  return within(await screen.findByRole('menu'))
    .getAllByRole('menuitem')
    .map((m) => m.textContent);
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});

describe('reservation menu by state', () => {
  it('checked in before the night audit: Undo Check In first', async () => {
    const { user, dialog } = await open('/schedule?res=rs-2', before(), /Reservation #GR-50240/);
    expect(await menuItems(user, dialog)).toEqual([
      'Undo Check In',
      'Edit Reservation',
      'Add Another Room',
      'Print Registration Card(s)',
      'Jump to Folio',
    ]);
  });

  it('checked in after the night audit ran for that date: no Undo Check In', async () => {
    const { user, dialog } = await open('/schedule?res=rs-2', after(), /Reservation #GR-50240/);
    expect(await menuItems(user, dialog)).toEqual([
      'Edit Reservation',
      'Add Another Room',
      'Print Registration Card(s)',
      'Jump to Folio',
    ]);
  });

  it('read-only users keep only Print and Jump to Folio', async () => {
    const { user, dialog } = await open(
      '/schedule?res=rs-5&rr=rr-5',
      before(),
      /Reservation #GR-50310/,
      [],
    );
    expect(await menuItems(user, dialog)).toEqual(['Print Registration Card(s)', 'Jump to Folio']);
  });

  it('Print Registration Card(s) renders the saved settings for this reservation in a new tab', async () => {
    const tab = { location: { href: '' }, close: vi.fn(), opener: {} };
    const open_ = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const client = before();
    const settings = await client.systemSettings.get();
    // A saved setting that differs from the default: the room type prints.
    await client.systemSettings.save({
      ...settings,
      registrationCard: {
        ...settings.registrationCard,
        items: { ...settings.registrationCard.items, roomType: true },
      },
    });
    const request = vi
      .spyOn(client.registrationCard, 'requestPreview')
      .mockResolvedValue({ url: 'blob:card' });
    const { user, dialog } = await open(
      '/schedule?res=rs-5&rr=rr-5',
      client,
      /Reservation #GR-50310/,
      undefined,
      true,
    );
    await waitFor(async () => {
      expect(await menuItems(user, dialog)).toContain('Print Registration Card(s)');
    });
    await user.click(screen.getByRole('menuitem', { name: 'Print Registration Card(s)' }));
    await waitFor(() => expect(tab.location.href).toBe('blob:card'));
    const sent = request.mock.calls[0][0];
    expect(sent.settings.items.roomType).toBe(true);
    expect(sent.reservation?.confirmationNumber).toBe('GR-50310');
    open_.mockRestore();
  });

  it('says so when the registration card cannot be opened', async () => {
    const open_ = vi.spyOn(window, 'open').mockReturnValue(null);
    const { user, dialog } = await open(
      '/schedule?res=rs-5&rr=rr-5',
      before(),
      /Reservation #GR-50310/,
    );
    await menuItems(user, dialog);
    await user.click(screen.getByRole('menuitem', { name: 'Print Registration Card(s)' }));
    expect(await within(dialog).findByText(/blocked the new tab/)).toBeInTheDocument();
    open_.mockRestore();
  });
});

describe('Registration Card setting', () => {
  it('hides Print Registration Card(s) once System Settings turns the card off', async () => {
    const client = before();
    const settings = await client.systemSettings.get();
    await client.systemSettings.save({
      ...settings,
      registrationCard: { ...settings.registrationCard, enabled: false },
    });
    const { user, dialog } = await open(
      '/schedule?res=rs-5&rr=rr-5',
      client,
      /Reservation #GR-50310/,
      undefined,
      true,
    );
    // The settings arrive after the panel opens; poll the menu, closing it between looks.
    await waitFor(async () => {
      const items = await menuItems(user, dialog);
      await user.keyboard('{Escape}');
      expect(items).not.toContain('Print Registration Card(s)');
      expect(items).toContain('Jump to Folio');
    });
  });

  it('keeps Print Registration Card(s) while the card is on', async () => {
    const { user, dialog } = await open(
      '/schedule?res=rs-5&rr=rr-5',
      before(),
      /Reservation #GR-50310/,
      undefined,
      true,
    );
    expect(await menuItems(user, dialog)).toContain('Print Registration Card(s)');
  });
});

describe('Undo Check In', () => {
  it('undoes the check in and updates the panel', async () => {
    const { user, dialog } = await open('/schedule?res=rs-2', before(), /Reservation #GR-50240/);
    await menuItems(user, dialog);
    await user.click(screen.getByRole('menuitem', { name: 'Undo Check In' }));
    expect(
      await within(dialog).findByText(/Check in undone for reservation #GR-50240/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText('Checked In')).not.toBeInTheDocument();
    expect(await within(dialog).findByRole('button', { name: 'Check In' })).toBeInTheDocument();
  });

  it('says why when the audit has closed the date meanwhile, and reloads', async () => {
    const client = before();
    const { user, dialog } = await open('/schedule?res=rs-2', client, /Reservation #GR-50240/);
    const { ApiError } = await import('../api/types');
    vi.spyOn(client.reservations, 'undoCheckIn').mockRejectedValue(
      new ApiError(409, 'closed', { code: 'audit-closed' }),
    );
    await menuItems(user, dialog);
    await user.click(screen.getByRole('menuitem', { name: 'Undo Check In' }));
    expect(await within(dialog).findByText(/night audit has already run/)).toBeInTheDocument();
  });

  it('the room selector offers Undo Check In per room before the audit and Check Out Room after', async () => {
    const first = await open('/schedule?res=rs-8', before(), /Reservation #GR-50290/);
    expect(
      await within(first.dialog).findByRole('button', { name: 'Undo Check In' }),
    ).toBeInTheDocument();
  });
});

describe('room selector Undo Check In', () => {
  it('is hidden for a checked-in room once another room has checked out', async () => {
    const client = before();
    const real = client.reservations.getDetail.bind(client.reservations);
    vi.spyOn(client.reservations, 'getDetail').mockImplementation(async (id, o) => {
      const d = await real(id, o);
      return id === 'rs-8'
        ? { ...d, rooms: d.rooms.map((r, i) => (i === 1 ? { ...r, status: 'checked-out' } : r)) }
        : d;
    });
    const { dialog } = await open('/schedule?res=rs-8&rr=rr-10', client, /Reservation #GR-50290/);
    expect(
      await within(dialog).findByRole('button', { name: 'Check Out Room' }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Undo Check In' })).not.toBeInTheDocument();
  });
});

describe('Cancel Reservation', () => {
  it('asks for confirmation; keeping leaves the reservation alone, cancelling cancels it', async () => {
    const { user, dialog } = await open(
      '/schedule?res=rs-5&rr=rr-5',
      before(),
      /Reservation #GR-50310/,
    );
    await menuItems(user, dialog);
    await user.click(screen.getByRole('menuitem', { name: 'Cancel Reservation' }));
    const confirm = await screen.findByRole('dialog', { name: 'Cancel this reservation?' });
    // The safe choice has focus.
    expect(within(confirm).getByRole('button', { name: 'No, Keep Reservation' })).toHaveFocus();
    await user.click(within(confirm).getByRole('button', { name: 'No, Keep Reservation' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Cancel this reservation?' }),
      ).not.toBeInTheDocument(),
    );
    expect(within(dialog).queryByText('Canceled')).not.toBeInTheDocument();

    await menuItems(user, dialog);
    await user.click(screen.getByRole('menuitem', { name: 'Cancel Reservation' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Cancel this reservation?' })).getByRole(
        'button',
        {
          name: 'Yes, Cancel Reservation',
        },
      ),
    );
    expect(await within(dialog).findByText('Reservation #GR-50310 cancelled.')).toBeInTheDocument();
    expect(await within(dialog).findByText('Canceled')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /^Cancel/ })).not.toBeInTheDocument(),
    );
    expect(await menuItems(user, dialog)).toEqual(['Jump to Folio']);
  });

  it('a multi-room reservation is cancelled as all rooms', async () => {
    const { user, dialog } = await open(
      '/schedule?res=rs-7&rr=rr-8',
      before(),
      /Reservation #GR-50321/,
    );
    await menuItems(user, dialog);
    await user.click(screen.getByRole('menuitem', { name: 'Cancel Reservation' }));
    expect(await screen.findByRole('dialog', { name: 'Cancel all rooms?' })).toBeInTheDocument();
  });
});

describe('multi-room selector', () => {
  it('lists every room with its status, marks the shown one and switches the hub', async () => {
    const { user, dialog } = await open(
      '/schedule?res=rs-7&rr=rr-8',
      before(),
      /Reservation #GR-50321/,
    );
    await user.click(within(dialog).getByRole('button', { name: /Choose a room/ }));
    const list = await screen.findByRole('menu', { name: 'Rooms of this reservation' });
    const items = within(list).getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    items.forEach((i) => expect(i).toHaveTextContent(/Not yet checked in/));
    expect(items.filter((i) => i.classList.contains('Mui-selected'))).toHaveLength(1);
    const target = items[2].textContent!.split(' · ')[0];
    await user.click(items[2]);
    expect(within(dialog).getByRole('button', { name: /Choose a room/ }).textContent).toContain(
      target,
    );
  });
});
