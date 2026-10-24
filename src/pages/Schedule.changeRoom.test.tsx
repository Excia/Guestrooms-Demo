import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { decomposeColor, recomposeColor } from '@mui/material/styles';
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
    // The reason is always visible under the button (not only in a tooltip or after a click).
    expect(
      within(dialog).getByText('Available once the guest is checked in.', { selector: 'p' }),
    ).toBeVisible();
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

describe('disabled room options', () => {
  it('keep full opacity so the reason stays readable, are aria-disabled and cannot be pressed', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await user.click(menu(dlg, 3));
    const list = await screen.findByRole('listbox');
    const booked = within(list).getByRole('option', { name: /^Room 302/ });
    expect(booked).toHaveAttribute('aria-disabled', 'true');
    // The row is not dimmed (MUI's 0.38 would drop the reason below 4.5:1); the name is dim, the
    // reason is secondary text.
    expect(getComputedStyle(booked).opacity).toBe('1');
    expect(getComputedStyle(booked).pointerEvents).toBe('none');
    const reason = within(booked).getByText('Booked 10/17-10/19');
    expect(getComputedStyle(reason).color).toBe(rgb(theme.palette.text.secondary));
    expect(getComputedStyle(within(booked).getByText('Room 302')).color).toBe(
      rgb(theme.palette.text.disabled),
    );
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
        name: /Update to the new room's rate \(\$199\.00 per night, -\$300\.00 for 2 nights\)/,
      }),
    ).not.toBeChecked();
    expect(within(confirm).getByRole('button', { name: 'Update Reservation' })).toHaveFocus();
  });

  it('uses the singular for one night and one room', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await pick(user, dlg, 5, '107');
    const confirm = await toConfirm(user, dlg);
    expect(within(confirm).getByText(/1 night changes room\./)).toBeInTheDocument();
    expect(
      within(confirm).getByText(/The 1 night already stayed keeps its room and price\./),
    ).toBeInTheDocument();
    expect(
      within(confirm).getByRole('radiogroup', { name: 'Rate for the 1 night that changes room' }),
    ).toBeInTheDocument();
    expect(
      within(confirm).getByRole('radio', {
        name: /Update to the new room's rate \(\$199\.00 per night, -\$150\.00 for 1 night\)/,
      }),
    ).toBeInTheDocument();
  });

  it('uses the plural for several rooms', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await pick(user, dlg, 3, '107');
    await pick(user, dlg, 5, '108');
    const confirm = await toConfirm(user, dlg);
    expect(
      within(confirm).getByRole('radio', { name: /Update to the new rooms' rates/ }),
    ).toBeInTheDocument();
    expect(
      within(confirm).getByRole('radiogroup', { name: 'Rate for the 2 nights that change room' }),
    ).toBeInTheDocument();
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
      within(confirm).getByText(
        /new room's rate \(\$199\.00 per night\) applies to the 1 night that changes room\./,
      ),
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
  it('change only the last night: two linked blocks on the grid, panel and toast refreshed', async () => {
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
    // Two linked blocks: the stay up to the last night (the stayed night shares its room), the last night.
    await waitFor(() => expect(parts().filter((l) => /part \d of 2/.test(l))).toHaveLength(2));
    const labels = parts();
    expect(labels.find((l) => l.includes('part 1 of 2'))).toContain(
      'checked in, Room 301, 10/15/2026 to 10/19/2026',
    );
    expect(labels.find((l) => l.includes('part 1 of 2'))).toContain('continues in Room 107');
    expect(labels.find((l) => l.includes('part 2 of 2'))).toContain(
      'checked in, Room 107, 10/19/2026 to 10/20/2026',
    );
    expect(labels.find((l) => l.includes('part 2 of 2'))).toContain('moved from Room 301');
    // The toast, and the open details show the plan: the current room, the stay's end and the later room.
    expect(
      (await screen.findAllByText('Moved to Room 107 for the night of 10/19')).length,
    ).toBeGreaterThan(0);
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

  it('change a middle night: three blocks', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    await pick(user, dlg, 3, '107');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(parts().filter((l) => /part \d of 3/.test(l))).toHaveLength(3));
    expect(parts().find((l) => l.includes('part 2 of 3'))).toContain(
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
    await waitFor(() => expect(parts().filter((l) => /of 2/.test(l))).toHaveLength(2));
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
    // Unsplit again: ONE block, no link, no "part n of m".
    await waitFor(() => expect(parts().filter((l) => /part \d of/.test(l))).toHaveLength(0));
    expect(cells('GR-50271')).toHaveLength(1);
    expect(parts()[0]).toContain('Room 301, 10/15/2026 to 10/20/2026');
  });

  it('update: the new rate is sent and applied to the changed night only', async () => {
    const base = createMockClient({ today: TODAY });
    const { client, calls } = spied(base);
    const { user, dlg } = await openChangeRoom(client);
    await pick(user, dlg, 5, '107');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('radio', { name: /Update to the new room's rate/ }));
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
    await screen.findAllByText('Moved to Room 110 for the night of 10/19');
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
    await waitFor(() => expect(parts().filter((l) => /of 2/.test(l))).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'Change Room' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    release();
    await screen.findAllByText('Moved to Room 110 for the night of 10/19');
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

const REVIEW = 'The schedule changed while you were editing. Review the plan.';
const REVIEW_UNKNOWN = 'Something changed while you were editing. Review the plan.';

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

  it('409 stale: reloads, reverts and reopens the dialog on the first step with the choices kept', async () => {
    await run(new ApiError(409, 'x', { code: 'stale' }));
    expect((await screen.findAllByText(REVIEW)).length).toBeGreaterThan(0);
    const again = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    const m5 = await within(again).findByRole('combobox', { name: /Room for night 5/ });
    expect(m5).toHaveValue('Room 110'); // the user's choice, still valid
    expect(within(again).getByRole('combobox', { name: /Room for night 4/ })).toHaveValue(
      'Room 301',
    );
    expect(within(again).getByRole('button', { name: 'Continue' })).toBeEnabled();
    await waitFor(() => expect(cells('GR-50271')).toHaveLength(1)); // the grid was reverted
  });

  it("a different effective date (the server's today) reopens the dialog from that night", async () => {
    await run(
      new ApiError(409, 'x', {
        code: 'stale',
        details: { reason: ['effective-date'], today: ['2026-10-17'] },
      }),
    );
    expect((await screen.findAllByText(REVIEW)).length).toBeGreaterThan(0);
    const again = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    await within(again).findByRole('combobox', { name: /Room for night 5/ });
    // Night 2 (10/16) is now stayed: it is no longer offered, the later nights are.
    expect(
      within(again).queryByRole('combobox', { name: /Room for night 2/ }),
    ).not.toBeInTheDocument();
    expect(within(again).getByRole('combobox', { name: /Room for night 3/ })).toBeInTheDocument();
    expect(within(again).getByRole('combobox', { name: /Room for night 5/ })).toHaveValue(
      'Room 110',
    );
  });

  it('a plan or rate question that no longer fits (400 with details) reopens the same way', async () => {
    for (const details of [{ rateChoice: ['Required'] }, { nights: ['x'] }] as Record<
      string,
      string[]
    >[]) {
      await run(new ApiError(400, 'x', { code: 'invalid-query', details }));
      expect((await screen.findAllByText(REVIEW_UNKNOWN)).length).toBeGreaterThan(0);
      expect(
        await screen.findByRole('dialog', { name: 'Change Room During Stay' }),
      ).toBeInTheDocument();
      cleanup();
    }
  });

  it('a choice that is no longer valid is dropped when the dialog reopens', async () => {
    // The room chosen for night 5 is booked by someone else in the meantime.
    const base = createMockClient({ today: TODAY });
    const client = withChange(
      () => Promise.reject(new ApiError(409, 'x', { code: 'stale' })),
      base,
    );
    const { user, dlg } = await openChangeRoom(client);
    await pick(user, dlg, 5, '110');
    await toConfirm(user, dlg);
    const sched = base.schedule.get;
    client.schedule.get = async (q, o) => {
      const d = await sched(q, o);
      return {
        ...d,
        blocks: [
          ...d.blocks,
          {
            ...d.blocks[0],
            id: 'rr-x',
            reservationId: 'rs-x',
            roomId: 'rm-110',
            startDate: '2026-10-18',
            endDate: '2026-10-21',
            status: 'confirmed',
          },
        ],
      };
    };
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    const again = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    expect(await within(again).findByRole('combobox', { name: /Room for night 5/ })).toHaveValue(
      'Room 301',
    );
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

describe('a split stay inside a multi-room reservation', () => {
  // Robert and Elaine Cho (GR-50290): rm-210 (rr-10) and rm-206 (rr-11), checked in 10/13 to 10/17;
  // today is 10/16, so night 4 (10/16) is the one remaining night of each room.
  async function splitRoom210() {
    const user = userEvent.setup();
    setup(createMockClient({ today: TODAY }));
    await screen.findByRole('grid', { name: 'Schedule', hidden: true });
    const first = cells('GR-50290').find((c) =>
      c.getAttribute('aria-label')?.includes('Room 210'),
    )!;
    await user.click(first);
    const dialog = await screen.findByRole('dialog', { name: /Reservation #GR-50290/ });
    await within(dialog).findByRole('button', { name: 'Change Room' });
    expect(within(dialog).getByRole('button', { name: /^Room 210/ })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Change Room' }));
    const dlg = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    const menu4 = await within(dlg).findByRole('combobox', { name: /Room for night 4/ });
    await user.click(menu4);
    await user.click(await screen.findByRole('option', { name: /^Room 204/ }));
    await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    return { user, dialog };
  }

  it('the panel keeps showing the room that was changed after the reload (not the other room)', async () => {
    const { dialog } = await splitRoom210();
    await screen.findAllByText('Moved to Room 204');
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /^Room 204/ })).toBeInTheDocument(),
    );
    expect(within(dialog).queryByRole('button', { name: /^Room 206/ })).not.toBeInTheDocument();
  });

  it('clicking any block of the split stay opens that room, not the first room of the reservation', async () => {
    const { user, dialog } = await splitRoom210();
    await screen.findAllByText('Moved to Room 204');
    const parts210 = () =>
      cells('GR-50290').filter((c) => /part \d of 2/.test(c.getAttribute('aria-label') ?? ''));
    await waitFor(() => expect(parts210()).toHaveLength(2));
    for (const labelPart of ['part 1 of 2', 'part 2 of 2']) {
      await user.keyboard('{Escape}');
      await waitFor(() => expect(dialog).not.toBeVisible());
      const cell = parts210().find((c) => c.getAttribute('aria-label')?.includes(labelPart))!;
      await user.click(cell);
      const reopened = await screen.findByRole('dialog', { name: /Reservation #GR-50290/ });
      // The room selector of a multi-room reservation shows the room of the stay that was clicked.
      expect(
        await within(reopened).findByRole('button', { name: /^Room 204/ }),
      ).toBeInTheDocument();
    }
  });
});

const rgb = (hex: string) => recomposeColor(decomposeColor(hex));

describe('the tooltip of the block under the grid cursor follows the input modality', () => {
  async function ready() {
    const user = userEvent.setup();
    setup(createMockClient({ today: TODAY }));
    await screen.findByRole('grid', { name: 'Schedule', hidden: true });
    return user;
  }
  const tips = () => screen.queryAllByRole('tooltip', { hidden: true });

  it('is not shown when the grid gets focus from a mouse press or from code', async () => {
    await ready();
    fireEvent.pointerDown(grid());
    grid().focus();
    await user_wait();
    expect(tips()).toHaveLength(0);
  });

  it('is shown when the cursor is moved with the keyboard, and put away by a pointer press', async () => {
    const user = await ready();
    grid().focus();
    await user.keyboard('{ArrowRight}');
    const tip = await screen.findByRole('tooltip', { hidden: true });
    expect(tip).toHaveTextContent('Daniel Whitfield, GR-50240, Room 201');
    fireEvent.pointerDown(grid());
    await waitFor(() => expect(tips()).toHaveLength(0));
  });

  it('is gone, with no active descendant, when focus moves to an Unassigned block; Shift+Tab restores it', async () => {
    const user = await ready();
    grid().focus();
    await user.keyboard('{ArrowRight}');
    await screen.findByRole('tooltip', { hidden: true });
    expect(grid()).toHaveAttribute('aria-activedescendant');
    await user.tab();
    expect(grid()).not.toHaveFocus();
    expect(grid().contains(document.activeElement)).toBe(true);
    expect(grid()).not.toHaveAttribute('aria-activedescendant');
    await waitFor(() =>
      expect(tips().filter((t) => t.textContent?.includes('GR-50240'))).toHaveLength(0),
    );
    await user.tab({ shift: true });
    expect(grid()).toHaveFocus();
    expect(grid()).toHaveAttribute('aria-activedescendant');
  });

  it('is gone when the grid loses focus', async () => {
    const user = await ready();
    grid().focus();
    await user.keyboard('{ArrowRight}');
    await screen.findByRole('tooltip', { hidden: true });
    grid().blur();
    await waitFor(() => expect(tips()).toHaveLength(0));
  });
});

const user_wait = () => new Promise((r) => setTimeout(r, 50));

describe('a long stay (windowed night list)', () => {
  // Victor Almeida's stay is stretched to 100 more nights: the dialog lists its nights in a scrolling,
  // windowed container.
  function longStay(): ApiClient {
    const base = createMockClient({ today: TODAY });
    const END = '2027-01-24';
    return {
      ...base,
      schedule: {
        ...base.schedule,
        get: async (q, o) => {
          const d = await base.schedule.get(q, o);
          return {
            ...d,
            blocks: d.blocks.map((b) => (b.id === 'rr-14' ? { ...b, endDate: END } : b)),
          };
        },
      },
      reservations: {
        ...base.reservations,
        getDetail: async (id, o) => {
          const d = await base.reservations.getDetail(id, o);
          return {
            ...d,
            departure: END,
            nights: 101,
            rooms: d.rooms.map((r) => (r.id === 'rr-14' ? { ...r, departure: END } : r)),
          };
        },
      },
    };
  }

  async function openLong() {
    const ctx = await openPanel(longStay());
    await ctx.user.click(within(ctx.dialog).getByRole('button', { name: 'Change Room' }));
    const dlg = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    const region = await within(dlg).findByRole('region', {
      name: /Remaining nights, scroll for more/,
    });
    return { ...ctx, dlg, region };
  }
  const inputs = (root: HTMLElement) => within(root).queryAllByRole('combobox');
  // jsdom has no layout: give the scroll container a scrollTop it keeps.
  const scrollTo = (region: HTMLElement, top: number) => {
    Object.defineProperty(region, 'scrollTop', { configurable: true, value: top });
    fireEvent.scroll(region);
  };

  it('renders only the rows in view and focuses the first menu once, when step 1 first shows', async () => {
    const { region } = await openLong();
    expect(inputs(region).length).toBeLessThan(20);
    await waitFor(() => expect(inputs(region)[0]).toHaveFocus());
  });

  it('scrolling back up does not pull focus into the first row again', async () => {
    const { dlg, region } = await openLong();
    await waitFor(() => expect(inputs(region)[0]).toHaveFocus());
    // Focus a row further down, then scroll to the end and back to the top.
    const lower = inputs(region)[3];
    lower.focus();
    scrollTo(region, 8000);
    // Rows far down are rendered now (night 80 or later), and the focused row is still there too.
    await waitFor(() =>
      expect(
        inputs(region).some((i) =>
          /night (7[5-9]|8\d|9\d|10\d),/.test(i.getAttribute('aria-label') ?? ''),
        ),
      ).toBe(true),
    );
    expect(lower).toBeInTheDocument();
    scrollTo(region, 0);
    await waitFor(() => expect(inputs(region).length).toBeGreaterThan(0));
    // The row that had focus stayed rendered while it was scrolled out of view: focus never moved.
    expect(lower).toBeInTheDocument();
    expect(lower).toHaveFocus();
    expect(dlg).toContainElement(document.activeElement as HTMLElement);
  });

  it('with focus outside the list, scrolling away and back leaves focus alone', async () => {
    const { dlg, region } = await openLong();
    await waitFor(() => expect(inputs(region)[0]).toHaveFocus());
    const cancel = within(dlg).getByRole('button', { name: 'Cancel' });
    cancel.focus();
    scrollTo(region, 8000);
    await waitFor(() =>
      expect(within(region).queryAllByRole('combobox').length).toBeGreaterThan(0),
    );
    // The first row is gone (nothing in it had focus any more); scrolling back must not refocus it.
    scrollTo(region, 0);
    await waitFor(() => expect(inputs(region).length).toBeGreaterThan(0));
    expect(cancel).toHaveFocus();
  });
});

describe('long block text', () => {
  it('no tooltip lingers on the block under the keyboard cursor while a panel is open (the grid has no focus)', async () => {
    await openPanel(createMockClient({ today: TODAY }));
    // (A closing tooltip stays in the DOM for its exit transition.)
    await waitFor(() => expect(screen.queryAllByRole('tooltip', { hidden: true })).toHaveLength(0));
  });

  it('shows the full text in a tooltip on hover only when cut off, created lazily, without a second announcement', async () => {
    const user = userEvent.setup();
    setup(createMockClient({ today: TODAY }));
    await screen.findByRole('grid', { name: 'Schedule', hidden: true });
    const cell = block('Victor Almeida');
    const label = cell.getAttribute('aria-label');
    // Nothing is created before the first hover.
    expect(screen.queryAllByRole('tooltip', { hidden: true })).toHaveLength(0);
    // Not cut off: no tooltip, and no native title either (the browser would show its own).
    await user.hover(cell);
    expect(cell.querySelectorAll('[title]')).toHaveLength(0);
    expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument();
    await user.unhover(cell);
    // Cut off (the ellipsis shows): the tooltip names guest, confirmation number and room.
    const width = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(300);
    const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    await user.hover(cell);
    // The tooltip is hidden from assistive technology: the cell's own name already says it all.
    const tip = await screen.findByRole('tooltip', { hidden: true });
    // Never the browser's own tooltip: no native `title`, anywhere on the block, open or closed.
    expect(cell.querySelectorAll('[title]')).toHaveLength(0);
    expect(cell).not.toHaveAttribute('title');
    expect(tip).toHaveTextContent('Victor Almeida, GR-50271, Room 301');
    // The accessible name is unchanged and the cell is not described twice.
    expect(cell.getAttribute('aria-label')).toBe(label);
    expect(cell).not.toHaveAttribute('aria-describedby');
    expect(cell).not.toHaveAttribute('aria-labelledby');
    await user.unhover(cell);
    await waitFor(() =>
      expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument(),
    );
    width.mockRestore();
    client.mockRestore();
  });
});
