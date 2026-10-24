import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import type { ApiClient } from '../api/types';
import { createPermissions, PermissionsProvider } from '../app/permissions';
import { theme } from '../theme';
import Schedule from './Schedule';

// The Unassigned section of the grid: its states, opening a block, and that it takes no part
// in dragging. Seeds (mock, offsets from today): Harriet Lowell +1..+4, Devon Achterberg +3..+6,
// Priya Natarajan +9..+12.
const TODAY = '2026-10-16';

function Probe() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}

async function loaded(url = '/schedule', client: ApiClient = createMockClient({ today: TODAY })) {
  const user = userEvent.setup();
  render(
    <ThemeProvider theme={theme}>
      <PermissionsProvider value={createPermissions()}>
        <ApiProvider client={client}>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route path="/schedule" element={<Schedule today={TODAY} />} />
            </Routes>
            <Probe />
          </MemoryRouter>
        </ApiProvider>
      </PermissionsProvider>
    </ThemeProvider>,
  );
  await screen.findByRole('grid', { name: 'Schedule' });
  return user;
}

const section = () => document.querySelector<HTMLElement>('[data-unassigned-section]');
const toggle = () => screen.queryByRole('button', { name: 'Unassigned reservations' });

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});

// The first Unassigned seed (Harriet Lowell) as a linked-room block: the mock has none.
function linkedUnassigned(): ApiClient {
  const client = createMockClient({ today: TODAY });
  return {
    ...client,
    schedule: {
      ...client.schedule,
      get: async (query, options) => {
        const data = await client.schedule.get(query, options);
        return {
          ...data,
          unassigned: data.unassigned.map((b) =>
            b.id === 'rr-u1'
              ? { ...b, linkedTo: { roomNumber: '202', reserverName: 'Thomas Okafor' } }
              : b,
          ),
        };
      },
    },
  };
}
const statusText = () =>
  screen
    .getAllByRole('status', { hidden: true })
    .map((s) => s.textContent)
    .join(' ');

describe('schedule Unassigned section', () => {
  it('shows a collapsed "Unassigned (0)" row with a disabled toggle when nothing is unassigned', async () => {
    // 2026-11-20 is past every seed
    const user = await loaded('/schedule?start=2026-11-20');
    expect(section()).toHaveAttribute('data-unassigned-section', 'empty');
    expect(section()).toHaveTextContent('Unassigned(0)');
    expect(within(section()!).getAllByRole('row')).toHaveLength(1);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveAttribute('aria-disabled', 'true');
    expect(toggle()).toHaveAccessibleDescription(
      'There are no unassigned reservations in this date range.',
    );
    // still focusable, and activating it changes nothing
    toggle()!.focus();
    expect(toggle()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(section()).toHaveAttribute('data-unassigned-section', 'empty');
    expect(toggle()).toHaveFocus();
  });

  it('keeps room rows numbered after the zero row and the header', async () => {
    await loaded('/schedule?start=2026-11-20');
    const firstRoomRow = screen
      .getAllByRole('row')
      .find(
        (r) =>
          r.closest('[data-unassigned-section]') === null &&
          r.getAttribute('aria-rowindex') !== '1',
      )!;
    expect(firstRoomRow).toHaveAttribute('aria-rowindex', '3');
  });

  it('shows one reservation as a single row without a toggle', async () => {
    // 24-30 Oct: only Priya Natarajan (+9..+12) overlaps
    await loaded('/schedule?start=2026-10-24');
    expect(section()).toHaveAttribute('data-unassigned-section', 'single');
    expect(section()).toHaveTextContent('Unassigned');
    expect(toggle()).toBeNull();
    expect(within(section()!).getAllByRole('row')).toHaveLength(1);
    expect(screen.getByRole('gridcell', { name: /Priya Natarajan/ })).toBeInTheDocument();
  });

  it('expands two or more by default, one row each, label on the first row only', async () => {
    await loaded();
    expect(section()).toHaveAttribute('data-unassigned-section', 'expanded');
    const rows = within(section()!).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Unassigned')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('Unassigned')).not.toBeInTheDocument();
    expect(within(rows[0]).getByText(/Harriet Lowell/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/Devon Achterberg/)).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(toggle()).toHaveAccessibleName('Unassigned reservations');
    // the grid counts the extra rows
    expect(screen.getByRole('grid', { name: 'Schedule' })).toHaveAttribute('aria-rowcount');
  });

  it('collapses to the label with the count and no blocks, and expands again', async () => {
    const user = await loaded();
    await user.click(toggle()!);
    expect(section()).toHaveAttribute('data-unassigned-section', 'collapsed');
    expect(within(section()!).getAllByRole('row')).toHaveLength(1);
    expect(section()).toHaveTextContent('Unassigned(2)');
    expect(screen.queryByText(/Harriet Lowell/)).not.toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveAccessibleName('Unassigned reservations');
    await user.click(toggle()!);
    expect(section()).toHaveAttribute('data-unassigned-section', 'expanded');
    expect(screen.getByText(/Harriet Lowell/)).toBeInTheDocument();
  });

  it('keeps keyboard focus on the toggle after collapse and expand', async () => {
    const user = await loaded();
    toggle()!.focus();
    await user.keyboard('{Enter}');
    expect(section()).toHaveAttribute('data-unassigned-section', 'collapsed');
    expect(toggle()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(section()).toHaveAttribute('data-unassigned-section', 'expanded');
    expect(toggle()).toHaveFocus();
  });

  it('counts follow the visible range', async () => {
    await loaded('/schedule?view=14');
    expect(within(section()!).getAllByRole('row')).toHaveLength(3);
  });

  it('opens the reservation on a click', async () => {
    const user = await loaded();
    await user.click(screen.getByRole('gridcell', { name: /Harriet Lowell.*Unassigned room/ }));
    expect(screen.getByTestId('url')).toHaveTextContent('res=rs-u1');
  });

  it('opens the reservation on Enter; the block is a tab stop', async () => {
    const user = await loaded();
    const block = screen.getByRole('gridcell', { name: /Devon Achterberg/ });
    expect(block).toHaveAttribute('tabindex', '0');
    block.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('url')).toHaveTextContent('res=rs-u2');
  });

  it('cannot be picked up or dragged, and shows no housekeeping chip', async () => {
    const user = await loaded();
    const block = screen.getByRole('gridcell', { name: /Harriet Lowell/ });
    fireEvent.pointerDown(block, { clientX: 700, clientY: 100, button: 0, pointerType: 'mouse' });
    fireEvent.pointerMove(window, { clientX: 700, clientY: 400, pointerType: 'mouse' });
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
    fireEvent.pointerUp(window, { clientX: 700, clientY: 400, pointerType: 'mouse' });
    block.focus();
    await user.keyboard(' ');
    expect(screen.queryByTestId('drop-indicator')).not.toBeInTheDocument();
    expect(within(block).queryByRole('button')).toBeNull();
  });

  it('keeps room rows numbered after the Unassigned rows for assistive technology', async () => {
    await loaded();
    const firstRoomRow = screen
      .getAllByRole('row')
      .find(
        (r) =>
          r.closest('[data-unassigned-section]') === null &&
          r.getAttribute('aria-rowindex') !== '1',
      )!;
    // header (1) + two Unassigned rows (2, 3): the first room is row 4
    expect(firstRoomRow).toHaveAttribute('aria-rowindex', '4');
  });
  it('a linked-room block here opens nothing on click, says why, and shows its tooltip on focus', async () => {
    const user = await loaded('/schedule', linkedUnassigned());
    const cell = screen.getByRole('gridcell', { name: /Harriet Lowell.*Linked to 202/ });
    expect(cell).toHaveAttribute('aria-disabled', 'true');
    await user.click(cell);
    expect(screen.getByTestId('url')).not.toHaveTextContent('res=');
    expect(statusText()).toContain('Linked room. It cannot be opened or moved from here.');
  });

  it('Enter on a focused linked-room block here opens nothing and says why', async () => {
    const user = await loaded('/schedule', linkedUnassigned());
    const cell = screen.getByRole('gridcell', { name: /Harriet Lowell.*Linked to 202/ });
    act(() => cell.focus());
    expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent('Linked to 202');
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('url')).not.toHaveTextContent('res=');
    expect(statusText()).toContain('Linked room. It cannot be opened or moved from here.');
  });
});
