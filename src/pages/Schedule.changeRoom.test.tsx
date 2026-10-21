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

// Daniel Whitfield (GR-50240, rr-2): rm-201 King Deluxe, 10/15 to 10/18, checked in. rm-205 is a
// Queen Standard (199.00 against 249.00), rm-209 a King Deluxe (same rate); rm-202 and rm-203 are
// booked, rm-208 is closed.
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
  who = 'Daniel Whitfield',
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

async function openChangeRoom(client: ApiClient) {
  const ctx = await openPanel(client);
  await ctx.user.click(within(ctx.dialog).getByRole('button', { name: 'Change Room' }));
  const dlg = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
  const input = await within(dlg).findByRole('combobox', { name: 'New room' });
  return { ...ctx, dlg, input };
}

async function pick(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, room: string) {
  await user.click(input);
  await user.click(await screen.findByRole('option', { name: new RegExp(`^Room ${room}`) }));
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
      'Daniel Whitfield',
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

describe('the room menu', () => {
  it('lists every room grouped by location | room type, with disabled rooms and their reasons', async () => {
    const { user, input } = await openChangeRoom(createMockClient({ today: TODAY }));
    await user.click(input);
    const list = await screen.findByRole('listbox');
    expect(within(list).getByText('Main Clubhouse | King Deluxe')).toBeInTheDocument();
    const option = (n: string) =>
      within(list).getByRole('option', { name: new RegExp(`^Room ${n}`) });
    // Disabled rooms carry aria-disabled and their reason, also as the description.
    for (const [n, reason] of [
      ['201', 'Same room'],
      ['202', 'Booked 10/16-10/19'],
      ['203', 'Booked 10/16-10/17'],
      ['208', 'Closed 10/17-10/20'],
    ] as const) {
      expect(option(n)).toHaveAttribute('aria-disabled', 'true');
      expect(option(n)).toHaveAccessibleDescription(reason);
    }
    // Free rooms are enabled, including the same-day turnover room (204 is booked from the departure day).
    for (const n of ['204', '205', '209']) {
      expect(option(n)).not.toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('is searchable by room number, location and room type', async () => {
    const { user, input } = await openChangeRoom(createMockClient({ today: TODAY }));
    await user.type(input, 'lakeside cottage');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => /C\d/.test(o.textContent ?? ''))).toBe(true);
    await user.clear(input);
    await user.type(input, 'zzz');
    expect(await screen.findByText('No rooms match.')).toBeInTheDocument();
  });

  it('a disabled room cannot be chosen', async () => {
    const { user, dlg, input } = await openChangeRoom(createMockClient({ today: TODAY }));
    await user.click(input);
    fireEvent.click(await screen.findByRole('option', { name: /^Room 202/ }));
    expect(within(dlg).getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('the dialog opens with focus in the search field and shows the nights already stayed', async () => {
    const { dlg, input } = await openChangeRoom(createMockClient({ today: TODAY }));
    await waitFor(() => expect(input).toHaveFocus());
    expect(within(dlg).getByText('Night 1: 10/15/2026 | Room 201')).toBeInTheDocument();
    expect(
      within(dlg).getByText(/From 10\/16\/2026 through 10\/18\/2026 \(2 nights\)/),
    ).toBeInTheDocument();
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
    expect(await within(dlg).findByRole('combobox', { name: 'New room' })).toBeInTheDocument();
  });
});

describe('the confirmation', () => {
  it('states old and new room and the effective dates, and asks about the rate when the rates differ', async () => {
    const { user, dlg, input } = await openChangeRoom(createMockClient({ today: TODAY }));
    await pick(user, input, '205');
    await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
    const confirm = await screen.findByRole('dialog', { name: 'Confirm Room Change' });
    expect(
      within(confirm).getByText(
        'Move from Room 201 to Room 205 effective 10/16/2026 through 10/18/2026.',
      ),
    ).toBeInTheDocument();
    const group = within(confirm).getByRole('radiogroup', {
      name: /Rate for the remaining 2 nights/,
    });
    const retain = within(group).getByRole('radio', {
      name: /Retain the current rate \(\$249\.00 per night\)/,
    });
    expect(retain).toBeChecked();
    expect(
      within(group).getByRole('radio', {
        name: /Update to the new room's rate \(\$199\.00 per night, -\$100\.00 for 2 nights\)/,
      }),
    ).not.toBeChecked();
    // The primary action has focus.
    expect(within(confirm).getByRole('button', { name: 'Move to New Room' })).toHaveFocus();
  });

  it('does not ask when the new room has the same rate', async () => {
    const { client, calls } = spied();
    const { user, dlg, input } = await openChangeRoom(client);
    await pick(user, input, '209');
    await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
    const confirm = await screen.findByRole('dialog', { name: 'Confirm Room Change' });
    expect(within(confirm).queryByRole('radiogroup')).not.toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Move to New Room' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ toRoomId: 'rm-209', rateChoice: null, effectiveDate: TODAY });
  });

  it('does not ask when the setting is off: the new rates apply', async () => {
    const base = createMockClient({ today: TODAY, roomChangeRule: { askRateOnRoomChange: false } });
    const { client, calls } = spied(base);
    const { user, dlg, input } = await openChangeRoom(client);
    await pick(user, input, '205');
    await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
    const confirm = await screen.findByRole('dialog', { name: 'Confirm Room Change' });
    expect(within(confirm).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(
      within(confirm).getByText(/new room's rate \(\$199\.00 per night\) applies/),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Move to New Room' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].rateChoice).toBeNull();
    const detail = await base.reservations.getDetail('rs-2');
    expect(detail.stay.lines.map((l) => l.amountCents)).toEqual([24900, 19900, 19900]);
  });

  it('Back returns to the room menu with the choice kept', async () => {
    const { user, dlg, input } = await openChangeRoom(createMockClient({ today: TODAY }));
    await pick(user, input, '205');
    await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('combobox', { name: 'New room' })).toHaveValue('Room 205');
  });
});

describe('applying the change', () => {
  it('retain: sends the guard and the choice, moves the stay and refreshes grid, panel and toast', async () => {
    const { client, calls } = spied();
    const { user, dlg, input, dialog } = await openChangeRoom(client);
    await pick(user, input, '205');
    await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Move to New Room' }));

    // The request carries what the user saw.
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({
      reservationRoomId: 'rr-2',
      fromRoomId: 'rm-201',
      toRoomId: 'rm-205',
      effectiveDate: TODAY,
      rateChoice: 'retain',
      version: 'v1',
    });
    expect(calls[0].requestId).toMatch(/^[A-Za-z0-9_-]{8,128}$/);

    // The dialog closed, the schedule shows both segments, linked.
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /Room Change|Change Room During Stay/ }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(cells('moved to Room 205')).toHaveLength(1));
    expect(cells('moved to Room 205')[0]).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Room 201, 10/15/2026 to 10/16/2026'),
    );
    expect(cells('moved from Room 201')[0]).toHaveAttribute(
      'aria-label',
      expect.stringContaining('checked in, Room 205, 10/16/2026 to 10/18/2026'),
    );
    // The toast, and the open details show the new room and the earlier one.
    expect((await screen.findAllByText('Moved to Room 205')).length).toBeGreaterThan(0);
    expect(await within(dialog).findByText('Room 205')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Earlier in this stay: Room 201 \(10\/15\/2026 to 10\/16\/2026\)/),
    ).toBeInTheDocument();
    // Still checked in.
    expect(within(dialog).getByText('Checked In')).toBeInTheDocument();
    // Focus is back on the button that opened the dialog.
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Change Room' })).toHaveFocus(),
    );
  });

  it('update: the new rate is sent and applied to the nights not yet stayed', async () => {
    const base = createMockClient({ today: TODAY });
    const { client, calls } = spied(base);
    const { user, dlg, input } = await openChangeRoom(client);
    await pick(user, input, '205');
    await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('radio', { name: /Update to the new room's rate/ }));
    await user.click(screen.getByRole('button', { name: 'Move to New Room' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].rateChoice).toBe('update');
    await waitFor(async () => {
      const detail = await base.reservations.getDetail('rs-2');
      expect(detail.stay.lines.map((l) => l.amountCents)).toEqual([24900, 19900, 19900]);
    });
  });

  it('the confirm action works once even when clicked twice', async () => {
    const { client, calls } = spied();
    const { user, dlg, input } = await openChangeRoom(client);
    await pick(user, input, '209');
    await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
    const go = await screen.findByRole('button', { name: 'Move to New Room' });
    await user.dblClick(go);
    await waitFor(() => expect(calls).toHaveLength(1));
    await screen.findAllByText('Moved to Room 209');
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
    const { user, dlg, input } = await openChangeRoom(client);
    await pick(user, input, '209');
    await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Move to New Room' }));
    await waitFor(() => expect(cells('moved to Room 209')).toHaveLength(1));
    // While saving, the action is unavailable.
    expect(screen.getByRole('button', { name: 'Change Room' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    release();
    await screen.findAllByText('Moved to Room 209');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Change Room' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
  });
});

describe('Cancel leaves everything unchanged', () => {
  it('Cancel on the room menu, Cancel on the confirmation and Escape make no request', async () => {
    const { client, calls } = spied();
    const { user, dlg, input, dialog } = await openChangeRoom(client);

    await user.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Change Room During Stay' }),
      ).not.toBeInTheDocument(),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Change Room' }));
    const again = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    await pick(user, await within(again).findByRole('combobox', { name: 'New room' }), '205');
    await user.click(within(again).getByRole('button', { name: 'Continue' }));
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
    // Focus goes back to the button that opened it.
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Change Room' })).toHaveFocus(),
    );
    // Escape on the confirmation step also cancels everything.
    await user.click(within(dialog).getByRole('button', { name: 'Change Room' }));
    const third = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    await pick(user, await within(third).findByRole('combobox', { name: 'New room' }), '205');
    await user.click(within(third).getByRole('button', { name: 'Continue' }));
    await screen.findByRole('dialog', { name: 'Confirm Room Change' });
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Confirm Room Change' })).not.toBeInTheDocument(),
    );

    expect(calls).toHaveLength(0);
    expect(input).toBeDefined();
    expect(cells('GR-50240')).toHaveLength(1);
    expect(block('GR-50240')).toHaveAttribute('aria-label', expect.stringContaining('Room 201'));
    // The reservation panel is still open.
    expect(screen.getByRole('dialog', { name: /Reservation #/ })).toBeInTheDocument();
  });
});

describe('failures', () => {
  async function run(error: ApiError) {
    const base = createMockClient({ today: TODAY });
    const client = withChange(() => Promise.reject(error), base);
    const { user, dlg, input } = await openChangeRoom(client);
    await pick(user, input, '209');
    await user.click(within(dlg).getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Move to New Room' }));
  }

  it('409 conflict: reverts the grid, reloads and says why', async () => {
    await run(new ApiError(409, 'x', { code: 'conflict' }));
    expect(
      (await screen.findAllByText(/no longer free for the remaining nights/)).length,
    ).toBeGreaterThan(0);
    await waitFor(() => expect(cells('moved')).toHaveLength(0));
    expect(block('GR-50240')).toHaveAttribute('aria-label', expect.stringContaining('Room 201'));
    // The action is available again.
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
    await waitFor(() => expect(cells('moved')).toHaveLength(0));
  });

  it('404: reverts and reloads', async () => {
    await run(new ApiError(404, 'x'));
    expect((await screen.findAllByText(/no longer exists/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(cells('moved')).toHaveLength(0));
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
    // The reload shows what the server really has (nothing was applied by this fake).
    await waitFor(() => expect(cells('moved')).toHaveLength(0));
  });

  it('a timeout (status 0) is an unknown outcome too', async () => {
    await run(new ApiError(0, 'x', { code: 'timeout' }));
    expect(
      (await screen.findAllByText(/Could not confirm the room change/)).length,
    ).toBeGreaterThan(0);
  });
});
