import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient, ScheduleData } from '../api/types';
import { theme } from '../theme';
import Schedule from './Schedule';

const TODAY = '2026-10-16';

function Probe() {
  const { pathname, search } = useLocation();
  return <output data-testid="url">{pathname + search}</output>;
}

function setup(url: string, client: ApiClient = createMockClient({ today: TODAY })) {
  return render(
    <ThemeProvider theme={theme}>
      <ApiProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/schedule" element={<Schedule today={TODAY} />} />
          </Routes>
          <Probe />
        </MemoryRouter>
      </ApiProvider>
    </ThemeProvider>,
  );
}

const url = () => screen.getByTestId('url').textContent;
const grid = () => screen.getByRole('grid', { name: 'Schedule', hidden: true });
const roomRows = () => within(grid()).getAllByRole('rowheader', { hidden: true });

async function loaded(path = '/schedule', client?: ApiClient) {
  const user = userEvent.setup();
  setup(path, client);
  await screen.findByRole('grid', { name: 'Schedule' });
  return user;
}

async function openPanel(user: ReturnType<typeof userEvent.setup>, name: string | RegExp) {
  await user.click(screen.getByRole('button', { name }));
  return screen.findByRole('dialog', { name: 'Schedule filters' });
}

let clientHeight: PropertyDescriptor | undefined;
beforeAll(() => {
  clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 4000,
  });
});
afterAll(() => {
  if (clientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight);
});

describe('filter panel groups', () => {
  it('has the four groups, each with Select all and Select none', async () => {
    const user = await loaded();
    const panel = await openPanel(user, 'Filters');
    for (const title of ['Locations', 'Room Types', 'Housekeeping Status', 'Room Features']) {
      const group = within(panel).getByRole('group', { name: title });
      expect(within(group).getByRole('button', { name: /^Select all/ })).toBeInTheDocument();
      expect(within(group).getByRole('button', { name: /^Select none/ })).toBeInTheDocument();
    }
    const hk = within(panel).getByRole('group', { name: 'Housekeeping Status' });
    expect(
      within(hk)
        .getAllByRole('checkbox')
        .map((c) => c.getAttribute('aria-label') ?? c.closest('label')?.textContent),
    ).toEqual(['Not Checked Out', 'Needs Cleaning', 'Cleaned', 'Ready', 'Needs Maintenance']);
  });

  it('starts with nothing checked in the housekeeping and feature groups (no filter)', async () => {
    const user = await loaded();
    const panel = await openPanel(user, 'Filters');
    for (const title of ['Housekeeping Status', 'Room Features']) {
      const group = within(panel).getByRole('group', { name: title });
      for (const box of within(group).getAllByRole('checkbox')) expect(box).not.toBeChecked();
    }
  });

  it('hides the Locations group when the club has one location', async () => {
    const base = createMockClient({ today: TODAY });
    const one: ApiClient = {
      ...base,
      schedule: {
        ...base.schedule,
        get: async (q, o) => {
          const d: ScheduleData = await base.schedule.get(q, o);
          const keep = d.locations[0].id;
          return {
            ...d,
            locations: [d.locations[0]],
            rooms: d.rooms.filter((r) => r.locationId === keep),
          };
        },
      },
    };
    const user = await loaded('/schedule?locations=nowhere', one);
    // The stale ?locations= is ignored and not counted.
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    const panel = await openPanel(user, 'Filters');
    expect(within(panel).queryByRole('group', { name: 'Locations' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('group', { name: 'Room Types' })).toBeInTheDocument();
  });
});

describe('housekeeping filter', () => {
  it('keeps rooms with a reservation in the chosen status and persists in the URL', async () => {
    const user = await loaded();
    const before = roomRows().length;
    const panel = await openPanel(user, 'Filters');
    await user.click(within(panel).getByRole('checkbox', { name: 'Not Checked Out' }));
    await waitFor(() => expect(roomRows().length).toBeLessThan(before));
    expect(roomRows().length).toBeGreaterThan(0);
    expect(url()).toContain('housekeeping=not-checked-out');
    await user.click(
      within(panel).getByRole('button', { name: /^Select none of the housekeeping/ }),
    );
    await waitFor(() => expect(roomRows().length).toBe(before));
    expect(url()).not.toContain('housekeeping');
  });

  it('restores the filter from the URL', async () => {
    setup('/schedule?housekeeping=cleaned,ready');
    expect(await screen.findByRole('button', { name: 'Filters, 1 active' })).toBeInTheDocument();
  });
});

describe('room features filter', () => {
  it('requires every checked feature and persists in the URL', async () => {
    const user = await loaded();
    const before = roomRows().length;
    const panel = await openPanel(user, 'Filters');
    await user.click(within(panel).getByRole('checkbox', { name: 'Soaking tub' }));
    await waitFor(() => expect(roomRows().length).toBeLessThan(before));
    const suites = roomRows().length;
    expect(url()).toContain('features=feature-tub');
    await user.click(within(panel).getByRole('checkbox', { name: 'Mini fridge' }));
    await waitFor(() => expect(roomRows().length).toBeLessThanOrEqual(suites));
    expect(url()).toContain('features=feature-tub%2Cfeature-fridge');
  });

  it('shows "No rooms match" and Clear filters resets the new groups too', async () => {
    const user = userEvent.setup();
    setup('/schedule?features=feature-tub&housekeeping=ready');
    expect(await screen.findByText('No rooms match the filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(grid()).toBeInTheDocument());
    expect(url()).toBe('/schedule');
  });

  it('ignores a feature id that is not in the data: rooms stay and it is not counted', async () => {
    await loaded('/schedule?features=old-id');
    expect(roomRows().length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
  });

  it('counts only known feature ids when some are stale', async () => {
    await loaded('/schedule?features=old-id,feature-tub');
    expect(screen.getByRole('button', { name: 'Filters, 1 active' })).toBeInTheDocument();
  });
});

describe('applied state', () => {
  it('has no count when nothing is applied and a count in the name and badge when it is', async () => {
    const user = await loaded();
    const button = screen.getByRole('button', { name: 'Filters' });
    expect(button).not.toHaveTextContent(/\d/);
    const panel = await openPanel(user, 'Filters');
    await user.click(within(panel).getByRole('checkbox', { name: 'Balcony' }));
    await user.click(within(panel).getByRole('checkbox', { name: 'Cleaned' }));
    // The open popover hides the page from the accessibility tree.
    const applied = await screen.findByRole('button', { name: 'Filters, 2 active', hidden: true });
    // Not color alone: the count is drawn on the funnel.
    expect(applied).toHaveTextContent('2');
  });
});
