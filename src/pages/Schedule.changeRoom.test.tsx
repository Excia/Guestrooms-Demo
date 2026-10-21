import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError } from '../api/types';
import type { ApiClient, ChangeRoomRequest } from '../api/types';
import { GrantedAccess } from '../app/testing';
import { theme } from '../theme';
import Schedule from './Schedule';

const TODAY = '2026-10-16';

// Victor Almeida (GR-50271, rr-14): rm-301 Suite (349.00), 10/15 to 10/20, checked in; today is
// 10/16, so night 1 (10/15) is stayed and nights 2 to 5 (10/16 to 10/19) can change. rm-110 is a free
// Suite (same rate), rm-107 and rm-108 are free Queen Standard rooms (199.00), rm-302 (Suite) is
// booked 10/17 to 10/19, rm-208 is closed 10/17 to 10/20. Daniel Whitfield (rr-2) is checked in
// too, Thomas Okafor is not yet checked in and Margaret Ellison is confirmed.
function setup(client: ApiClient, granted?: Parameters<typeof GrantedAccess>[0]['granted']) {
  return render(
    <ThemeProvider theme={theme}>
      <GrantedAccess granted={granted}>
        <ApiProvider client={client}>
          <MemoryRouter initialEntries={['/schedule?start=2026-10-14']}>
            <Routes>
              <Route path="/schedule" element={<Schedule today={TODAY} />} />
            </Routes>
          </MemoryRouter>
        </ApiProvider>
      </GrantedAccess>
    </ThemeProvider>,
  );
}

const grid = () => screen.getByRole('grid', { name: 'Schedule', hidden: true });
const cells = (text: string) =>
  within(grid())
    .getAllByRole('gridcell', { hidden: true })
    .filter((c) => c.getAttribute('aria-label')?.includes(text));
const block = (text: string) => cells(text)[0]!;

async function openPanel(
  client: ApiClient,
  who = 'Victor Almeida',
  granted?: Parameters<typeof setup>[1],
) {
  const user = userEvent.setup();
  setup(client, granted);
  await screen.findByRole('grid', { name: 'Schedule', hidden: true });
  await user.click(block(who));
  const dialog = await screen.findByRole('dialog', { name: /Reservation #/ });
  await within(dialog).findByRole('button', { name: 'Change Room' });
  return { user, dialog };
}

type User = ReturnType<typeof userEvent.setup>;

async function openChangeRoom(client: ApiClient) {
  const ctx = await openPanel(client);
  await ctx.user.click(within(ctx.dialog).getByRole('button', { name: 'Change Room' }));
  const dlg = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
  await within(dlg).findByRole('combobox', { name: /Room for night 2/ });
  return { ...ctx, dlg };
}

/** The room menu of a night: night 2 is 10/16 ... night 5 is 10/19. */
const NIGHT = { 2: '10/16/2026', 3: '10/17/2026', 4: '10/18/2026', 5: '10/19/2026' } as const;
const menu = (dlg: HTMLElement, n: keyof typeof NIGHT) =>
  within(dlg).getByRole('combobox', { name: `Room for night ${n}, ${NIGHT[n]}` });

async function pick(user: User, dlg: HTMLElement, n: keyof typeof NIGHT, room: string) {
  await user.click(menu(dlg, n));
  await user.click(await screen.findByRole('option', { name: new RegExp(`^Room ${room}`) }));
}

async function toConfirm(user: User, dlg: HTMLElement) {
  await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
  return screen.findByRole('dialog', { name: 'Confirm Room Change' });
}

/** A client whose change call is replaced (and recorded). */
function withChange(
  change: ApiClient['reservations']['changeRoomDuringStay'],
  base = createMockClient({ today: TODAY }),
): ApiClient {
  return { ...base, reservations: { ...base.reservations, changeRoomDuringStay: change } };
}
function spied(base = createMockClient({ today: TODAY })) {
  const calls: ChangeRoomRequest[] = [];
  const client: ApiClient = withChange((r, o) => {
    calls.push(r);
    return base.reservations.changeRoomDuringStay(r, o);
  }, base);
  return { client, calls };
}

const parts = () =>
  cells('GR-50271')
    .map((c) => c.getAttribute('aria-label') ?? '')
    .sort();

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});

describe('the Change Room action', () => {
  it('is enabled for a checked-in reservation', async () => {
    const { dialog } = await openPanel(createMockClient({ today: TODAY }));
    expect(within(dialog).getByRole('button', { name: 'Change Room' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('is disabled with a reason when the guest is not checked in', async () => {
    const { user, dialog } = await openPanel(createMockClient({ today: TODAY }), 'Thomas Okafor');
    const button = within(dialog).getByRole('button', { name: 'Change Room' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Available once the guest is checked in.');
    await user.click(button);
    expect(
      screen.queryByRole('dialog', { name: 'Change Room During Stay' }),
    ).not.toBeInTheDocument();
    expect(
      await within(dialog).findByText('Available once the guest is checked in.', {
        selector: '.MuiAlert-message',
      }),
    ).toBeInTheDocument();
  });

  it('is disabled for a confirmed (future) reservation too', async () => {
    const { dialog } = await openPanel(createMockClient({ today: TODAY }), 'Margaret Ellison');
    expect(within(dialog).getByRole('button', { name: 'Change Room' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('needs the reservation.edit permission (fail closed), with the reason', async () => {
    const { user, dialog } = await openPanel(
      createMockClient({ today: TODAY }),
      'Victor Almeida',
      [],
    );
    const button = within(dialog).getByRole('button', { name: 'Change Room' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(
      'You do not have permission to change this reservation.',
    );
    await user.click(button);
    expect(
      screen.queryByRole('dialog', { name: 'Change Room During Stay' }),
    ).not.toBeInTheDocument();
  });
});

describe('the nights', () => {
  it('shows the stay night by night: stayed nights locked, each remaining night with its own room menu', async () => {
    const { dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    const stayed = within(dlg).getByRole('list', { name: 'Nights already stayed' });
    expect(within(stayed).getByText('Night 1: 10/15/2026 | Room 301')).toBeInTheDocument();
    expect(within(stayed).getByTitle('Already stayed, cannot be changed')).toBeInTheDocument();
    const remaining = within(dlg).getByRole('list', { name: 'Remaining nights' });
    expect(within(remaining).getAllByRole('combobox')).toHaveLength(4);
    // Each menu starts on the night's current room.
    for (const n of [2, 3, 4, 5] as const) expect(menu(dlg, n)).toHaveValue('Room 301');
    // A stayed night has no menu.
    expect(within(dlg).queryByRole('combobox', { name: /night 1,/ })).not.toBeInTheDocument();
  });

  it('each menu lists the rooms available on THAT night, disabled ones with the reason', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    const option = (list: HTMLElement, n: string) =>
      within(list).getByRole('option', { name: new RegExp(`^Room ${n}`) });
    // Night 3 (10/17): rm-302 is booked 10/17 to 10/19, rm-208 is closed from 10/17.
    await user.click(menu(dlg, 3));
    let list = await screen.findByRole('listbox');
    expect(within(list).getByText('Main Clubhouse | Suite')).toBeInTheDocument();
    for (const [n, reason] of [
      ['302', 'Booked 10/17-10/19'],
      ['208', 'Closed 10/17-10/20'],
    ] as const) {
      expect(option(list, n)).toHaveAttribute('aria-disabled', 'true');
      expect(option(list, n)).toHaveAccessibleDescription(reason);
    }
    expect(option(list, '301')).not.toHaveAttribute('aria-disabled', 'true');
    expect(option(list, '107')).not.toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');
    // Night 2 (10/16): the same rooms are free (same-day turnover is not a conflict).
    await user.click(menu(dlg, 2));
    list = await screen.findByRole('listbox');
    expect(option(list, '302')).not.toHaveAttribute('aria-disabled', 'true');
    expect(option(list, '208')).not.toHaveAttribute('aria-disabled', 'true');
    // Night 5 (10/19): rm-302 is free again (its booking ends on 10/19).
    await user.keyboard('{Escape}');
    await user.click(menu(dlg, 5));
    list = await screen.findByRole('listbox');
    expect(option(list, '302')).not.toHaveAttribute('aria-disabled', 'true');
    expect(option(list, '208')).toHaveAttribute('aria-disabled', 'true');
  });

  it('a menu is searchable by room number, location and room type', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await user.type(menu(dlg, 2), 'lakeside cottage');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => /C\d/.test(o.textContent ?? ''))).toBe(true);
  });

  it("the optional Location and Room Type filter narrows every menu, keeping each night's own room", async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await user.click(within(dlg).getByRole('combobox', { name: 'Location' }));
    await user.click(await screen.findByRole('option', { name: 'North Lodge' }));
    await user.click(menu(dlg, 3));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    const names = options.map((o) => o.textContent ?? '');
    expect(names.some((t) => t.startsWith('Room 107'))).toBe(true);
    expect(names.some((t) => t.startsWith('Room 204'))).toBe(false);
    // The night's current room (a Main Clubhouse room) is still offered.
    expect(names.some((t) => t.startsWith('Room 301'))).toBe(true);
  });

  it('Continue is disabled with a reason until a night changes, and again when it is put back', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    const next = within(dlg).getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription('Choose a different room for at least one night.');
    await pick(user, dlg, 5, '107');
    expect(next).toBeEnabled();
    await pick(user, dlg, 5, '301');
    expect(next).toBeDisabled();
  });

  it('a disabled room cannot be chosen', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await user.click(menu(dlg, 3));
    fireEvent.click(await screen.findByRole('option', { name: /^Room 302/ }));
    expect(within(dlg).getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('opens with focus in the first night menu', async () => {
    const { dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await waitFor(() => expect(menu(dlg, 2)).toHaveFocus());
  });

  it('shows an error with Retry when the rooms cannot be loaded, and changes nothing', async () => {
    const base = createMockClient({ today: TODAY });
    let fail = true;
    const client: ApiClient = {
      ...base,
      settings: {
        ...base.settings,
        getRoomChangeRule: (o) =>
          fail ? Promise.reject(new ApiError(500, 'x')) : base.settings.getRoomChangeRule(o),
      },
    };
    const ctx = await openPanel(client);
    await ctx.user.click(within(ctx.dialog).getByRole('button', { name: 'Change Room' }));
    const dlg = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    expect(await within(dlg).findByText(/The rooms could not be loaded/)).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Continue' })).toBeDisabled();
    fail = false;
    await ctx.user.click(within(dlg).getByRole('button', { name: 'Retry' }));
    expect(
      await within(dlg).findByRole('combobox', { name: /Room for night 2/ }),
    ).toBeInTheDocument();
  });
});

describe('the confirmation', () => {
  it('summarizes the resulting room plan, grouping consecutive nights, and asks about the rate', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await pick(user, dlg, 3, '107');
    await pick(user, dlg, 4, '107');
    const confirm = await toConfirm(user, dlg);
    expect(
      within(confirm).getByText('New room plan effective 10/16/2026 through 10/20/2026:'),
    ).toBeInTheDocument();
    const plan = within(confirm).getByRole('list', { name: 'Room plan' });
    expect(
      within(plan)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Room 301: 10/16/2026 to 10/17/2026 (1 night)',
      'Room 107: 10/17/2026 to 10/19/2026 (2 nights) (changed)',
      'Room 301: 10/19/2026 to 10/20/2026 (1 night)',
    ]);
    expect(
      within(confirm).getByText(/2 nights change room\. The reservation stays checked in\./),
    ).toBeInTheDocument();
    const group = within(confirm).getByRole('radiogroup', {
      name: /Rate for the 2 nights that change room/,
    });
    const retain = within(group).getByRole('radio', {
      name: /Retain the current rate \(\$349\.00 per night\)/,
    });
    expect(retain).toBeChecked();
    expect(
      within(group).getByRole('radio', {
        name: /Update to the new rooms' rates \(\$199\.00 per night, -\$300\.00 for 2 nights\)/,
      }),
    ).not.toBeChecked();
    expect(within(confirm).getByRole('button', { name: 'Update Reservation' })).toHaveFocus();
  });

  it('does not ask when the changed nights have the same rate (another Suite)', async () => {
    const { client, calls } = spied();
    const { user, dlg } = await openChangeRoom(client);
    await pick(user, dlg, 5, '110');
    const confirm = await toConfirm(user, dlg);
    expect(within(confirm).queryByRole('radiogroup')).not.toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].rateChoice).toBeNull();
  });

  it('does not ask when the setting is off: the new rates apply', async () => {
    const base = createMockClient({ today: TODAY, roomChangeRule: { askRateOnRoomChange: false } });
    const { client, calls } = spied(base);
    const { user, dlg } = await openChangeRoom(client);
    await pick(user, dlg, 5, '107');
    const confirm = await toConfirm(user, dlg);
    expect(within(confirm).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(
      within(confirm).getByText(/new rooms' rate \(\$199\.00 per night\) applies to the 1 night/),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].rateChoice).toBeNull();
    const detail = await base.reservations.getDetail('rs-11');
    expect(detail.stay.lines.map((l) => l.amountCents)).toEqual([
      34900, 34900, 34900, 34900, 19900,
    ]);
  });

  it('Back returns to the nights with the choices kept', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await pick(user, dlg, 5, '107');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('combobox', { name: /Room for night 5/ })).toHaveValue(
      'Room 107',
    );
  });
});

describe('applying the plan', () => {
  it('change only the last night: three parts linked on the grid, panel and toast refreshed', async () => {
    const { client, calls } = spied();
    const { user, dlg, dialog } = await openChangeRoom(client);
    await pick(user, dlg, 5, '107');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));

    // The request carries the whole remaining plan and what the user saw.
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({
      reservationRoomId: 'rr-14',
      fromRoomId: 'rm-301',
      rateChoice: 'retain',
      version: 'v1',
    });
    expect(calls[0].nights).toEqual([
      { date: '2026-10-16', roomId: 'rm-301' },
      { date: '2026-10-17', roomId: 'rm-301' },
      { date: '2026-10-18', roomId: 'rm-301' },
      { date: '2026-10-19', roomId: 'rm-107' },
    ]);
    expect(calls[0].requestId).toMatch(/^[A-Za-z0-9_-]{8,128}$/);

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Confirm Room Change/ })).not.toBeInTheDocument(),
    );
    // Three linked parts, in date order: the stayed night, the rest of the stay, the last night.
    await waitFor(() => expect(parts().filter((l) => /part \d of 3/.test(l))).toHaveLength(3));
    const labels = parts();
    expect(labels.find((l) => l.includes('part 1 of 3'))).toContain(
      'checked out, Room 301, 10/15/2026 to 10/16/2026',
    );
    // A neighbour in the same room is not mentioned.
    expect(labels.find((l) => l.includes('part 1 of 3'))).not.toContain('continues in');
    expect(labels.find((l) => l.includes('part 2 of 3'))).toContain(
      'checked in, Room 301, 10/16/2026 to 10/19/2026',
    );
    expect(labels.find((l) => l.includes('part 2 of 3'))).toContain('continues in Room 107');
    expect(labels.find((l) => l.includes('part 3 of 3'))).toContain(
      'checked in, Room 107, 10/19/2026 to 10/20/2026',
    );
    expect(labels.find((l) => l.includes('part 3 of 3'))).toContain('moved from Room 301');
    // The toast, and the open details show the plan: the current room, the stay's end and the later room.
    expect((await screen.findAllByText('Moved to Room 107')).length).toBeGreaterThan(0);
    expect(
      await within(dialog).findByText(
        /Later in this stay: Room 107 \(10\/19\/2026 to 10\/20\/2026\)/,
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Check Out: 10/20/2026 (5 Nights)')).toBeInTheDocument();
    expect(within(dialog).getByText('Checked In')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Change Room' })).toHaveFocus(),
    );
  });

  it('change a middle night: four parts', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await pick(user, dlg, 3, '107');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(parts().filter((l) => /part \d of 4/.test(l))).toHaveLength(4));
    expect(parts().find((l) => l.includes('part 3 of 4'))).toContain(
      'Room 107, 10/17/2026 to 10/18/2026',
    );
  });

  it('change all remaining nights: two parts, the new room from tonight', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    for (const n of [2, 3, 4, 5] as const) await pick(user, dlg, n, '110');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(parts().filter((l) => /part \d of 2/.test(l))).toHaveLength(2));
    expect(parts().find((l) => l.includes('part 2 of 2'))).toContain(
      'Room 110, 10/16/2026 to 10/20/2026',
    );
  });

  it('putting a night back merges the parts again on a second change', async () => {
    const { user, dlg, dialog } = await openChangeRoom(createMockClient({ today: TODAY }));
    await pick(user, dlg, 5, '107');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(parts().filter((l) => /of 3/.test(l))).toHaveLength(3));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Change Room' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Change Room' }));
    const again = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    await within(again).findByRole('combobox', { name: /Room for night 5/ });
    expect(menu(again, 5)).toHaveValue('Room 107');
    await pick(user, again, 5, '301');
    await toConfirm(user, again);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(parts().filter((l) => /of 2/.test(l))).toHaveLength(2));
    expect(parts().find((l) => l.includes('part 2 of 2'))).toContain(
      'Room 301, 10/16/2026 to 10/20/2026',
    );
  });

  it('update: the new rate is sent and applied to the changed night only', async () => {
    const base = createMockClient({ today: TODAY });
    const { client, calls } = spied(base);
    const { user, dlg } = await openChangeRoom(client);
    await pick(user, dlg, 5, '107');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('radio', { name: /Update to the new rooms' rates/ }));
    await user.click(screen.getByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].rateChoice).toBe('update');
    await waitFor(async () => {
      const detail = await base.reservations.getDetail('rs-11');
      expect(detail.stay.lines.map((l) => l.amountCents)).toEqual([
        34900, 34900, 34900, 34900, 19900,
      ]);
    });
  });

  it('the confirm action works once even when clicked twice', async () => {
    const { client, calls } = spied();
    const { user, dlg } = await openChangeRoom(client);
    await pick(user, dlg, 5, '110');
    await toConfirm(user, dlg);
    await user.dblClick(await screen.findByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    await screen.findAllByText('Moved to Room 110');
    expect(calls).toHaveLength(1);
  });

  it('shows the change at once, before the server answers (optimistic), then settles', async () => {
    const base = createMockClient({ today: TODAY });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const client = withChange(async (r, o) => {
      await gate;
      return base.reservations.changeRoomDuringStay(r, o);
    }, base);
    const { user, dlg } = await openChangeRoom(client);
    await pick(user, dlg, 5, '110');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(parts().filter((l) => /of 3/.test(l))).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Change Room' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    release();
    await screen.findAllByText('Moved to Room 110');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Change Room' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
  });
});

describe('Cancel leaves everything unchanged', () => {
  it('Cancel on the nights, Cancel on the confirmation and Escape make no request', async () => {
    const { client, calls } = spied();
    const { user, dlg, dialog } = await openChangeRoom(client);

    await user.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Change Room During Stay' }),
      ).not.toBeInTheDocument(),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Change Room' }));
    const again = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    await within(again).findByRole('combobox', { name: /Room for night 5/ });
    await pick(user, again, 5, '107');
    await toConfirm(user, again);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Confirm Room Change' })).not.toBeInTheDocument(),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Change Room' }));
    await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Change Room During Stay' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Change Room' })).toHaveFocus(),
    );

    // Escape on the confirmation step also cancels everything.
    await user.click(within(dialog).getByRole('button', { name: 'Change Room' }));
    const third = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    await within(third).findByRole('combobox', { name: /Room for night 5/ });
    await pick(user, third, 5, '107');
    await toConfirm(user, third);
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Confirm Room Change' })).not.toBeInTheDocument(),
    );

    expect(calls).toHaveLength(0);
    expect(cells('GR-50271')).toHaveLength(1);
    expect(block('GR-50271')).toHaveAttribute('aria-label', expect.stringContaining('Room 301'));
    expect(screen.getByRole('dialog', { name: /Reservation #/ })).toBeInTheDocument();
  });
});

describe('failures', () => {
  async function run(error: ApiError) {
    const base = createMockClient({ today: TODAY });
    const client = withChange(() => Promise.reject(error), base);
    const { user, dlg } = await openChangeRoom(client);
    await pick(user, dlg, 5, '110');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
  }

  it('409 conflict: reverts the grid, reloads and says why', async () => {
    await run(new ApiError(409, 'x', { code: 'conflict' }));
    expect(
      (await screen.findAllByText(/no longer free for the remaining nights/)).length,
    ).toBeGreaterThan(0);
    await waitFor(() => expect(cells('GR-50271')).toHaveLength(1));
    expect(block('GR-50271')).toHaveAttribute('aria-label', expect.stringContaining('Room 301'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Change Room' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
  });

  it('409 stale: refreshes and says it changed', async () => {
    await run(new ApiError(409, 'x', { code: 'stale' }));
    expect((await screen.findAllByText(/changed by someone else/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(cells('GR-50271')).toHaveLength(1));
  });

  it('404: reverts and reloads', async () => {
    await run(new ApiError(404, 'x'));
    expect((await screen.findAllByText(/no longer exists/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(cells('GR-50271')).toHaveLength(1));
  });

  it('an unknown outcome (5xx, no response) reloads and says so neutrally, without claiming a revert', async () => {
    await run(new ApiError(503, 'x'));
    expect(
      (
        await screen.findAllByText(
          'Could not confirm the room change. Showing the latest schedule.',
        )
      ).length,
    ).toBeGreaterThan(0);
    await waitFor(() => expect(cells('GR-50271')).toHaveLength(1));
  });

  it('a timeout (status 0) is an unknown outcome too', async () => {
    await run(new ApiError(0, 'x', { code: 'timeout' }));
    expect(
      (await screen.findAllByText(/Could not confirm the room change/)).length,
    ).toBeGreaterThan(0);
  });
});
