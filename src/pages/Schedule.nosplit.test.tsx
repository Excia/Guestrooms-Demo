import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api';
import { createMockClient } from '../api/mock';
import { theme } from '../theme';
import Schedule from './Schedule';

// A stand-in dialog that can trigger the split link even when the drop has no split alternative,
// a state the real dialog never offers but confirm() must still survive.
vi.mock('../components/schedule/MoveConfirmDialog', () => ({
  default: ({ onSplit }: { onSplit: () => void }) => (
    <div role="dialog" aria-label="stub">
      <button onClick={onSplit}>force split</button>
    </div>
  ),
}));

// jsdom has no layout: a tall viewport renders every row.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 3000,
  });
});

describe('confirm without a split alternative', () => {
  it('releases the frozen rows instead of leaving them frozen', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <ApiProvider client={createMockClient({ today: '2026-10-16' })}>
          <MemoryRouter initialEntries={['/schedule']}>
            <Schedule today="2026-10-16" />
          </MemoryRouter>
        </ApiProvider>
      </ThemeProvider>,
    );
    const grid = await screen.findByRole('grid', { name: 'Schedule' });
    grid.focus();
    // pick up Thomas Okafor (202) and drop him on 207: the dialog opens, rows are frozen
    await user.keyboard('{ArrowDown}{Enter}' + '{ArrowDown}'.repeat(7) + '{Enter}');
    await user.click(await screen.findByRole('button', { name: 'force split' }));
    // frozen rows would ignore this filter; released rows follow it
    const rowCount = () => within(grid).getAllByRole('row', { hidden: true }).length;
    const all = rowCount();
    await user.click(screen.getByRole('button', { name: /all rooms/i }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Booked only' }));
    await waitFor(() => expect(rowCount()).toBeLessThan(all));
  });
});
