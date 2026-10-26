import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { ApiError } from '../api/types';
import { MOCK_MANAGER_PIN, MOCK_STAFF_PIN } from '../api/overridePin';
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

async function openChangeRoom(client: ApiClient, granted?: Parameters<typeof setup>[1]) {
  const ctx = await openPanel(client, 'Victor Almeida', granted);
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

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});

const EDIT_ONLY = ['reservation.edit' as const];
const lockButton = (dlg: HTMLElement, name: string) =>
  within(dlg).queryByRole('button', { name: `Unlock ${name}` });

describe('the lock icons of Change Room During Stay', () => {
  it('show no lock to a user who holds the Change Reservation functions', async () => {
    const { dlg } = await openChangeRoom(createMockClient({ today: TODAY }));
    expect(within(dlg).queryByRole('button', { name: /^Unlock / })).not.toBeInTheDocument();
    expect(menu(dlg, 2)).toBeEnabled();
  });

  it('start closed for a user without them: Location, Room Type and Room cannot be changed', async () => {
    const { dlg } = await openChangeRoom(createMockClient({ today: TODAY }), EDIT_ONLY);
    for (const name of ['Location', 'Room Type', 'Room']) {
      expect(lockButton(dlg, name)).toBeInTheDocument();
    }
    expect(within(dlg).getByRole('combobox', { name: 'Location' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(dlg).getByRole('combobox', { name: 'Room type' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(menu(dlg, 2)).toBeDisabled();
  });

  it('cancel does nothing; a wrong PIN or a PIN without the function keeps it locked; a manager PIN unlocks and travels with the save', async () => {
    const { client, calls } = spied();
    const { user, dlg } = await openChangeRoom(client, EDIT_ONLY);
    await user.click(lockButton(dlg, 'Room')!);
    const prompt = await screen.findByRole('dialog', { name: 'Enter override code to unlock' });
    const field = within(prompt).getByLabelText('Override code');
    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveFocus();
    await user.click(within(prompt).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /override code/ })).toBeNull());
    await waitFor(() => expect(menu(dlg, 2)).toBeDisabled());

    await user.click(lockButton(dlg, 'Room')!);
    const again = await screen.findByRole('dialog', { name: 'Enter override code to unlock' });
    await user.type(within(again).getByLabelText('Override code'), `${MOCK_STAFF_PIN}{Enter}`);
    expect(
      (await within(again).findAllByText('That override code is not valid.')).length,
    ).toBeGreaterThan(0);
    expect(
      within(dlg).getByRole('combobox', { name: /Room for night 2/, hidden: true }),
    ).toBeDisabled();
    await user.type(within(again).getByLabelText('Override code'), `${MOCK_MANAGER_PIN}{Enter}`);
    await waitFor(() => expect(menu(dlg, 2)).toBeEnabled());
    expect(within(dlg).getByRole('button', { name: 'Room unlocked' })).toBeDisabled();
    // Location and Room Type stay locked.
    expect(lockButton(dlg, 'Room Type')).toBeInTheDocument();

    await pick(user, dlg, 2, '302');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].overrideCodes).toEqual({ room: MOCK_MANAGER_PIN });
  });

  async function unlock(user: User, name: string) {
    await user.click(
      lockButton(await screen.findByRole('dialog', { name: 'Change Room During Stay' }), name)!,
    );
    const prompt = await screen.findByRole('dialog', { name: 'Enter override code to unlock' });
    await user.type(within(prompt).getByLabelText('Override code'), `${MOCK_MANAGER_PIN}{Enter}`);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Enter override code to unlock' })).toBeNull(),
    );
  }

  it('moves focus to the unlocked field and links each locked field to its lock button', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }), EDIT_ONLY);
    expect(menu(dlg, 2)).toHaveAccessibleDescription('Room is locked. Unlock it with an override code.');
    expect(within(dlg).getByRole('combobox', { name: 'Room type' })).toHaveAccessibleDescription(
      'Room Type is locked. Unlock it with an override code.',
    );
    await unlock(user, 'Room Type');
    await waitFor(() =>
      expect(within(dlg).getByRole('combobox', { name: 'Room type' })).toHaveFocus(),
    );
    await unlock(user, 'Room');
    await waitFor(() => expect(menu(dlg, 2)).toHaveFocus());
  });

  it('a locked Location and Room Type keep the room menus to the current location and type; unlocking Location widens them', async () => {
    const { user, dlg } = await openChangeRoom(createMockClient({ today: TODAY }), EDIT_ONLY);
    await unlock(user, 'Room');
    const names = async () => {
      await user.click(menu(dlg, 5));
      const list = within(await screen.findByRole('listbox')).getAllByRole('option');
      await user.keyboard('{Escape}');
      return list.map((o) => o.textContent ?? '');
    };
    const locked = await names();
    expect(locked.some((t) => t.startsWith('Room 301'))).toBe(true);
    expect(locked.some((t) => t.startsWith('Room 110'))).toBe(false);
    expect(locked.some((t) => t.startsWith('Room 107'))).toBe(false);
    await unlock(user, 'Location');
    await unlock(user, 'Room Type');
    // Both pinned filters are free again: other locations and types are listed.
    await waitFor(async () => {
      const open = await names();
      expect(open.some((t) => t.startsWith('Room 110'))).toBe(true);
      expect(open.some((t) => t.startsWith('Room 107'))).toBe(true);
    });
  });

  it('after a refusal the reopened dialog keeps the choices but blocks Continue until the field is unlocked again', async () => {
    const base = createMockClient({ today: TODAY });
    let calls = 0;
    const client = withChange(async (r, o) => {
      calls += 1;
      if (calls === 1) throw new ApiError(403, 'no', { code: 'override-invalid' });
      return base.reservations.changeRoomDuringStay(r, o);
    }, base);
    const { user, dlg } = await openChangeRoom(client, EDIT_ONLY);
    await unlock(user, 'Room');
    await pick(user, dlg, 2, '302');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    const again = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    await within(again).findByRole('combobox', { name: /Room for night 2/ });
    const next = within(again).getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription('Unlock Room to make this change.');
    await unlock(user, 'Room');
    await waitFor(() => expect(next).toBeEnabled());
  });

  it('after a lockout the reopened prompt starts locked for the time the server named', async () => {
    const client = withChange(async () => {
      throw new ApiError(429, 'locked', {
        code: 'override-locked',
        details: { retryAfterSeconds: ['300'] },
      });
    });
    const { user, dlg } = await openChangeRoom(client, EDIT_ONLY);
    await unlock(user, 'Room');
    await pick(user, dlg, 2, '302');
    await toConfirm(user, dlg);
    await user.click(await screen.findByRole('button', { name: 'Update Reservation' }));
    const again = await screen.findByRole('dialog', { name: 'Change Room During Stay' });
    await within(again).findByRole('combobox', { name: /Room for night 2/ });
    await user.click(lockButton(again, 'Room')!);
    const prompt = await screen.findByRole('dialog', { name: 'Enter override code to unlock' });
    expect(
      within(prompt).getAllByText('Too many incorrect codes. Try again in 5 minutes.').length,
    ).toBeGreaterThan(0);
  });
});
