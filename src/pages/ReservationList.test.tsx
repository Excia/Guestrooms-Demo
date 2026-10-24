import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient, ReservationListQuery, ReservationListRow } from '../api';
import { theme } from '../theme';
import ReservationList from './ReservationList';

const TODAY = '2026-10-16';

function Probe() {
  const { pathname, search } = useLocation();
  return <output data-testid="url">{pathname + search}</output>;
}

function spied(options: Parameters<typeof createMockClient>[0] = {}) {
  const base = createMockClient({ today: TODAY, ...options });
  const list = vi.fn((q?: ReservationListQuery, o?: { signal?: AbortSignal }) =>
    base.reservationList.list(q, o),
  );
  const client: ApiClient = { ...base, reservationList: { ...base.reservationList, list } };
  return { client, list };
}

function setup(
  url = '/reservations',
  client: ApiClient = createMockClient({ today: TODAY }),
  props: Partial<Parameters<typeof ReservationList>[0]> = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/reservations" element={<ReservationList today={TODAY} {...props} />} />
            <Route path="*" element={<p>Elsewhere</p>} />
          </Routes>
          <Probe />
        </MemoryRouter>
      </ApiProvider>
    </ThemeProvider>,
  );
}

const url = () => screen.getByTestId('url').textContent;
const table = () => screen.findByRole('table', { name: 'Reservations' });
const bodyRows = async () => {
  const t = await table();
  await waitFor(() => expect(within(t).queryByText('Loading reservations')).toBeNull());
  return within(t).getAllByRole('row').slice(1);
};
const rowFor = async (conf: string) => (await bodyRows()).find((r) => within(r).queryByText(conf))!;

describe('ReservationList', () => {
  it('has a page heading, all column headers and the toolbar', async () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Reservations' })).toBeInTheDocument();
    for (const name of [
      'Check In',
      'Check Out',
      'Res #',
      'Guest',
      'Reserver',
      'Block',
      'Location',
      'Room Type',
      'Room',
      'Status',
    ]) {
      expect(
        screen.getByRole('columnheader', { name: new RegExp(`(^|\\s)${name}(,|$)`) }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Search reservations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Night Audit' })).toHaveAttribute(
      'href',
      '/night-audit-history',
    );
    expect(screen.getByRole('button', { name: 'New Reservation' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Unassigned Only' })).not.toBeChecked();
    expect(await screen.findByRole('combobox', { name: /Location/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Location/ })).toBeInTheDocument();
    await bodyRows();
  });

  it('defaults to today through the next 7 days, sorted by check-in ascending', async () => {
    const { client, list } = spied();
    setup('/reservations', client);
    const rows = await bodyRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        checkInFrom: '2026-10-16',
        checkInTo: '2026-10-23',
        sort: { field: 'arrival', direction: 'asc' },
        page: 1,
      }),
      expect.anything(),
    );
    expect(screen.getByLabelText('Check in From')).toHaveValue('2026-10-16');
    expect(screen.getByLabelText('Check in to')).toHaveValue('2026-10-23');
    expect(screen.getByRole('columnheader', { name: /Check In/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(url()).toBe('/reservations');
  });

  it('renders status, room and canceled treatments', async () => {
    setup('/reservations?from=&to=&rows=50');
    // Not on the grid: list-only mock reservations.
    const canceled = await rowFor('GR-50401');
    expect(within(canceled).getByText('Canceled')).toHaveStyle({ fontWeight: '700' });
    expect(canceled).toHaveStyle({ fontStyle: 'italic' });

    const unassigned = await rowFor('GR-50402');
    expect(within(unassigned).getByText('Unassigned')).toHaveStyle({
      color: theme.palette.error.main,
    });

    // Unassigned first room plus one more: "Unassigned +1".
    const multiUnassigned = await rowFor('GR-50403');
    expect(multiUnassigned).toHaveTextContent('Unassigned +1');

    // Three-room reservation: first room and +2; status of its rooms.
    const multi = await rowFor('GR-50321');
    expect(multi).toHaveTextContent(/\+2/);
    expect(within(multi).getByText('Not Checked In')).toBeInTheDocument();

    // Two-room reservation checked in.
    expect(within(await rowFor('GR-50290')).getByText('Checked In')).toBeInTheDocument();
  });

  it('writes filters to the URL and narrows the server query', async () => {
    const user = userEvent.setup();
    const { client, list } = spied();
    setup('/reservations', client);
    await bodyRows();
    await user.click(screen.getByRole('switch', { name: 'Unassigned Only' }));
    await waitFor(() => expect(url()).toBe('/reservations?unassigned=1'));
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ unassignedOnly: true }),
      expect.anything(),
    );
    const rows = await bodyRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r).toHaveTextContent('Unassigned');
  });

  it('hides the Location select and column when there is only one location', async () => {
    const base = createMockClient({ today: TODAY });
    const getOptions = async () => {
      const o = await base.reservationList.getOptions();
      return { ...o, locations: o.locations.slice(0, 1) };
    };
    setup('/reservations', { ...base, reservationList: { ...base.reservationList, getOptions } });
    await bodyRows();
    await waitFor(() =>
      expect(screen.queryByRole('columnheader', { name: /Location/ })).toBeNull(),
    );
    expect(screen.queryByRole('combobox', { name: /Location/ })).toBeNull();
  });

  it('picks one location from the single select', async () => {
    const user = userEvent.setup();
    setup();
    await bodyRows();
    await user.click(screen.getByRole('combobox', { name: /Location/ }));
    await user.click(await screen.findByRole('option', { name: 'Lakeside Cottages' }));
    await waitFor(() => expect(url()).toBe('/reservations?locations=lakeside'));
  });

  it('applies the date range, location and other filters from the URL', async () => {
    const { client, list } = spied();
    setup(
      '/reservations?from=2026-10-01&to=2026-10-31&locations=lakeside&status=checked-in',
      client,
    );
    await bodyRows();
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        checkInFrom: '2026-10-01',
        checkInTo: '2026-10-31',
        locationIds: ['lakeside'],
        statuses: ['checked-in'],
      }),
      expect.anything(),
    );
    expect(screen.getByLabelText('Check in From')).toHaveValue('2026-10-01');
  });

  it('changes the date range through the fields and returns to page 1', async () => {
    const user = userEvent.setup();
    setup('/reservations?page=2&rows=10');
    await bodyRows();
    const from = screen.getByLabelText('Check in From');
    await user.clear(from);
    await user.type(from, '2026-10-10');
    await waitFor(() => expect(url()).toContain('from=2026-10-10'));
    expect(url()).not.toContain('page=');
  });

  it('sorts server-side from the header and reflects it in the URL', async () => {
    const user = userEvent.setup();
    const { client, list } = spied();
    setup('/reservations', client);
    await bodyRows();
    await user.click(screen.getByRole('button', { name: /^Guest/ }));
    await waitFor(() => expect(url()).toBe('/reservations?sort=guestName%3Aasc'));
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: { field: 'guestName', direction: 'asc' } }),
      expect.anything(),
    );
    await user.click(screen.getByRole('button', { name: /^Guest/ }));
    await waitFor(() => expect(url()).toBe('/reservations?sort=guestName%3Adesc'));
    expect(screen.getByRole('columnheader', { name: /^Guest/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('has no column filter icons, only sorting (Figma 2524:36168)', async () => {
    setup();
    await bodyRows();
    expect(screen.queryByRole('button', { name: /^Filter / })).toBeNull();
    expect(screen.getByRole('button', { name: /^Check In/ })).toBeInTheDocument();
  });

  it('renders Night Audit (blue outline, white fill) and New Reservation (filled) as 200px buttons', async () => {
    setup();
    await bodyRows();
    const audit = screen.getByRole('link', { name: 'Night Audit' });
    const create = screen.getByRole('button', { name: 'New Reservation' });
    expect(audit).toHaveClass('MuiButton-outlined', 'MuiButton-colorInfo');
    expect(audit).toHaveStyle({ backgroundColor: theme.palette.background.paper });
    expect(create).toHaveClass('MuiButton-contained', 'MuiButton-colorPrimary');
    for (const b of [audit, create]) expect(b).toHaveStyle({ width: '200px' });
  });

  it('tints rows a bulk action failed on, with a non-color cue, and leaves others alone', async () => {
    setup('/reservations', undefined, { failedIds: new Set(['rs-5']) });
    const failed = await rowFor('GR-50310');
    expect(failed).toHaveStyle({ backgroundColor: theme.palette.warning.background });
    expect(failed).toHaveTextContent('could not be checked in');
    const others = (await bodyRows()).filter((r) => r !== failed);
    for (const r of others) {
      expect(r).not.toHaveStyle({ backgroundColor: theme.palette.warning.background });
    }
  });

  it('searches from the search button', async () => {
    const user = userEvent.setup();
    setup('/reservations?from=&to=');
    await bodyRows();
    const button = screen.getByRole('button', { name: 'Search reservations' });
    await user.click(button);
    const field = screen.getByRole('textbox', { name: 'Search reservations' });
    expect(field).toHaveFocus();
    await user.type(field, 'GR-50188');
    await waitFor(() => expect(url()).toContain('q=GR-50188'));
    // Escape closes the pop-up, keeps the query and returns focus to the button.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
    const active = screen.getByRole('button', { name: 'Search reservations, filter active' });
    expect(active).toHaveFocus();
    expect(url()).toContain('q=GR-50188');
    expect(await bodyRows()).toHaveLength(1);
    // The X clears the query.
    await user.click(active);
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(url()).not.toContain('q='));
    expect(screen.getByRole('textbox', { name: 'Search reservations' })).toHaveValue('');
  });

  it('does not change the table layout when the search pop-up opens', async () => {
    const user = userEvent.setup();
    setup('/reservations?from=&to=');
    await bodyRows();
    const headerCells = () => screen.getAllByRole('columnheader', { hidden: true }).length;
    const before = headerCells();
    await user.click(screen.getByRole('button', { name: 'Search reservations' }));
    expect(screen.getByRole('dialog', { name: 'Search reservations' })).toBeInTheDocument();
    expect(headerCells()).toBe(before);
    expect(screen.getByRole('table', { hidden: true }).contains(screen.getByRole('textbox'))).toBe(
      false,
    );
  });

  it('pages through the results and keeps the page in the URL', async () => {
    const user = userEvent.setup();
    setup('/reservations?from=&to=&rows=10');
    await bodyRows();
    const nav = screen.getByRole('navigation', { name: 'Reservations pages' });
    await user.click(within(nav).getByRole('button', { name: /page 2/i }));
    await waitFor(() => expect(url()).toContain('page=2'));
    expect((await bodyRows()).length).toBeGreaterThan(0);
  });

  describe('row selection and opening', () => {
    it('opens the Reservation Hub on a row click, but not on a checkbox click', async () => {
      const user = userEvent.setup();
      setup();
      const row = await rowFor('GR-50310');
      await user.click(within(row).getByRole('checkbox'));
      expect(url()).toBe('/reservations');
      expect(within(row).getByRole('checkbox')).toBeChecked();
      await user.click(within(row).getByText('Not Checked In'));
      expect(await screen.findByText('Elsewhere')).toBeInTheDocument();
      expect(url()).toBe('/reservations/rs-5');
    });

    it('reaches the hub from the Res # link with the keyboard', async () => {
      const user = userEvent.setup();
      setup();
      const row = await rowFor('GR-50310');
      within(row).getByRole('link', { name: 'GR-50310' }).focus();
      await user.keyboard('{Enter}');
      expect(url()).toBe('/reservations/rs-5');
    });

    it('offers a checkbox only on selectable rows', async () => {
      setup('/reservations?from=&to=&rows=50');
      // Checked in, checked out and canceled single rooms: no checkbox.
      expect(within(await rowFor('GR-50240')).queryByRole('checkbox')).toBeNull();
      expect(within(await rowFor('GR-50188')).queryByRole('checkbox')).toBeNull();
      expect(within(await rowFor('GR-50401')).queryByRole('checkbox')).toBeNull();
      // Arriving today, not checked in (unassigned too): selectable.
      expect(within(await rowFor('GR-50310')).getByRole('checkbox')).toBeInTheDocument();
      expect(within(await rowFor('GR-50402')).getByRole('checkbox')).toBeInTheDocument();
    });

    it('never offers a checkbox on a past or a future arrival (ticket 163)', async () => {
      setup('/reservations?from=&to=&rows=100');
      // GR-50395 arrived on 10/12 and never checked in: it goes through the panel's past-date prompts.
      expect(within(await rowFor('GR-50395')).queryByRole('checkbox')).toBeNull();
      // GR-50396: one room in house, one still waiting since 10/14.
      expect(within(await rowFor('GR-50396')).queryByRole('checkbox')).toBeNull();
      // GR-50321 arrives on 10/18.
      expect(within(await rowFor('GR-50321')).queryByRole('checkbox')).toBeNull();
    });

    it('select-all skips past-dated reservations', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();
      setup('/reservations?from=&to=&rows=100', undefined, { onSelectionChange });
      await rowFor('GR-50395');
      await user.click(
        screen.getByRole('checkbox', { name: 'Select all selectable reservations' }),
      );
      const last = onSelectionChange.mock.calls.at(-1)?.[0] as { confirmationNumber: string }[];
      expect(last.length).toBeGreaterThan(0);
      expect(last.every((r) => !['GR-50395', 'GR-50396'].includes(r.confirmationNumber))).toBe(
        true,
      );
    });

    it('select-all selects only selectable rows and exposes them', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();
      setup('/reservations?from=&to=&rows=100', undefined, { onSelectionChange });
      const rows = await bodyRows();
      const all = screen.getByRole('checkbox', { name: 'Select all selectable reservations' });
      await user.click(all);
      const boxes = rows.flatMap((r) => within(r).queryAllByRole('checkbox'));
      expect(boxes.length).toBeGreaterThan(0);
      expect(boxes.every((b) => (b as HTMLInputElement).checked)).toBe(true);
      expect(all).toBeChecked();
      await waitFor(() => {
        const last = onSelectionChange.mock.calls.at(-1)![0] as ReservationListRow[];
        expect(last).toHaveLength(boxes.length);
        // Checked-in and canceled rows are never part of it.
        expect(last.some((r) => r.confirmationNumber === 'GR-50240')).toBe(false);
        expect(last.some((r) => r.confirmationNumber === 'GR-50401')).toBe(false);
      });
      await user.click(all);
      expect(boxes.every((b) => !(b as HTMLInputElement).checked)).toBe(true);
    });

    it('shows the header checkbox as indeterminate with a partial selection', async () => {
      const user = userEvent.setup();
      setup();
      const row = await rowFor('GR-50310');
      await user.click(within(row).getByRole('checkbox'));
      expect(
        screen.getByRole('checkbox', { name: 'Select all selectable reservations' }),
      ).toBePartiallyChecked();
    });

    it('clears the selection when the query changes', async () => {
      const user = userEvent.setup();
      setup();
      const row = await rowFor('GR-50310');
      await user.click(within(row).getByRole('checkbox'));
      await user.click(screen.getByRole('switch', { name: 'Unassigned Only' }));
      await waitFor(() => expect(url()).toContain('unassigned=1'));
      await bodyRows();
      expect(
        screen.getByRole('checkbox', { name: 'Select all selectable reservations' }),
      ).not.toBeChecked();
    });

    it('renders the bulk action slot with the selected rows', async () => {
      const user = userEvent.setup();
      setup('/reservations', undefined, {
        renderBulkActions: (rows) => <button>Bulk {rows.length}</button>,
      });
      expect(screen.getByRole('button', { name: 'Bulk 0' })).toBeInTheDocument();
      await user.click(within(await rowFor('GR-50310')).getByRole('checkbox'));
      expect(screen.getByRole('button', { name: 'Bulk 1' })).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('links the calendar toggle to the schedule', async () => {
      setup();
      expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('link', { name: 'Calendar view' })).toHaveAttribute(
        'href',
        '/schedule',
      );
      await bodyRows();
    });

    it('opens the New Reservation panel on the schedule', async () => {
      const user = userEvent.setup();
      setup();
      await user.click(screen.getByRole('button', { name: 'New Reservation' }));
      expect(await screen.findByText('Elsewhere')).toBeInTheDocument();
      expect(url()).toBe('/schedule?panel=new');
    });
  });

  describe('states', () => {
    it('shows a loading state with skeleton rows', async () => {
      setup('/reservations', createMockClient({ today: TODAY, scenario: 'loading' }));
      expect(await screen.findByText('Loading reservations')).toBeInTheDocument();
      expect(screen.getByRole('table', { name: 'Reservations' })).toHaveAttribute(
        'aria-busy',
        'true',
      );
    });

    it('shows an empty state without filters', async () => {
      setup('/reservations', createMockClient({ today: TODAY, scenario: 'empty' }));
      expect(await screen.findByText('No reservations to show.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    });

    it('shows a no-match state with Clear filters when filters narrow to nothing', async () => {
      const user = userEvent.setup();
      setup('/reservations?guest=zzzzzz');
      expect(await screen.findByText('No reservations match the filters.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Clear filters' }));
      await waitFor(() => expect(url()).toBe('/reservations'));
      expect((await bodyRows()).length).toBeGreaterThan(0);
    });

    it('shows an error with Retry that loads again', async () => {
      const user = userEvent.setup();
      const base = createMockClient({ today: TODAY });
      let fail = true;
      const list = vi.fn((q?: ReservationListQuery, o?: { signal?: AbortSignal }) =>
        fail ? Promise.reject(new Error('boom')) : base.reservationList.list(q, o),
      );
      setup('/reservations', { ...base, reservationList: { ...base.reservationList, list } });
      expect(await screen.findByText('The reservations could not be loaded.')).toBeInTheDocument();
      fail = false;
      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect((await bodyRows()).length).toBeGreaterThan(0);
      expect(screen.queryByText('The reservations could not be loaded.')).toBeNull();
    });
  });
});
