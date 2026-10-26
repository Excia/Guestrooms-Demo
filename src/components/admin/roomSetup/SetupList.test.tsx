import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../../../theme';
import { ApiProvider } from '../../../api';
import { createMockClient } from '../../../api/mock';
import SetupList from './SetupList';

const items = [
  { id: 'a', label: 'King Room', inactive: false },
  { id: 'b', label: 'Cottage', inactive: true },
];

function renderList(selectedId: string | null = 'a', creating = false) {
  const onSelect = vi.fn();
  const onNew = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <SetupList
        items={items}
        selectedId={selectedId}
        creating={creating}
        newLabel="New Room Type"
        newTitle="New Room Type"
        onSelect={onSelect}
        onNew={onNew}
      />
    </ThemeProvider>,
  );
  return { onSelect, onNew };
}

describe('SetupList', () => {
  it('keeps the New entry first and the items in the given order', () => {
    renderList();
    expect(screen.getByRole('button', { name: 'New Room Type' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(rows).toEqual(['King Room', 'Cottage, Inactive']);
  });

  it('tags an inactive item with a visible red "Inactive" chip and greys its name', () => {
    renderList();
    const row = screen.getByRole('button', { name: /Cottage/ });
    const chip = within(row).getByText('Inactive');
    expect(getComputedStyle(chip).color).toBe('rgb(211, 47, 47)');
    // Never italic: greyed and sorted last is enough.
    expect(getComputedStyle(row).fontStyle).not.toBe('italic');
    expect(row).toHaveAttribute('data-inactive', 'true');
    // Greyed with the secondary text colour (60% black, 5.7:1 on white), not the failing disabled one.
    expect(getComputedStyle(row).color).toBe('rgba(0, 0, 0, 0.6)');
    const active = screen.getByRole('button', { name: 'King Room' });
    expect(active).not.toHaveAttribute('data-inactive');
    expect(getComputedStyle(active).color).not.toBe(getComputedStyle(row).color);
  });

  it('draws the Inactive chip white with dark text on the selected green row', () => {
    renderList('b');
    const label = within(screen.getByRole('button', { name: /Cottage/ })).getByText('Inactive');
    const chip = label.closest('.MuiChip-root') as HTMLElement;
    expect(getComputedStyle(chip).backgroundColor).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(chip).color).toBe('rgba(0, 0, 0, 0.87)');
  });

  it('stays selectable', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderList();
    await user.click(screen.getByRole('button', { name: /Cottage/ }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('uses the legacy geometry: 59px items, 10px apart, 5px active bar', () => {
    renderList();
    const row = screen.getByRole('button', { name: 'King Room' });
    expect(getComputedStyle(row).minHeight).toBe('59px');
    const list = screen.getByRole('list');
    expect(getComputedStyle(list).gap).toBe('10px');
    const bar = screen.getByTestId('setup-list-active-bar');
    expect(getComputedStyle(bar).width).toBe('5px');
    expect(
      within(bar.parentElement as HTMLElement).getByRole('button', { name: 'King Room' }),
    ).toBe(row);
  });

  it('shows the unsaved item first while creating', () => {
    renderList(null, true);
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('New Room Type');
    expect(screen.getAllByRole('button', { name: 'New Room Type' })[1]).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  describe('more menu', () => {
    function renderMore(selectedId: string | null = 'a', creating = false) {
      const more = {
        noun: 'Room',
        changeLogPage: 'rooms' as const,
        onCopy: vi.fn(),
        onDelete: vi.fn(),
      };
      render(
        <ApiProvider client={createMockClient()}>
          <ThemeProvider theme={theme}>
            <SetupList
              items={items}
              selectedId={selectedId}
              creating={creating}
              newLabel="New Room"
              newTitle="New Room"
              onSelect={vi.fn()}
              onNew={vi.fn()}
              more={more}
            />
          </ThemeProvider>
        </ApiProvider>,
      );
      return more;
    }

    it('puts a labelled menu button on the selected active row only', () => {
      renderMore();
      const button = screen.getByRole('button', { name: 'King Room more options' });
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(screen.getAllByRole('button', { name: /more options$/ })).toHaveLength(1);
    });

    it('has no menu button on an inactive row or on the unsaved new row', () => {
      renderMore('b');
      expect(screen.queryByRole('button', { name: /more options$/ })).not.toBeInTheDocument();
    });

    it('has none while a new item is being created', () => {
      renderMore('a', true);
      expect(screen.queryByRole('button', { name: /more options$/ })).not.toBeInTheDocument();
    });

    it('opens Room More Options with Change Log, Copy Room and Delete Room', async () => {
      const user = userEvent.setup();
      const more = renderMore();
      const button = screen.getByRole('button', { name: 'King Room more options' });
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      const menu = screen.getByRole('menu', { name: 'Room More Options' });
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((i) => i.textContent),
      ).toEqual(['Change Log', 'Copy Room', 'Delete Room']);
      await user.click(within(menu).getByRole('menuitem', { name: 'Copy Room' }));
      expect(more.onCopy).toHaveBeenCalledTimes(1);
      await user.click(button);
      await user.click(screen.getByRole('menuitem', { name: 'Delete Room' }));
      expect(more.onDelete).toHaveBeenCalledTimes(1);
    });

    it('opens with the keyboard and returns focus to the button on Escape', async () => {
      const user = userEvent.setup();
      renderMore();
      const button = screen.getByRole('button', { name: 'King Room more options' });
      button.focus();
      await user.keyboard('{Enter}');
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(button).toHaveFocus();
    });

    it('opens the Change Log of the selected item only, titled with its name', async () => {
      const user = userEvent.setup();
      const client = createMockClient();
      const list = vi.spyOn(client.changeLog, 'list');
      render(
        <ApiProvider client={client}>
          <ThemeProvider theme={theme}>
            <SetupList
              items={items}
              selectedId="a"
              creating={false}
              newLabel="New Room"
              newTitle="New Room"
              onSelect={vi.fn()}
              onNew={vi.fn()}
              more={{ noun: 'Room', changeLogPage: 'rooms', onCopy: vi.fn(), onDelete: vi.fn() }}
            />
          </ThemeProvider>
        </ApiProvider>,
      );
      await user.click(screen.getByRole('button', { name: 'King Room more options' }));
      await user.click(screen.getByRole('menuitem', { name: 'Change Log' }));
      const dialog = await screen.findByRole('dialog', { name: 'Rooms: King Room: Change Log' });
      expect(dialog).toBeInTheDocument();
      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({ page: 'rooms', recordId: 'a' }),
          expect.anything(),
        ),
      );
    });

    it('fixes the item when the menu entry is chosen, even if the selection changes behind the dialog', async () => {
      const user = userEvent.setup();
      const client = createMockClient();
      const props = {
        creating: false,
        newLabel: 'New Room',
        newTitle: 'New Room',
        onSelect: vi.fn(),
        onNew: vi.fn(),
        more: { noun: 'Room', changeLogPage: 'rooms' as const, onCopy: vi.fn(), onDelete: vi.fn() },
      };
      const ui = (selectedId: string) => (
        <ApiProvider client={client}>
          <ThemeProvider theme={theme}>
            <SetupList items={items} selectedId={selectedId} {...props} />
          </ThemeProvider>
        </ApiProvider>
      );
      const { rerender } = render(ui('a'));
      await user.click(screen.getByRole('button', { name: 'King Room more options' }));
      await user.click(screen.getByRole('menuitem', { name: 'Change Log' }));
      expect(
        await screen.findByRole('dialog', { name: 'Rooms: King Room: Change Log' }),
      ).toBeInTheDocument();
      rerender(ui('b'));
      expect(
        screen.getByRole('dialog', { name: 'Rooms: King Room: Change Log' }),
      ).toBeInTheDocument();
    });

    it('opens the Change Log dialog from the menu', async () => {
      const user = userEvent.setup();
      renderMore();
      await user.click(screen.getByRole('button', { name: 'King Room more options' }));
      await user.click(screen.getByRole('menuitem', { name: 'Change Log' }));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });
  });
});
