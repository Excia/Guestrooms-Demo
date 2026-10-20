import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { createMockClient } from '../api/mock';
import { buildQuickStats } from '../api/quickStatsData';
import { renderWithApi } from '../api/testing';
import type { ApiClient, QuickStats as QuickStatsData, QuickStatsQuery } from '../api/types';
import { ApiError } from '../api/types';
import { routes } from '../app/routes';
import QuickStats, { type QuickStatsProps } from './QuickStats';

// 2026-12-09 is a Wednesday: the week starts Sunday 2026-12-06.
const TODAY = '2026-12-09';

function setup(props: QuickStatsProps = {}, client: ApiClient = createMockClient()) {
  return renderWithApi(
    <MemoryRouter>
      <QuickStats today={TODAY} {...props} />
    </MemoryRouter>,
    { client },
  );
}

/** A client whose getQuickStats is `fn`, everything else from the mock. */
function clientWith(
  fn: (q: QuickStatsQuery, o?: { signal?: AbortSignal }) => Promise<QuickStatsData>,
) {
  const base = createMockClient();
  const getQuickStats = vi.fn(fn);
  return { client: { ...base, dashboard: { ...base.dashboard, getQuickStats } }, getQuickStats };
}

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('QuickStats tabs', () => {
  it('is a tablist of Day, Week and Month with the Week view selected', async () => {
    setup();
    expect(screen.getByRole('tablist', { name: 'Quick Stats view' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Day View',
      'Week View',
      'Month View',
    ]);
    expect(tab(/week view/i)).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { name: 'Weekly Revenue' })).toBeInTheDocument();
  });

  it('switches views and changes the control and the titles', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Weekly Revenue' });
    expect(screen.getByLabelText('Start Date')).toHaveValue('2026-12-06');
    expect(screen.getByRole('heading', { name: 'Occupancy' })).toBeInTheDocument();

    await userEvent.click(tab(/day view/i));
    expect(await screen.findByRole('heading', { name: 'Daily Revenue' })).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY);
    expect(screen.getByRole('heading', { name: 'Room Blocks' })).toBeInTheDocument();

    await userEvent.click(tab(/month view/i));
    expect(await screen.findByRole('heading', { name: 'Monthly Revenue' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /month/i })).toHaveTextContent(
      'December (to date)',
    );
    expect(screen.getByRole('heading', { name: 'Room Blocks' })).toBeInTheDocument();
  });

  it('moves between tabs with the arrow, Home and End keys', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Weekly Revenue' });
    tab(/week view/i).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tab(/month view/i)).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(tab(/day view/i)).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(tab(/month view/i)).toHaveFocus();
  });

  it('links each tab to a tabpanel and shows only the selected one', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Weekly Revenue' });
    const panel = screen.getByRole('tabpanel', { name: 'Week View' });
    expect(tab(/week view/i)).toHaveAttribute('aria-controls', panel.id);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it("remembers each tab's period while switching", async () => {
    setup();
    await screen.findByRole('heading', { name: 'Weekly Revenue' });
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-11-29' } });
    await userEvent.click(tab(/day view/i));
    await screen.findByRole('heading', { name: 'Daily Revenue' });
    await userEvent.click(tab(/week view/i));
    expect(await screen.findByLabelText('Start Date')).toHaveValue('2026-11-29');
  });
});

describe('QuickStats data and formatting', () => {
  const week: QuickStatsData = {
    ...(buildQuickStats({ view: 'week', startDate: '2026-12-06' }) as Extract<
      QuickStatsData,
      { view: 'week' }
    >),
    occupancy: { booked: 87, available: 81, percent: 51.8 },
    revenue: {
      rows: [
        { id: 'a', name: 'Alpha Rate', nights: 4, revenue: 123_456 },
        { id: 'b', name: 'Beta Rate', nights: 0, revenue: 0 },
        { id: 'c', name: 'Gamma Rate', nights: 2, revenue: 40_000 },
        { id: 'd', name: 'Delta Rate', nights: 1, revenue: 10_000 },
        { id: 'e', name: 'Epsilon Rate', nights: 1, revenue: 10_000 },
        { id: 'f', name: 'Zeta Rate', nights: 1, revenue: 10_000 },
      ],
      totalRevenue: 4_250_000,
      totalNights: 3_000,
      averageRate: null,
    },
  };

  it('renders the occupancy summary with accessible names', async () => {
    setup({}, clientWith(async () => week).client);
    const group = await screen.findByRole('group', { name: 'OCCUPANCY' });
    expect(within(group).getByText(/Booked rooms/)).toBeInTheDocument();
    expect(group).toHaveTextContent('Booked rooms: 87');
    expect(group).toHaveTextContent('Available rooms: 81');
    expect(group).toHaveTextContent('Occupancy percent: 51.8');
  });

  it('renders one row per rate category in the data (six, not four) under a TOTAL row', async () => {
    setup({}, clientWith(async () => week).client);
    const table = await screen.findByRole('table', { name: 'Weekly Revenue' });
    const rows = within(table).getAllByRole('row');
    // Header, TOTAL, six categories.
    expect(rows).toHaveLength(8);
    expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent('TOTAL');
    expect(within(table).getByRole('rowheader', { name: 'Zeta Rate' })).toBeInTheDocument();
  });

  it('formats totals and averages as currency; a missing value is an em dash', async () => {
    setup({}, clientWith(async () => week).client);
    const table = await screen.findByRole('table', { name: 'Weekly Revenue' });
    const total = within(table).getByRole('row', { name: /TOTAL/ });
    expect(total).toHaveTextContent('$42,500');
    expect(total).toHaveTextContent('—'); // no average rate
    expect(total).toHaveTextContent('3,000');
    const alpha = within(table).getByRole('row', { name: /Alpha Rate/ });
    expect(alpha).toHaveTextContent('$1,234.56');
    expect(alpha).toHaveTextContent('$308.64 (avg)'); // 123456 / 4 nights
    // No nights: the average is an em dash, with no "(avg)".
    const beta = within(table).getByRole('row', { name: /Beta Rate/ });
    expect(beta).toHaveTextContent('—');
    expect(beta).not.toHaveTextContent('(avg)');
  });

  it('shows numbers right-aligned in tabular figures', async () => {
    setup({}, clientWith(async () => week).client);
    const table = await screen.findByRole('table', { name: 'Weekly Revenue' });
    const cell = within(within(table).getByRole('row', { name: /Alpha Rate/ })).getAllByRole(
      'cell',
    )[0];
    const style = getComputedStyle(cell);
    expect(style.textAlign).toBe('right');
    expect(style.fontVariantNumeric).toBe('tabular-nums');
  });

  it('lists the week by day with a TOTAL row', async () => {
    setup();
    const table = await screen.findByRole('table', { name: 'Occupancy' });
    // Hidden header, TOTAL, seven days.
    expect(within(table).getAllByRole('row')).toHaveLength(9);
    expect(within(table).getByRole('rowheader', { name: '12/06/26' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: '12/12/26' })).toBeInTheDocument();
    expect(within(table).getByText('(avg)')).toBeInTheDocument();
  });

  it('lists room blocks with their nights and start date in the Day view', async () => {
    setup();
    await userEvent.click(tab(/day view/i));
    const table = await screen.findByRole('table', { name: 'Room Blocks' });
    expect(within(table).getAllByText(/starting \d\d\/\d\d$/).length).toBeGreaterThan(0);
  });

  it('links ALL ROOM BLOCKS to the Room Blocks route', async () => {
    setup();
    await userEvent.click(tab(/day view/i));
    const link = await screen.findByRole('link', { name: /all room blocks/i });
    const roomBlocks = routes.find((r) => r.id === 'room-blocks');
    expect(link).toHaveAttribute('href', roomBlocks?.path);
  });
});

describe('QuickStats refetching', () => {
  it('fetches once per view and period, and refetches when the control changes', async () => {
    const mock = createMockClient();
    const { client, getQuickStats } = clientWith((q, o) => mock.dashboard.getQuickStats(q, o));
    setup({}, client);
    await screen.findByRole('heading', { name: 'Weekly Revenue' });
    expect(getQuickStats).toHaveBeenCalledTimes(1);
    expect(getQuickStats.mock.calls[0][0]).toEqual({ view: 'week', startDate: '2026-12-06' });

    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-12-13' } });
    await waitFor(() => expect(getQuickStats).toHaveBeenCalledTimes(2));
    expect(getQuickStats.mock.calls[1][0]).toEqual({ view: 'week', startDate: '2026-12-13' });

    await userEvent.click(tab(/day view/i));
    await waitFor(() => expect(getQuickStats).toHaveBeenCalledTimes(3));
    expect(getQuickStats.mock.calls[2][0]).toEqual({ view: 'day', date: TODAY });
  });

  it('does not refetch for an incomplete date', async () => {
    const mock = createMockClient();
    const { client, getQuickStats } = clientWith((q, o) => mock.dashboard.getQuickStats(q, o));
    setup({}, client);
    await screen.findByRole('heading', { name: 'Weekly Revenue' });
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '' } });
    expect(getQuickStats).toHaveBeenCalledTimes(1);
  });

  it('refetches when a month is chosen', async () => {
    const mock = createMockClient();
    const { client, getQuickStats } = clientWith((q, o) => mock.dashboard.getQuickStats(q, o));
    setup({}, client);
    await userEvent.click(tab(/month view/i));
    await screen.findByRole('heading', { name: 'Monthly Revenue' });
    await userEvent.click(screen.getByRole('combobox', { name: /month/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'November 2026' }));
    await waitFor(() =>
      expect(getQuickStats).toHaveBeenLastCalledWith(
        { view: 'month', month: '2026-11' },
        expect.anything(),
      ),
    );
  });

  it('aborts the stale request and never shows its result', async () => {
    const signals: AbortSignal[] = [];
    const { client } = clientWith(
      (q, o) =>
        new Promise<QuickStatsData>((resolve) => {
          if (o?.signal) signals.push(o.signal);
          // Resolve even after abort, like a server that answers late.
          setTimeout(() => resolve(buildQuickStats(q)), 5);
        }),
    );
    setup({}, client);
    await userEvent.click(tab(/day view/i));
    expect(signals[0].aborted).toBe(true);
    expect(await screen.findByRole('heading', { name: 'Daily Revenue' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Weekly Revenue' })).not.toBeInTheDocument();
  });
});

describe('QuickStats states', () => {
  it('shows a loading skeleton and keeps the control while loading', async () => {
    setup({}, createMockClient({ scenario: 'loading' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Loading quick stats'),
    );
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    setup({}, createMockClient({ scenario: 'empty' }));
    expect(await screen.findByRole('status')).toHaveTextContent('No stats for this period.');
    expect(screen.getAllByText('No stats for this period.').length).toBeGreaterThan(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
  });

  it('shows an error with Retry that refetches', async () => {
    let calls = 0;
    const { client } = clientWith(async (q) => {
      calls += 1;
      if (calls === 1) throw new ApiError(500, 'boom');
      return buildQuickStats(q);
    });
    setup({}, client);
    expect(await screen.findByRole('alert')).toHaveTextContent('Quick stats could not be loaded.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Weekly Revenue' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('QuickStats placement', () => {
  it('renders the same content in the landing placement', async () => {
    setup({ placement: 'landing' });
    expect(await screen.findByRole('heading', { name: 'Weekly Revenue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Occupancy' })).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });
});

/** A getQuickStats whose answers the test settles by hand, per request. */
function deferred() {
  const pending: Array<{
    query: QuickStatsQuery;
    resolve: (s: QuickStatsData) => void;
    signal?: AbortSignal;
  }> = [];
  const { client, getQuickStats } = clientWith(
    (query, o) =>
      new Promise<QuickStatsData>((resolve) => {
        pending.push({ query, resolve, signal: o?.signal });
      }),
  );
  return { client, getQuickStats, pending };
}

/** Day stats whose booked count tells which date they answer. */
const dayFor = (date: string, booked: number): QuickStatsData => ({
  ...(buildQuickStats({ view: 'day', date }) as Extract<QuickStatsData, { view: 'day' }>),
  occupancy: { booked, available: 24 - booked, percent: 0 },
});

describe('QuickStats stale-while-revalidate', () => {
  it('keeps the last answer, dimmed and busy, while a new period loads', async () => {
    const { client, pending } = deferred();
    setup({}, client);
    await userEvent.click(tab(/day view/i));
    await waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(dayFor(TODAY, 11));
    const group = await screen.findByRole('group', { name: 'OCCUPANCY' });
    expect(group).toHaveTextContent('Booked rooms: 11');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-12-10' } });
    await waitFor(() => expect(pending).toHaveLength(3));
    // Still showing the old numbers, no skeleton, marked busy.
    expect(screen.getByRole('group', { name: 'OCCUPANCY' })).toHaveTextContent('Booked rooms: 11');
    expect(screen.getByRole('table', { name: 'Daily Revenue' })).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Loading quick stats');

    pending[2].resolve(dayFor('2026-12-10', 17));
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'OCCUPANCY' })).toHaveTextContent(
        'Booked rooms: 17',
      ),
    );
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it("shows a tab's previous answer when returning to it, a skeleton only on first load", async () => {
    const { client, pending } = deferred();
    setup({}, client);
    await waitFor(() => expect(pending).toHaveLength(1));
    pending[0].resolve(buildQuickStats(pending[0].query));
    await screen.findByRole('table', { name: 'Weekly Revenue' });

    await userEvent.click(tab(/day view/i));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(screen.queryByRole('table')).not.toBeInTheDocument(); // first load of Day: skeleton
    pending[1].resolve(buildQuickStats(pending[1].query));
    await screen.findByRole('table', { name: 'Daily Revenue' });

    await userEvent.click(tab(/week view/i));
    await waitFor(() => expect(pending).toHaveLength(3));
    expect(screen.getByRole('table', { name: 'Weekly Revenue' })).toBeInTheDocument(); // stale
  });

  it('drops a late answer for a period that was replaced (A then B, A answers last)', async () => {
    const { client, pending } = deferred();
    setup({}, client);
    await userEvent.click(tab(/day view/i));
    await waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(dayFor(TODAY, 5));
    await screen.findByRole('group', { name: 'OCCUPANCY' });

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-12-10' } }); // A
    await waitFor(() => expect(pending).toHaveLength(3));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-12-11' } }); // B
    await waitFor(() => expect(pending).toHaveLength(4));
    expect(pending[2].signal?.aborted).toBe(true);

    pending[3].resolve(dayFor('2026-12-11', 20));
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'OCCUPANCY' })).toHaveTextContent(
        'Booked rooms: 20',
      ),
    );
    pending[2].resolve(dayFor('2026-12-10', 9)); // A answers late
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole('group', { name: 'OCCUPANCY' })).toHaveTextContent('Booked rooms: 20');
  });

  it('shows the alert with Retry when a refresh fails', async () => {
    let calls = 0;
    const { client } = clientWith(async (q) => {
      calls += 1;
      if (calls === 2) throw new ApiError(500, 'boom');
      return buildQuickStats(q);
    });
    setup({}, client);
    await screen.findByRole('table', { name: 'Weekly Revenue' });
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-12-13' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('keeps one persistent live region', async () => {
    setup({}, createMockClient({ scenario: 'empty' }));
    const region = screen.getByRole('status');
    await waitFor(() => expect(region).toHaveTextContent('No stats for this period.'));
    expect(screen.getByRole('status')).toBe(region);
  });
});

describe('QuickStats date field', () => {
  it('reverts a cleared date to the last valid one on blur', async () => {
    setup();
    await screen.findByRole('table', { name: 'Weekly Revenue' });
    const input = screen.getByLabelText('Start Date');
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
    fireEvent.blur(input);
    expect(input).toHaveValue('2026-12-06');
  });
});
