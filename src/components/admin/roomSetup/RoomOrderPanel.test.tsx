import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../../../theme';
import RoomOrderPanel from './RoomOrderPanel';

const item = (id: string) => ({ id, label: `Room ${id}` });
const ui = (ids: string[], onSave = vi.fn()) => (
  <MemoryRouter>
    <ThemeProvider theme={theme}>
      <RoomOrderPanel
        items={ids.map(item)}
        saving={false}
        error={null}
        onSave={onSave}
        onClose={vi.fn()}
      />
    </ThemeProvider>
  </MemoryRouter>
);

describe('RoomOrderPanel', () => {
  it('drops a room that disappears while open and never sends it', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(ui(['a', 'b', 'c', 'd'], onSave));
    await user.click(screen.getByRole('button', { name: 'Move Room d up' }));
    rerender(ui(['a', 'c', 'd'], onSave));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Room a',
      'Room d',
      'Room c',
    ]);
    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    expect(onSave).toHaveBeenCalledWith(['a', 'd', 'c']);
  });

  it('appends a room that appears while open', () => {
    const { rerender } = render(ui(['a', 'b']));
    rerender(ui(['a', 'b', 'z']));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Room a',
      'Room b',
      'Room z',
    ]);
  });

  it('unmounts right after a move without error', async () => {
    const user = userEvent.setup();
    const { unmount } = render(ui(['a', 'b']));
    await user.click(screen.getByRole('button', { name: 'Move Room a down' }));
    expect(() => unmount()).not.toThrow();
  });

  it('puts a bare green Close next to a solid green Save Order in one row', () => {
    render(ui(['a', 'b']));
    const save = screen.getByRole('button', { name: 'Save Order' });
    const close = screen.getByRole('button', { name: 'Close room order' });
    expect(close.parentElement).toBe(save.parentElement);
    expect(getComputedStyle(save).minHeight).toBe('59px');
    // Icon button only: no box, no fill.
    expect(getComputedStyle(close).borderStyle).not.toBe('solid');
    expect(getComputedStyle(close).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(close).color).toBe('rgb(46, 125, 50)');
  });

  it('draws each drag handle with the reorder icon in the dark text colour', () => {
    render(ui(['a']));
    const handle = screen.getByTestId('drag-handle-a');
    expect(getComputedStyle(handle).color).toBe('rgba(0, 0, 0, 0.87)');
    expect(handle.querySelector('[data-testid="ReorderIcon"]')).not.toBeNull();
  });
});
